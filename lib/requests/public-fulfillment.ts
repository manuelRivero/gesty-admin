import { isAxiosError } from "axios"

import { publicApi } from "@/lib/api"
import { PUBLIC_BUSINESSES_PATH } from "@/lib/requests/public-storefront"

export type PublicMapCenter = {
  latitude: number
  longitude: number
}

export type PublicFulfillment = {
  ordersEnabled: boolean
  checkoutEnabled: boolean
  /** Flota propia + zonas (habilita Envío en la web). */
  deliveryEnabled: boolean
  /**
   * PedidosYa / flota externa. Excluyente con `deliveryEnabled`.
   * No habilita checkout de envío en storefront v1 (ORD-11 D8).
   */
  externalDeliveryEnabled: boolean
  takeawayEnabled: boolean
  pickupInstructions: string | null
  /** Viewport del mapa de destino; nunca es la dirección del cliente. */
  mapCenter: PublicMapCenter | null
}

type PublicFulfillmentRaw = {
  ordersEnabled?: boolean
  checkoutEnabled?: boolean
  deliveryEnabled?: boolean
  takeawayEnabled?: boolean
  externalDeliveryEnabled?: boolean
  orders_enabled?: boolean
  checkout_enabled?: boolean
  delivery_enabled?: boolean
  takeaway_enabled?: boolean
  external_delivery_enabled?: boolean
  pickupInstructions?: string | null
  pickup_instructions?: string | null
  mapCenter?: {
    latitude?: number | null
    longitude?: number | null
  } | null
  map_center?: {
    latitude?: number | null
    longitude?: number | null
  } | null
  location?: {
    latitude?: number | null
    longitude?: number | null
  } | null
}

function asBool(...values: unknown[]): boolean {
  return values.some((v) => v === true)
}

function parseMapCenter(
  raw:
    | { latitude?: number | null; longitude?: number | null }
    | null
    | undefined,
): PublicMapCenter | null {
  const lat = raw?.latitude
  const lng = raw?.longitude
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null
  }
  return { latitude: lat, longitude: lng }
}

export function mapPublicFulfillment(
  raw: PublicFulfillmentRaw,
): PublicFulfillment {
  return {
    ordersEnabled: asBool(raw.ordersEnabled, raw.orders_enabled),
    checkoutEnabled: asBool(raw.checkoutEnabled, raw.checkout_enabled),
    deliveryEnabled: asBool(raw.deliveryEnabled, raw.delivery_enabled),
    externalDeliveryEnabled: asBool(
      raw.externalDeliveryEnabled,
      raw.external_delivery_enabled,
    ),
    takeawayEnabled: asBool(raw.takeawayEnabled, raw.takeaway_enabled),
    pickupInstructions:
      (typeof raw.pickupInstructions === "string"
        ? raw.pickupInstructions
        : null) ??
      (typeof raw.pickup_instructions === "string"
        ? raw.pickup_instructions
        : null),
    mapCenter:
      parseMapCenter(raw.mapCenter) ??
      parseMapCenter(raw.map_center) ??
      parseMapCenter(raw.location),
  }
}

/**
 * Modos de fulfillment del storefront.
 * `GET /public/businesses/:slug/fulfillment`
 */
export async function fetchPublicStorefrontFulfillment(
  slug: string,
): Promise<PublicFulfillment | null> {
  const key = slug.trim()
  if (!key) return null

  try {
    const { data } = await publicApi.get<PublicFulfillmentRaw>(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(key)}/fulfillment`,
    )
    return mapPublicFulfillment(data ?? {})
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * ¿La tienda web ofrece modo Envío?
 * Propio o externo: para el cliente es el mismo canal (zonas + pin).
 * La diferencia es ops: externo no usa flota/`/delivery` del local.
 */
export function offersPublicDelivery(f: Pick<
  PublicFulfillment,
  "deliveryEnabled" | "externalDeliveryEnabled"
>): boolean {
  return f.deliveryEnabled || f.externalDeliveryEnabled
}

/** Fallback si el GET falla: mismo comportamiento takeaway-only de hoy. */
export const DEFAULT_PUBLIC_FULFILLMENT: PublicFulfillment = {
  ordersEnabled: true,
  checkoutEnabled: true,
  deliveryEnabled: false,
  externalDeliveryEnabled: false,
  takeawayEnabled: true,
  pickupInstructions: null,
  mapCenter: null,
}
