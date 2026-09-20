"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import {
  fetchPublicOrder,
  PublicOrderRequestError,
  type CreatePublicOrderResult,
} from "@/lib/requests/public-orders"

import {
  clearActiveShoppingOrder,
  isTerminalShoppingOrderStatus,
  readActiveShoppingOrder,
  writeActiveShoppingOrder,
} from "./active-order-storage"
import { OrderPushOptIn } from "./order-push-opt-in"
import { OrderStatusTracker } from "./order-status-tracker"

const POLL_MS = 8_000

type ShoppingOrderDetailProps = {
  slug: string
  orderId: string
}

export function ShoppingOrderDetail({
  slug,
  orderId,
}: ShoppingOrderDetailProps) {
  const [order, setOrder] = React.useState<CreatePublicOrderResult | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [live, setLive] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    let stopPolling = false

    async function load(initial: boolean) {
      if (initial) setLoading(true)

      const cached = readActiveShoppingOrder(slug)
      const cachedMatch =
        cached && cached.orderId === orderId ? cached : null

      try {
        const remote = await fetchPublicOrder(slug, orderId)
        if (cancelled) return
        setOrder(remote)
        setLive(true)
        setError(null)
        if (isTerminalShoppingOrderStatus(remote.status)) {
          clearActiveShoppingOrder(slug)
          stopPolling = true
        } else {
          writeActiveShoppingOrder(slug, remote)
        }
      } catch (err) {
        if (cancelled) return
        if (cachedMatch) {
          setOrder(cachedMatch)
          setLive(false)
          setError(null)
        } else if (err instanceof PublicOrderRequestError) {
          setError(err.message)
        } else {
          setError("No se pudo cargar el pedido.")
        }
      } finally {
        if (!cancelled && initial) setLoading(false)
      }
    }

    void load(true)
    const timer = window.setInterval(() => {
      if (stopPolling) {
        window.clearInterval(timer)
        return
      }
      void load(false)
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [slug, orderId])

  if (loading && !order) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
        <p className="text-muted-foreground text-sm">Cargando tu pedido…</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Pedido no encontrado
        </h1>
        <p className="text-muted-foreground text-sm">
          {error ?? "No tenemos datos de este pedido en este dispositivo."}
        </p>
        <Button type="button" variant="outline" asChild>
          <Link href={`/shopping/${encodeURIComponent(slug)}`}>
            Volver al menú
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-background mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="bg-background/95 sticky top-0 z-20 border-b backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 px-3 py-3">
          <Button type="button" variant="ghost" size="icon" asChild>
            <Link
              href={`/shopping/${encodeURIComponent(slug)}`}
              aria-label="Volver al menú"
            >
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Tu pedido
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              {order.customer.name?.trim() || "Cliente"}
              {!live ? " · estado local" : null}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-6 px-4 py-5 pb-10">
        <OrderStatusTracker
          status={order.status}
          fulfillmentType={order.fulfillmentType}
        />

        <OrderPushOptIn
          slug={slug}
          orderId={orderId}
          status={order.status}
          fulfillmentType={order.fulfillmentType}
        />

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Resumen</h2>
          <ul className="divide-y rounded-lg border">
            {order.items.map((item) => (
              <li
                key={`${item.menuItemId}-${item.variation ?? ""}`}
                className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.quantity}× {item.name}
                  </p>
                  {item.variation ? (
                    <p className="text-muted-foreground text-xs">
                      {item.variation}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 tabular-nums">
                  {formatMenuItemPrice(item.lineTotal, order.currencyCode)}
                </span>
              </li>
            ))}
          </ul>
          {order.deliveryFee ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Envío</span>
              <span className="tabular-nums">
                {formatMenuItemPrice(order.deliveryFee, order.currencyCode)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">
              {formatMenuItemPrice(order.total, order.currencyCode)}
            </span>
          </div>
          {order.address?.streetAddress ? (
            <div className="rounded-lg border px-3 py-2.5 text-sm">
              <p className="font-medium">Entrega en</p>
              <p className="text-muted-foreground mt-0.5">
                {[order.address.streetAddress, order.address.apartment]
                  .filter(Boolean)
                  .join(", ")}
                {order.address.city ? ` · ${order.address.city}` : null}
              </p>
              {order.address.instructions ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {order.address.instructions}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {order.fulfillmentType?.toUpperCase() === "DELIVERY"
              ? "Pagás al recibir. Seguí el estado acá."
              : "Te vamos a llamar por tu nombre cuando esté listo."}
          </p>
        </section>

        <Separator />

        <Button type="button" variant="outline" className="w-full" asChild>
          <Link href={`/shopping/${encodeURIComponent(slug)}`}>
            Volver al menú
          </Link>
        </Button>
      </main>
    </div>
  )
}
