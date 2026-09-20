import { isAxiosError } from "axios"

import { publicApi } from "@/lib/api"
import { PUBLIC_BUSINESSES_PATH } from "@/lib/requests/public-storefront"

export type PublicOrderLineInput = {
  menuItemId: string
  quantity: number
  variation?: string | null
  notes?: string | null
}

export type CreatePublicOrderInput = {
  customer: {
    name: string
    phone: string
  }
  items: PublicOrderLineInput[]
  fulfillmentType?: "TAKE_AWAY"
  paymentMethod?: "cash"
  notes?: string | null
}

export type PublicOrderLineResult = {
  menuItemId: string
  name: string
  quantity: number
  variation: string | null
  notes: string | null
  unitPrice: string
  lineTotal: string
}

export type CreatePublicOrderResult = {
  orderId: string
  status: string
  paymentStatus: string
  paymentMethod: "cash"
  fulfillmentType: "TAKE_AWAY" | string
  currencyCode: string
  total: string
  customer: {
    id: string
    name: string | null
    phone: string
  }
  items: PublicOrderLineResult[]
  createdAt: string
}

export class PublicOrderRequestError extends Error {
  readonly code: string
  readonly httpStatus: number
  readonly details?: unknown

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    details?: unknown,
  ) {
    super(message)
    this.name = "PublicOrderRequestError"
    this.code = code
    this.httpStatus = httpStatus
    this.details = details
  }
}

/**
 * Pedido de autoservicio / mostrador.
 * `POST /public/businesses/:slug/orders`
 */
export async function createPublicCounterOrder(
  slug: string,
  body: CreatePublicOrderInput,
): Promise<CreatePublicOrderResult> {
  const key = slug.trim()
  if (!key) {
    throw new PublicOrderRequestError(
      "local no disponible",
      "LOCAL_UNAVAILABLE",
      404,
    )
  }

  try {
    const { data } = await publicApi.post<CreatePublicOrderResult>(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(key)}/orders`,
      {
        customer: {
          name: body.customer.name.trim(),
          phone: body.customer.phone.trim(),
        },
        items: body.items,
        fulfillmentType: "TAKE_AWAY",
        paymentMethod: "cash",
        ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
      },
    )
    return data
  } catch (error) {
    throw mapPublicOrderAxiosError(error)
  }
}

/**
 * Seguimiento post-checkout (Fase E).
 * `GET /public/businesses/:slug/orders/:orderId`
 *
 * Misma forma que el POST 201 (`PublicOrderView`). Sin JWT: `orderId` = secreto.
 * 404 `ORDER_NOT_FOUND` | `LOCAL_UNAVAILABLE`.
 * Si el GET falla, el detalle usa el snapshot de localStorage.
 */
export async function fetchPublicOrder(
  slug: string,
  orderId: string,
): Promise<CreatePublicOrderResult> {
  const businessKey = slug.trim()
  const id = orderId.trim()
  if (!businessKey || !id) {
    throw new PublicOrderRequestError(
      "Pedido no encontrado",
      "ORDER_NOT_FOUND",
      404,
    )
  }

  try {
    const { data } = await publicApi.get<CreatePublicOrderResult>(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(businessKey)}/orders/${encodeURIComponent(id)}`,
    )
    return data
  } catch (error) {
    throw mapPublicOrderAxiosError(error)
  }
}

function mapPublicOrderAxiosError(error: unknown): never {
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as {
      error?: string
      code?: string
      details?: unknown
    }
    throw new PublicOrderRequestError(
      typeof data?.error === "string"
        ? data.error
        : "No se pudo procesar el pedido",
      typeof data?.code === "string" ? data.code : "UNKNOWN",
      error.response.status,
      data?.details,
    )
  }
  throw error
}
