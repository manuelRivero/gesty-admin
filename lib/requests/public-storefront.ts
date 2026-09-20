import { cache } from "react"
import { isAxiosError } from "axios"

import type {
  ShoppingBusiness,
  ShoppingCatalog,
  ShoppingCategory,
  ShoppingProduct,
} from "@/components/shopping/types"
import { publicApi } from "@/lib/api"
import { resolveMenuItemImageUrl } from "@/lib/menu-item-image"

/** Relativo a `NEXT_PUBLIC_API` (si ya incluye `/api` → `/public/...`). */
export const PUBLIC_BUSINESSES_PATH = "/public/businesses"

export class PublicStorefrontNotFoundError extends Error {
  constructor(message = "local no disponible") {
    super(message)
    this.name = "PublicStorefrontNotFoundError"
  }
}

type PublicLocationRaw = {
  latitude?: number | null
  longitude?: number | null
}

type PublicBusinessRaw = {
  id?: string
  name?: string | null
  description?: string | null
  tagline?: string | null
  slug?: string | null
  currencyCode?: string | null
  currency_code?: string | null
  isActive?: boolean
  isOpen?: boolean
  nextOpenText?: string | null
  imageUrl?: string | null
  latitude?: number | null
  longitude?: number | null
  location?: PublicLocationRaw | null
  mapCenter?: PublicLocationRaw | null
}

type PublicCategoryRaw = {
  id?: string
  name?: string | null
  tag?: string | null
  position?: number | null
}

type PublicMenuItemDiscountRaw = {
  discountType?: string | null
  discountValue?: string | number | null
  finalPrice?: string | number | null
}

type PublicMenuItemRaw = {
  id?: string
  name?: string | null
  description?: string | null
  price?: string | number | null
  currencyCode?: string | null
  imageUrl?: string | null
  imageKey?: string | null
  image_key?: string | null
  categoryId?: string | null
  available?: boolean
  featured?: boolean
  variations?: string[] | null
  discount?: PublicMenuItemDiscountRaw | null
  servesPeople?: number | null
  serves_people?: number | null
  ingredients?: string | null
  ingredientsNotes?: string | null
  ingredients_notes?: string | null
  preparation?: string | null
}

type PublicMenuResponseRaw = {
  business?: PublicBusinessRaw | null
  categories?: PublicCategoryRaw[] | null
  items?: PublicMenuItemRaw[] | null
}

