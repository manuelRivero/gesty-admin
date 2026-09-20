import {
  fetchVapidPublicKey,
  PublicOrderPushError,
  registerOrderPushSubscription,
  type PublicPushSubscriptionInput,
} from "@/lib/requests/public-order-push"

export const STOREFRONT_SW_PATH = "/sw-storefront.js"

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
  return navigator.serviceWorker.register(STOREFRONT_SW_PATH, { scope: "/" })
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

/**
 * Permiso + SW + subscribe + POST al backend.
 * Lanza `PublicOrderPushError` o Error genérico.
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
  await navigator.serviceWorker.ready

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        publicKey,
      ) as BufferSource,
    }))

  await registerOrderPushSubscription(
    slug,
    orderId,
    toSubscriptionInput(subscription),
  )
  writeStorefrontPushOptIn(slug, orderId)
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
