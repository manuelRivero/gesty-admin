import { isAxiosError } from "axios"

import { publicApi } from "@/lib/api"
import { PUBLIC_BUSINESSES_PATH } from "@/lib/requests/public-storefront"

export class PublicOrderPushError extends Error {
  readonly code: string
  readonly httpStatus: number

  constructor(message: string, code: string, httpStatus: number) {
    super(message)
    this.name = "PublicOrderPushError"
    this.code = code
    this.httpStatus = httpStatus
  }
}

export type PublicPushSubscriptionInput = {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * `GET /public/push/vapid-public-key`
 * 503 `PUSH_NOT_CONFIGURED` → ocultar CTA.
 */
export async function fetchVapidPublicKey(): Promise<string> {
  try {
    const { data } = await publicApi.get<{ publicKey?: string }>(
      "/public/push/vapid-public-key",
    )
    const key = data?.publicKey?.trim()
    if (!key) {
      throw new PublicOrderPushError(
        "Push no configurado",
        "PUSH_NOT_CONFIGURED",
        503,
      )
    }
    return key
  } catch (error) {
    throw mapPushAxiosError(error)
  }
}

/**
 * `POST /public/businesses/:slug/orders/:orderId/push-subscription`
 */
export async function registerOrderPushSubscription(
  slug: string,
  orderId: string,
  subscription: PublicPushSubscriptionInput,
): Promise<void> {
  const businessKey = slug.trim()
  const id = orderId.trim()
  if (!businessKey || !id) {
    throw new PublicOrderPushError(
      "Pedido no encontrado",
      "ORDER_NOT_FOUND",
      404,
    )
  }

  try {
    await publicApi.post(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(businessKey)}/orders/${encodeURIComponent(id)}/push-subscription`,
      { subscription },
    )
  } catch (error) {
    throw mapPushAxiosError(error)
  }
}

/**
 * `DELETE …/push-subscription` con `{ endpoint }`.
 */
export async function unregisterOrderPushSubscription(
  slug: string,
  orderId: string,
  endpoint: string,
): Promise<void> {
  const businessKey = slug.trim()
  const id = orderId.trim()
  const ep = endpoint.trim()
  if (!businessKey || !id || !ep) return

  try {
    await publicApi.delete(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(businessKey)}/orders/${encodeURIComponent(id)}/push-subscription`,
      { data: { endpoint: ep } },
    )
  } catch (error) {
    throw mapPushAxiosError(error)
  }
}

function mapPushAxiosError(error: unknown): never {
  if (isAxiosError(error)) {
    if (error.response) {
      const data = error.response.data as {
        error?: string
        code?: string
      }
      throw new PublicOrderPushError(
        typeof data?.error === "string"
          ? data.error
          : "No se pudo registrar el aviso",
        typeof data?.code === "string" ? data.code : "UNKNOWN",
        error.response.status,
      )
    }
    throw new PublicOrderPushError(
      "Sin conexión con el servidor de avisos",
      "NETWORK",
      0,
    )
  }
  throw error
}