function parseDecimal(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const n = parseFloat(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : null
}

function parseMapCenter(
  raw: PublicLocationRaw | null | undefined,
  fallbackLat?: number | null,
  fallbackLng?: number | null,
): ShoppingBusiness["mapCenter"] {
  const lat = raw?.latitude ?? fallbackLat
  const lng = raw?.longitude ?? fallbackLng
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

function mapBusiness(raw: PublicBusinessRaw): ShoppingBusiness {
  const tagline =
    (typeof raw.tagline === "string" && raw.tagline.trim()) ||
    (typeof raw.description === "string" && raw.description.trim()) ||
    null

  return {
    id: String(raw.id ?? ""),
    slug: raw.slug?.trim() || null,
    name: String(raw.name ?? "Local").trim() || "Local",
    tagline,
    currencyCode: (raw.currencyCode ?? raw.currency_code)?.trim() || "UYU",
    isOpen: typeof raw.isOpen === "boolean" ? raw.isOpen : undefined,
    nextOpenText: raw.nextOpenText ?? null,
    mapCenter:
      parseMapCenter(raw.mapCenter) ??
      parseMapCenter(raw.location) ??
      parseMapCenter(undefined, raw.latitude, raw.longitude),
  }
}

function mapCategory(raw: PublicCategoryRaw): ShoppingCategory | null {
  const id = raw.id?.trim()
  const name = raw.name?.trim()
  if (!id || !name) return null
  return {
    id,
    name,
    tag: raw.tag?.trim() || "SPECIAL",
    position: typeof raw.position === "number" ? raw.position : 0,
  }
}

function toTrimmedOrNull(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : ""
  return t.length > 0 ? t : null
}

function mapVariations(raw: PublicMenuItemRaw): string[] | null {
  const v = raw.variations
  if (!Array.isArray(v) || v.length === 0) return null
  const items = v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
  return items.length > 0 ? items : null
}

function mapServesPeople(raw: PublicMenuItemRaw): number | null {
  const n = raw.servesPeople ?? raw.serves_people
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null
}

function mapProduct(
  raw: PublicMenuItemRaw,
  fallbackCurrency: string,
): ShoppingProduct | null {
  const id = raw.id?.trim()
  const name = raw.name?.trim()
  const categoryId = raw.categoryId?.trim()
  if (!id || !name || !categoryId) return null

  const listPrice = parseDecimal(raw.price)
  const finalFromDiscount = parseDecimal(raw.discount?.finalPrice)
  const price = finalFromDiscount ?? listPrice
  if (price == null) return null

  return {
    id,
    name,
    description: toTrimmedOrNull(raw.description),
    price,
    currencyCode: raw.currencyCode?.trim() || fallbackCurrency,
    imageUrl: resolveMenuItemImageUrl({
      imageUrl: raw.imageUrl,
      imageKey: raw.imageKey ?? raw.image_key,
    }),
    categoryId,
    available: raw.available !== false,
    servesPeople: mapServesPeople(raw),
    ingredients: toTrimmedOrNull(raw.ingredients),
    ingredientsNotes: toTrimmedOrNull(
      raw.ingredientsNotes ?? raw.ingredients_notes,
    ),
    preparation: toTrimmedOrNull(raw.preparation),
    variations: mapVariations(raw),
  }
}

export function mapPublicMenuToCatalog(
  raw: PublicMenuResponseRaw,
): ShoppingCatalog {
  if (!raw.business?.id) {
    throw new PublicStorefrontNotFoundError()
  }

  const business = mapBusiness(raw.business)
  const categories = (raw.categories ?? [])
    .map(mapCategory)
    .filter((c): c is ShoppingCategory => Boolean(c))
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name),
    )

  const products = (raw.items ?? [])
    .map((item) => mapProduct(item, business.currencyCode))
    .filter((p): p is ShoppingProduct => Boolean(p))

  return { business, categories, products }
}

async function fetchPublicStorefrontMenuUncached(
  slug: string,
  options?: { availableOnly?: boolean },
): Promise<ShoppingCatalog> {
  const key = slug.trim()
  if (!key) throw new PublicStorefrontNotFoundError()

  try {
    const { data } = await publicApi.get<PublicMenuResponseRaw>(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(key)}/menu`,
      {
        params: {
          availableOnly:
            options?.availableOnly === false ? "false" : "true",
        },
      },
    )
    return mapPublicMenuToCatalog(data)
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      const message =
        typeof error.response.data?.error === "string"
          ? error.response.data.error
          : "local no disponible"
      throw new PublicStorefrontNotFoundError(message)
    }
    throw error
  }
}

/**
 * Menú unificado del storefront.
 * `GET /public/businesses/:slug/menu`
 * Deduplicado por request (metadata + page).
 */
export const fetchPublicStorefrontMenu = cache(
  async (slug: string, availableOnly = true): Promise<ShoppingCatalog> =>
    fetchPublicStorefrontMenuUncached(slug, { availableOnly }),
)

export async function fetchPublicStorefrontProfile(
  slug: string,
): Promise<ShoppingBusiness> {
  const key = slug.trim()
  if (!key) throw new PublicStorefrontNotFoundError()

  try {
    const { data } = await publicApi.get<PublicBusinessRaw>(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(key)}`,
    )
    if (!data?.id) throw new PublicStorefrontNotFoundError()
    return mapBusiness(data)
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      throw new PublicStorefrontNotFoundError()
    }
    throw error
  }
}
