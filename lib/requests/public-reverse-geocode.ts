import { isAxiosError } from "axios"

import { publicApi } from "@/lib/api"
import { PublicOrderRequestError } from "@/lib/requests/public-orders"
import { PUBLIC_BUSINESSES_PATH } from "@/lib/requests/public-storefront"

export type PublicReverseGeocodeInput = {
  latitude: number
  longitude: number
}

export type PublicReverseGeocodeResult = {
  streetAddress: string | null
  neighborhood: string | null
  city: string | null
  formatted: string | null
  latitude: number
  longitude: number
  provider: string | null
  confidence: string | null
}

type ReverseGeocodeRaw = {
  streetAddress?: string | null
  neighborhood?: string | null
  city?: string | null
  formatted?: string | null
  latitude?: number
  longitude?: number
  provider?: string | null
  confidence?: string | null
}

function asOptionalText(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function mapResult(
  raw: ReverseGeocodeRaw,
  fallback: PublicReverseGeocodeInput,
): PublicReverseGeocodeResult {
  return {
    streetAddress: asOptionalText(raw.streetAddress),
    neighborhood: asOptionalText(raw.neighborhood),
    city: asOptionalText(raw.city),
    formatted: asOptionalText(raw.formatted),
    latitude:
      typeof raw.latitude === "number" && Number.isFinite(raw.latitude)
        ? raw.latitude
        : fallback.latitude,
    longitude:
      typeof raw.longitude === "number" && Number.isFinite(raw.longitude)
        ? raw.longitude
        : fallback.longitude,
    provider: asOptionalText(raw.provider),
    confidence: asOptionalText(raw.confidence),
  }
}

/**
 * Pin → textos de dirección (autofill UX).
 * `POST /public/businesses/:slug/reverse-geocode`
 *
 * `streetAddress: null` no es error: el front pide tipeo manual.
 */
export async function fetchPublicReverseGeocode(
  slug: string,
  input: PublicReverseGeocodeInput,
): Promise<PublicReverseGeocodeResult> {
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
    const { data } = await publicApi.post<ReverseGeocodeRaw>(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(key)}/reverse-geocode`,
      {
        latitude: input.latitude,
        longitude: input.longitude,
      },
    )
    return mapResult(data ?? {}, input)
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const data = error.response.data as {
        error?: string
        code?: string
        details?: unknown
      }
      throw new PublicOrderRequestError(
        typeof data?.error === "string"
          ? data.error
          : "No se pudo obtener la dirección",
        typeof data?.code === "string" ? data.code : "UNKNOWN",
        error.response.status,
        data?.details,
      )
    }
    throw error
  }
}
