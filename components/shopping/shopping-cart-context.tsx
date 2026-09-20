"use client"

import * as React from "react"

import {
  isCustomerContactValid,
  type ShoppingCustomerContact,
} from "./customer-contact"
import type { CartLine, ShoppingProduct } from "./types"

type CartContextValue = {
  lines: CartLine[]
  itemCount: number
  customerName: string
  customerPhone: string
  setCustomerName: (name: string) => void
  setCustomerPhone: (phone: string) => void
  isContactValid: boolean
  getCustomerContact: () => ShoppingCustomerContact
  getQuantity: (productId: string) => number
  addProduct: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  increment: (productId: string) => void
  decrement: (productId: string) => void
  remove: (productId: string) => void
  clear: () => void
  getLineTotal: (product: ShoppingProduct, quantity: number) => number
  getSubtotal: (products: ShoppingProduct[]) => number
}

const CartContext = React.createContext<CartContextValue | null>(null)

function upsertLine(prev: CartLine[], productId: string, quantity: number): CartLine[] {
  if (quantity <= 0) {
    return prev.filter((line) => line.productId !== productId)
  }
  const existing = prev.find((line) => line.productId === productId)
  if (existing) {
    return prev.map((line) =>
      line.productId === productId ? { ...line, quantity } : line,
    )
  }
  return [...prev, { productId, quantity }]
}

export function ShoppingCartProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [lines, setLines] = React.useState<CartLine[]>([])
  const [customerName, setCustomerName] = React.useState("")
  const [customerPhone, setCustomerPhone] = React.useState("")

  function getCustomerContact(): ShoppingCustomerContact {
    return { name: customerName, phone: customerPhone }
  }

  const isContactValid = isCustomerContactValid(getCustomerContact())

  function getQuantity(productId: string) {
    return lines.find((line) => line.productId === productId)?.quantity ?? 0
  }

  function setQuantity(productId: string, quantity: number) {
    setLines((prev) => upsertLine(prev, productId, quantity))
  }

  function addProduct(productId: string) {
    setLines((prev) => {
      const current =
        prev.find((line) => line.productId === productId)?.quantity ?? 0
      return upsertLine(prev, productId, current + 1)
    })
  }

  function increment(productId: string) {
    addProduct(productId)
  }

  function decrement(productId: string) {
    setLines((prev) => {
      const current =
        prev.find((line) => line.productId === productId)?.quantity ?? 0
      return upsertLine(prev, productId, current - 1)
    })
  }

  function remove(productId: string) {
    setLines((prev) => prev.filter((line) => line.productId !== productId))
  }

  function clear() {
    setLines([])
  }

  function getLineTotal(product: ShoppingProduct, quantity: number) {
    return product.price * quantity
  }

  function getSubtotal(products: ShoppingProduct[]) {
    const byId = new Map(products.map((p) => [p.id, p]))
    return lines.reduce((sum, line) => {
      const product = byId.get(line.productId)
      if (!product) return sum
      return sum + product.price * line.quantity
    }, 0)
  }

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        lines,
        itemCount,
        customerName,
        customerPhone,
        setCustomerName,
        setCustomerPhone,
        isContactValid,
        getCustomerContact,
        getQuantity,
        addProduct,
        setQuantity,
        increment,
        decrement,
        remove,
        clear,
        getLineTotal,
        getSubtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useShoppingCart() {
  const ctx = React.useContext(CartContext)
  if (!ctx) {
    throw new Error("useShoppingCart must be used within ShoppingCartProvider")
  }
  return ctx
}
