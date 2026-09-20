import { isAxiosError } from "axios"

import { publicApi } from "@/lib/api"
import { PUBLIC_BUSINESSES_PATH } from "@/lib/requests/public-storefront"

export type PublicOrderLineInput = {
  menuItemId: string
  quantity: number
  variation?: string | null
  notes?: string | null
}

export type PublicFulfillmentType = "TAKE_AWAY" | "DELIVERY"

export type PublicDeliveryAddressInput = {
  latitude: number
  longitude: number
  streetAddress: string
  apartment?: string | null
  neighborhood?: string | null
  city?: string | null
  instructions?: string | null
}

export type CreatePublicOrderInput = {
  customer: {
    name: string
    phone: string
  }
  items: PublicOrderLineInput[]
  fulfillmentType?: PublicFulfillmentType
  paymentMethod?: "cash"
  notes?: string | null
  /** Obligatorio si `fulfillmentType === "DELIVERY"`. */
  address?: PublicDeliveryAddressInput
}

export type PublicOrderAddressView = {
  streetAddress: string | null
  apartment: string | null
  neighborhood: string | null
  city: string | null
  instructions: string | null
  latitude: number | null
  longitude: number | null
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
  fulfillmentType: PublicFulfillmentType | string
  currencyCode: string
  total: string
  /** Fee de envío cuando el backend lo expone (DELIVERY). */
  deliveryFee?: string | null
  address?: PublicOrderAddressView | null
  estimatedMinutes?: number | null
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
 * Pedido storefront (retiro o envío).
 * `POST /public/businesses/:slug/orders`
 *
 * El total del 201 manda (revalidación server-side del fee).
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

  const fulfillmentType: PublicFulfillmentType =
    body.fulfillmentType === "DELIVERY" ? "DELIVERY" : "TAKE_AWAY"

  if (fulfillmentType === "DELIVERY") {
    const address = body.address
    if (
      !address ||
      !Number.isFinite(address.latitude) ||
      !Number.isFinite(address.longitude) ||
      !address.streetAddress?.trim()
    ) {
      throw new PublicOrderRequestError(
        "Completá la dirección de entrega",
        "INVALID_ADDRESS",
        400,
      )
    }
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
        fulfillmentType,
        paymentMethod: "cash",
        ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
        ...(fulfillmentType === "DELIVERY" && body.address
          ? {
              address: {
                latitude: body.address.latitude,
                longitude: body.address.longitude,
                streetAddress: body.address.streetAddress.trim(),
                ...(body.address.apartment?.trim()
                  ? { apartment: body.address.apartment.trim() }
                  : { apartment: null }),
                ...(body.address.neighborhood?.trim()
                  ? { neighborhood: body.address.neighborhood.trim() }
                  : { neighborhood: null }),
                ...(body.address.city?.trim()
                  ? { city: body.address.city.trim() }
                  : {}),
                ...(body.address.instructions?.trim()
                  ? { instructions: body.address.instructions.trim() }
                  : { instructions: null }),
              },
            }
          : {}),
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
