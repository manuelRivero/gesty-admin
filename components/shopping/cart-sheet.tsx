"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import {
  createPublicCounterOrder,
  PublicOrderRequestError,
  type CreatePublicOrderResult,
} from "@/lib/requests/public-orders"

import { writeActiveShoppingOrder } from "./active-order-storage"
import {
  toCustomerContactPayload,
  validateCustomerContact,
  type ShoppingCustomerContactErrors,
} from "./customer-contact"
import { useShoppingCart } from "./shopping-cart-context"
import type { ShoppingProduct } from "./types"

type CartSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ShoppingProduct[]
  /** Slug o UUID de la URL (`/shopping/[slug]`). */
  slug: string
}

export function CartSheet({
  open,
  onOpenChange,
  products,
  slug,
}: CartSheetProps) {
  const {
    lines,
    itemCount,
    customerName,
    customerPhone,
    setCustomerName,
    setCustomerPhone,
    isContactValid,
    getCustomerContact,
    increment,
    decrement,
    remove,
    clear,
    getLineTotal,
    getSubtotal,
  } = useShoppingCart()

  const [touched, setTouched] = React.useState({ name: false, phone: false })
  const [attemptedSubmit, setAttemptedSubmit] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [placedOrder, setPlacedOrder] =
    React.useState<CreatePublicOrderResult | null>(null)

  const byId = new Map(products.map((p) => [p.id, p]))
  const resolved = lines
    .map((line) => {
      const product = byId.get(line.productId)
      if (!product) return null
      return { line, product }
    })
    .filter((entry): entry is { line: (typeof lines)[number]; product: ShoppingProduct } =>
      Boolean(entry),
    )

  const subtotal = getSubtotal(products)
  const errors: ShoppingCustomerContactErrors = validateCustomerContact({
    name: customerName,
    phone: customerPhone,
  })
  const showNameError = (touched.name || attemptedSubmit) && errors.name
  const showPhoneError = (touched.phone || attemptedSubmit) && errors.phone
  const canConfirm =
    resolved.length > 0 && isContactValid && !submitting && !placedOrder

  async function handleConfirm() {
    setAttemptedSubmit(true)
    if (!isContactValid || submitting || resolved.length === 0) return

    setSubmitting(true)
    try {
      const customer = toCustomerContactPayload(getCustomerContact())
      const order = await createPublicCounterOrder(slug, {
        customer,
        items: resolved.map(({ line, product }) => ({
          menuItemId: product.id,
          quantity: line.quantity,
        })),
        fulfillmentType: "TAKE_AWAY",
        paymentMethod: "cash",
      })
      clear()
      writeActiveShoppingOrder(slug, order)
      setPlacedOrder(order)
      toast.success("Pedido enviado", {
        description: "Seguí el estado desde el ícono de pedidos.",
      })
    } catch (error) {
      const message =
        error instanceof PublicOrderRequestError
          ? error.message
          : "No se pudo crear el pedido. Intentá de nuevo."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && placedOrder) {
      setPlacedOrder(null)
      setAttemptedSubmit(false)
      setTouched({ name: false, phone: false })
    }
    onOpenChange(next)
  }

  function handleNewOrder() {
    setPlacedOrder(null)
    setAttemptedSubmit(false)
    setTouched({ name: false, phone: false })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col gap-0 rounded-t-2xl p-0"
      >
        {placedOrder ? (
          <>
            <SheetHeader className="border-b px-4 pt-4 pb-3">
              <SheetTitle>Pedido recibido</SheetTitle>
              <SheetDescription>
                Retiro en mostrador · pagás en efectivo
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-6 py-8 text-center">
              <CheckCircle2 className="text-foreground size-12" />
              <div className="space-y-1">
                <p className="text-lg font-semibold tracking-tight">
                  {placedOrder.customer.name?.trim() || "Listo"}
                </p>
                <p className="text-muted-foreground text-sm">
                  Te van a llamar por tu nombre en el mostrador.
                </p>
              </div>
              <div className="bg-muted/50 w-full space-y-2 rounded-lg px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">
                    {formatMenuItemPrice(
                      placedOrder.total,
                      placedOrder.currencyCode,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Pedido</span>
                  <span className="font-mono text-xs tabular-nums">
                    {placedOrder.orderId.slice(0, 8)}…
                  </span>
                </div>
              </div>
            </div>
            <SheetFooter className="border-t gap-2 p-4">
              <Button type="button" size="lg" className="w-full" asChild>
                <Link
                  href={`/shopping/${encodeURIComponent(slug)}/order/${encodeURIComponent(placedOrder.orderId)}`}
                >
                  Ver estado del pedido
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleNewOrder}
              >
                Seguir mirando el menú
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader className="border-b px-4 pt-4 pb-3">
              <SheetTitle>Tu pedido</SheetTitle>
              <SheetDescription>
                {itemCount === 0
                  ? "Todavía no agregaste productos."
                  : `${itemCount} ${itemCount === 1 ? "producto" : "productos"} · retiro en mostrador`}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {resolved.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center gap-3 py-10 text-center text-sm">
                  <ShoppingBag className="size-10 opacity-40" />
                  <p>Explorá el menú y agregá lo que quieras pedir.</p>
                </div>
              ) : (
                <>
                  <ul className="divide-y">
                    {resolved.map(({ line, product }) => (
                      <li key={product.id} className="flex gap-3 py-3">
                        <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-md">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {product.name}
                              </p>
                              <p className="text-muted-foreground text-sm tabular-nums">
                                {formatMenuItemPrice(
                                  getLineTotal(product, line.quantity),
                                  product.currencyCode,
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Eliminar del carrito"
                              disabled={submitting}
                              onClick={() => remove(product.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <div className="bg-background inline-flex items-center gap-1 rounded-md border">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Quitar uno"
                              disabled={submitting}
                              onClick={() => decrement(product.id)}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="min-w-6 text-center text-sm font-medium tabular-nums">
                              {line.quantity}
                            </span>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Agregar uno"
                              disabled={submitting}
                              onClick={() => increment(product.id)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-3 border-t pt-4 pb-2">
                    <p className="text-sm font-medium">Tus datos</p>
                    <p className="text-muted-foreground text-xs">
                      Los usamos para llamarte en el mostrador y contactarte por
                      tu pedido.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="shopping-customer-name">Nombre</Label>
                      <Input
                        id="shopping-customer-name"
                        name="customerName"
                        autoComplete="name"
                        placeholder="Ej. María"
                        value={customerName}
                        disabled={submitting}
                        aria-invalid={Boolean(showNameError)}
                        onChange={(e) => setCustomerName(e.target.value)}
                        onBlur={() =>
                          setTouched((prev) => ({ ...prev, name: true }))
                        }
                      />
                      {showNameError ? (
                        <p className="text-destructive text-xs">
                          {errors.name}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="shopping-customer-phone">Teléfono</Label>
                      <Input
                        id="shopping-customer-phone"
                        name="customerPhone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Ej. 099 123 456"
                        value={customerPhone}
                        disabled={submitting}
                        aria-invalid={Boolean(showPhoneError)}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        onBlur={() =>
                          setTouched((prev) => ({ ...prev, phone: true }))
                        }
                      />
                      {showPhoneError ? (
                        <p className="text-destructive text-xs">
                          {errors.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>

            {resolved.length > 0 ? (
              <SheetFooter className="border-t bg-background gap-3 p-4">
                <div className="flex w-full items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">
                    {formatMenuItemPrice(
                      subtotal,
                      resolved[0]?.product.currencyCode ?? "UYU",
                    )}
                  </span>
                </div>
                <Separator />
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={!canConfirm}
                  onClick={() => void handleConfirm()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    "Confirmar pedido"
                  )}
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  {!isContactValid
                    ? "Completá nombre y teléfono para continuar."
                    : "Retiro en mostrador · pagás en efectivo al retirar."}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={submitting}
                  onClick={clear}
                >
                  Vaciar carrito
                </Button>
              </SheetFooter>
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
