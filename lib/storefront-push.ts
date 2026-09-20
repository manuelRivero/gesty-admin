import {
  fetchVapidPublicKey,
  PublicOrderPushError,
  registerOrderPushSubscription,
  type PublicPushSubscriptionInput,
} from "@/lib/requests/public-order-push"

export const STOREFRONT_SW_PATH = "/sw-storefront.js?v=3"
/** PNG con alpha real (plato + cubiertos). */
export const STOREFRONT_PUSH_ICON_PATH = "/food-notification-icon.png"
export const STOREFRONT_PUSH_BADGE_PATH = "/food-notification-badge.png"

function absoluteStorefrontAsset(path: string): string {
  if (typeof window === "undefined") return path
  try {
    return new URL(path, window.location.origin).href
  } catch {
    return path
  }
}

const OPT_IN_PREFIX = "gesty.shopping.pushOptIn.v1:"

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function isStorefrontPushSupported(): boolean {
  if (typeof window === "undefined") return false
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

function optInKey(slug: string, orderId: string): string {
  return `${OPT_IN_PREFIX}${slug.trim().toLowerCase()}:${orderId.trim()}`
}

export function readStorefrontPushOptIn(
  slug: string,
  orderId: string,
): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(optInKey(slug, orderId)) === "1"
  } catch {
    return false
  }
}

export function writeStorefrontPushOptIn(
  slug: string,
  orderId: string,
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(optInKey(slug, orderId), "1")
  } catch {
    /* noop */
  }
}

export async function ensureStorefrontServiceWorker(): Promise<ServiceWorkerRegistration> {
  try {
    const registration = await navigator.serviceWorker.register(
      STOREFRONT_SW_PATH,
      {
        scope: "/",
        // Evita servir un SW viejo cacheado por el HTTP cache de Chrome.
        updateViaCache: "none",
      },
    )
    try {
      await registration.update()
    } catch {
      /* noop */
    }
    await navigator.serviceWorker.ready
    return registration
  } catch (err) {
    const detail =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "registro fallido"
    throw new PublicOrderPushError(
      `No se pudo registrar el service worker (${detail})`,
      "SW_REGISTER_FAILED",
      500,
    )
  }
}

function toSubscriptionInput(
  sub: PushSubscription,
): PublicPushSubscriptionInput {
  const json = sub.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw new PublicOrderPushError(
      "Subscription incompleta",
      "INVALID_SUBSCRIPTION",
      400,
    )
  }
  return {
    endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh, auth },
  }
}

function applicationServerKeyFromVapid(publicKey: string): BufferSource {
  const bytes = urlBase64ToUint8Array(publicKey.trim())
  // Chrome Android a veces rechaza vistas tipadas “raras”; pasar ArrayBuffer puro.
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

/**
 * Permiso + SW + subscribe + POST al backend.
 */
export async function subscribeStorefrontOrderPush(
  slug: string,
  orderId: string,
): Promise<void> {
  if (!isStorefrontPushSupported()) {
    throw new PublicOrderPushError(
      "Este navegador no admite avisos push",
      "UNSUPPORTED",
      400,
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new PublicOrderPushError(
      "Necesitamos permiso para avisarte",
      "PERMISSION_DENIED",
      403,
    )
  }

  const publicKey = await fetchVapidPublicKey()
  const registration = await ensureStorefrontServiceWorker()

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKeyFromVapid(publicKey),
      })
    } catch (err) {
      const detail =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "subscribe falló"
      throw new PublicOrderPushError(
        `No se pudo suscribir al push (${detail})`,
        "SUBSCRIBE_FAILED",
        500,
      )
    }
  }

  await registerOrderPushSubscription(
    slug,
    orderId,
    toSubscriptionInput(subscription),
  )
  writeStorefrontPushOptIn(slug, orderId)

  // Prueba local: confirma permiso + SW. No depende del backend.
  try {
    await registration.showNotification("Avisos activados", {
      body: "Te vamos a avisar cuando el pedido avance. Podés salir de esta página.",
      tag: `gesty-order-${orderId.trim()}-optin`,
      icon: absoluteStorefrontAsset(STOREFRONT_PUSH_ICON_PATH),
      badge: absoluteStorefrontAsset(STOREFRONT_PUSH_BADGE_PATH),
      data: {
        url: `/shopping/${encodeURIComponent(slug.trim())}/order/${encodeURIComponent(orderId.trim())}`,
        orderId: orderId.trim(),
        slug: slug.trim(),
      },
    })
  } catch {
    /* noop — el opt-in ya quedó registrado */
  }
}

/** Probe silencioso: ¿el backend tiene VAPID? */
export async function isStorefrontPushConfigured(): Promise<boolean> {
  try {
    await fetchVapidPublicKey()
    return true
  } catch (err) {
    if (
      err instanceof PublicOrderPushError &&
      (err.code === "PUSH_NOT_CONFIGURED" || err.httpStatus === 503)
    ) {
      return false
    }
    // Red / otro error: no ocultar CTA; el click mostrará el error.
    return true
  }
}
