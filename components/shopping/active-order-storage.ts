import type { CreatePublicOrderResult } from "@/lib/requests/public-orders"

const STORAGE_PREFIX = "gesty.shopping.activeOrder.v1:"

export type StoredShoppingOrder = CreatePublicOrderResult & {
  slug: string
  savedAt: string
}

export function isTerminalShoppingOrderStatus(status: string): boolean {
  const s = status.trim().toLowerCase()
  return s === "delivered" || s === "cancelled"
}

/** Pedido que aún conviene mostrar en el ícono de la navbar. */
export function isActiveShoppingOrderStatus(status: string): boolean {
  return !isTerminalShoppingOrderStatus(status)
}

function storageKey(slug: string): string {
  return `${STORAGE_PREFIX}${slug.trim().toLowerCase()}`
}

export function readActiveShoppingOrder(
  slug: string,
): StoredShoppingOrder | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(storageKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredShoppingOrder
    if (!parsed?.orderId || !parsed?.status) return null
    return parsed
  } catch {
    return null
  }
}

export function writeActiveShoppingOrder(
  slug: string,
  order: CreatePublicOrderResult,
): StoredShoppingOrder {
  const stored: StoredShoppingOrder = {
    ...order,
    slug: slug.trim(),
    savedAt: new Date().toISOString(),
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(slug), JSON.stringify(stored))
    window.dispatchEvent(
      new CustomEvent("gesty:shopping-active-order", {
        detail: { slug: slug.trim(), order: stored },
      }),
    )
  }
  return stored
}

export function clearActiveShoppingOrder(slug: string): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(storageKey(slug))
  window.dispatchEvent(
    new CustomEvent("gesty:shopping-active-order", {
      detail: { slug: slug.trim(), order: null },
    }),
  )
}
