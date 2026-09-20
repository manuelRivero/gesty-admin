import { isAxiosError } from "axios"

import { publicApi } from "@/lib/api"
import { PublicOrderRequestError } from "@/lib/requests/public-orders"
import { PUBLIC_BUSINESSES_PATH } from "@/lib/requests/public-storefront"

export type DeliveryQuoteInput = {
  latitude: number
  longitude: number
  /** Hint para `minOrderMet`; el POST revalida con precios de servidor. */
  itemsSubtotal?: string
}

export type DeliveryQuoteResult = {
  inCoverage: boolean
  deliveryFee: string | null
  minOrderAmount: string | null
  minOrderMet: boolean | null
  estimatedMinutes: number | null
  zoneId: string | null
  zoneName: string | null
}

type DeliveryQuoteRaw = {
  inCoverage?: boolean
  deliveryFee?: string | number | null
  minOrderAmount?: string | number | null
  minOrderMet?: boolean | null
  estimatedMinutes?: number | null
  zoneId?: string | null
  zoneName?: string | null
}

function asDecimalString(v: string | number | null | undefined): string | null {
  if (v == null || v === "") return null
  if (typeof v === "number") {
    return Number.isFinite(v) ? v.toFixed(2) : null
  }
  const trimmed = String(v).trim()
  return trimmed || null
}

function mapQuote(raw: DeliveryQuoteRaw): DeliveryQuoteResult {
  const inCoverage = raw.inCoverage === true
  return {
    inCoverage,
    deliveryFee: asDecimalString(raw.deliveryFee),
    minOrderAmount: asDecimalString(raw.minOrderAmount),
    minOrderMet:
      typeof raw.minOrderMet === "boolean" ? raw.minOrderMet : null,
    estimatedMinutes:
      typeof raw.estimatedMinutes === "number" &&
      Number.isFinite(raw.estimatedMinutes)
        ? raw.estimatedMinutes
        : null,
    zoneId: raw.zoneId?.trim() || null,
    zoneName: raw.zoneName?.trim() || null,
  }
}

/**
 * Preview de cobertura / fee antes de confirmar.
 * `POST /public/businesses/:slug/delivery-quote`
 *
 * Preferencia de contrato: 200 + `inCoverage: false` fuera de zona.
 * También acepta 400 `OUT_OF_COVERAGE` como equivalente.
 */
export async function fetchPublicDeliveryQuote(
  slug: string,
  input: DeliveryQuoteInput,
): Promise<DeliveryQuoteResult> {
  const key = slug.trim()
  if (!key) {
    throw new PublicOrderRequestError(
      "local no disponible",
      "LOCAL_UNAVAILABLE",
      404,
    )
  }

  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude)
  ) {
    throw new PublicOrderRequestError(
      "Ubicación inválida",
      "INVALID_COORDINATES",
      400,
    )
  }

  try {
    const { data } = await publicApi.post<DeliveryQuoteRaw>(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(key)}/delivery-quote`,
      {
        latitude: input.latitude,
        longitude: input.longitude,
        ...(input.itemsSubtotal?.trim()
          ? { itemsSubtotal: input.itemsSubtotal.trim() }
          : {}),
      },
    )
    return mapQuote(data ?? {})
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const data = error.response.data as {
        error?: string
        code?: string
        details?: unknown
        inCoverage?: boolean
      }
      if (
        error.response.status === 400 &&
        (data?.code === "OUT_OF_COVERAGE" || data?.inCoverage === false)
      ) {
        return {
          inCoverage: false,
          deliveryFee: null,
          minOrderAmount: null,
          minOrderMet: null,
          estimatedMinutes: null,
          zoneId: null,
          zoneName: null,
        }
      }
      throw new PublicOrderRequestError(
        typeof data?.error === "string"
          ? data.error
          : "No se pudo cotizar el envío",
        typeof data?.code === "string" ? data.code : "UNKNOWN",
        error.response.status,
        data?.details,
      )
    }
    throw error
  }
}
