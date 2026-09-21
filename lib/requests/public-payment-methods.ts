import { isAxiosError } from "axios"

import { publicApi } from "@/lib/api"
import { PUBLIC_BUSINESSES_PATH } from "@/lib/requests/public-storefront"

/** Métodos que el storefront puede enviar en POST orders (PAY-06). */
export type PublicStorefrontPaymentMethodId = "cash" | "online"

export type PublicCollectionMode =
  | "pay_at_counter"
  | "pay_online"
  | "pay_at_counter_or_online"

export type PublicPaymentMethod = {
  id: string
  paymentMethod: string
  label: string
  adjustmentType: string
  adjustmentValue: number
  isSurcharge: boolean
  instructions: string | null
  sortOrder: number
}

export type PublicPaymentMethodsResult = {
  paymentMethods: PublicPaymentMethod[]
  collectionMode: PublicCollectionMode
}

type PublicPaymentMethodRaw = {
  id?: string
  paymentMethod?: string | null
  payment_method?: string | null
  label?: string | null
  adjustmentType?: string | null
  adjustment_type?: string | null
  adjustmentValue?: string | number | null
  adjustment_value?: string | number | null
  isSurcharge?: boolean | null
  is_surcharge?: boolean | null
  instructions?: string | null
  sortOrder?: number | null
  sort_order?: number | null
}

type PublicPaymentMethodsRaw = {
  paymentMethods?: PublicPaymentMethodRaw[] | null
  payment_methods?: PublicPaymentMethodRaw[] | null
  collectionMode?: string | null
  collection_mode?: string | null
}

function parseAdjustmentValue(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (v == null || v === "") return 0
  const n = Number.parseFloat(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function mapMethod(raw: PublicPaymentMethodRaw): PublicPaymentMethod | null {
  const paymentMethod = (
    raw.paymentMethod ??
    raw.payment_method ??
    ""
  )
    .trim()
    .toLowerCase()
  if (paymentMethod !== "cash" && paymentMethod !== "online") return null

  const label = raw.label?.trim() || (paymentMethod === "online" ? "Pago online" : "Efectivo")
  return {
    id: String(raw.id ?? paymentMethod),
    paymentMethod,
    label,
    adjustmentType: String(raw.adjustmentType ?? raw.adjustment_type ?? "NONE"),
    adjustmentValue: parseAdjustmentValue(
      raw.adjustmentValue ?? raw.adjustment_value,
    ),
    isSurcharge: Boolean(raw.isSurcharge ?? raw.is_surcharge),
    instructions:
      typeof raw.instructions === "string" ? raw.instructions : null,
    sortOrder:
      typeof (raw.sortOrder ?? raw.sort_order) === "number"
        ? Number(raw.sortOrder ?? raw.sort_order)
        : 0,
  }
}

function mapCollectionMode(raw: string | null | undefined): PublicCollectionMode {
  const mode = (raw ?? "").trim().toLowerCase()
  if (mode === "pay_online") return "pay_online"
  if (mode === "pay_at_counter_or_online") return "pay_at_counter_or_online"
  return "pay_at_counter"
}

export function mapPublicPaymentMethods(
  raw: PublicPaymentMethodsRaw,
): PublicPaymentMethodsResult {
  const list = (raw.paymentMethods ?? raw.payment_methods ?? [])
    .map(mapMethod)
    .filter((m): m is PublicPaymentMethod => Boolean(m))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))

  return {
    paymentMethods: list,
    collectionMode: mapCollectionMode(
      raw.collectionMode ?? raw.collection_mode,
    ),
  }
}

/** Solo cash/online ofrecidos por el GET (nunca transfer). */
export function storefrontSelectableMethods(
  result: PublicPaymentMethodsResult,
): PublicPaymentMethod[] {
  return result.paymentMethods.filter(
    (m) => m.paymentMethod === "cash" || m.paymentMethod === "online",
  )
}

export function isPublicStorefrontPaymentMethodId(
  value: string,
): value is PublicStorefrontPaymentMethodId {
  return value === "cash" || value === "online"
}

/**
 * Métodos de cobro del storefront.
 * `GET /public/businesses/:slug/payment-methods`
 */
export async function fetchPublicPaymentMethods(
  slug: string,
): Promise<PublicPaymentMethodsResult | null> {
  const key = slug.trim()
  if (!key) return null

  try {
    const { data } = await publicApi.get<PublicPaymentMethodsRaw>(
      `${PUBLIC_BUSINESSES_PATH}/${encodeURIComponent(key)}/payment-methods`,
    )
    return mapPublicPaymentMethods(data ?? {})
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null
    }
    throw error
  }
}

/** Fallback si el GET falla: mismo comportamiento cash-only de hoy. */
export const DEFAULT_PUBLIC_PAYMENT_METHODS: PublicPaymentMethodsResult = {
  paymentMethods: [
    {
      id: "cash",
      paymentMethod: "cash",
      label: "Efectivo",
      adjustmentType: "NONE",
      adjustmentValue: 0,
      isSurcharge: false,
      instructions: null,
      sortOrder: 0,
    },
  ],
  collectionMode: "pay_at_counter",
}
