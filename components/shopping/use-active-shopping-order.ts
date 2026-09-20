"use client"

import * as React from "react"

import {
  isActiveShoppingOrderStatus,
  clearActiveShoppingOrder,
  readActiveShoppingOrder,
  type StoredShoppingOrder,
} from "./active-order-storage"

/**
 * Pedido activo del storefront (localStorage), sincronizado entre carrito y navbar.
 */
export function useActiveShoppingOrder(slug: string): StoredShoppingOrder | null {
  const [order, setOrder] = React.useState<StoredShoppingOrder | null>(null)

  React.useEffect(() => {
    function sync() {
      const current = readActiveShoppingOrder(slug)
      if (current && !isActiveShoppingOrderStatus(current.status)) {
        clearActiveShoppingOrder(slug)
        setOrder(null)
        return
      }
      setOrder(current)
    }

    sync()

    function onCustom(event: Event) {
      const detail = (event as CustomEvent<{ slug?: string }>).detail
      if (detail?.slug && detail.slug.trim().toLowerCase() !== slug.trim().toLowerCase()) {
        return
      }
      sync()
    }

    window.addEventListener("storage", sync)
    window.addEventListener("gesty:shopping-active-order", onCustom)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("gesty:shopping-active-order", onCustom)
    }
  }, [slug])

  return order
}
