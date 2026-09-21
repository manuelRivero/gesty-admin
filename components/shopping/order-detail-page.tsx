"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import {
  createPublicOrderCheckout,
  fetchPublicOrder,
  PublicOrderRequestError,
  type CreatePublicOrderResult,
} from "@/lib/requests/public-orders"
import { cn } from "@/lib/utils"

import {
  clearActiveShoppingOrder,
  isTerminalShoppingOrderStatus,
  readActiveShoppingOrder,
  writeActiveShoppingOrder,
} from "./active-order-storage"
import { OrderPushOptIn } from "./order-push-opt-in"
import { OrderStatusTracker } from "./order-status-tracker"

const POLL_MS = 8_000
/** Mientras online sigue unpaid, poll más seguido para captar el webhook. */
const PAYMENT_POLL_MS = 4_000

type ShoppingOrderDetailProps = {
  slug: string
  orderId: string
}

function isOnlineUnpaid(order: CreatePublicOrderResult): boolean {
  return (
    order.paymentMethod?.trim().toLowerCase() === "online" &&
    order.paymentStatus?.trim().toLowerCase() !== "paid"
  )
}

function isPaid(order: CreatePublicOrderResult): boolean {
  return order.paymentStatus?.trim().toLowerCase() === "paid"
}

export function ShoppingOrderDetail({
  slug,
  orderId,
}: ShoppingOrderDetailProps) {
  const searchParams = useSearchParams()
  const paymentReturn = searchParams.get("payment")?.trim().toLowerCase() ?? null

  const [order, setOrder] = React.useState<CreatePublicOrderResult | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [live, setLive] = React.useState(false)
  const [checkoutLoading, setCheckoutLoading] = React.useState(false)
  const stopPollingRef = React.useRef(false)
  const needsPaymentPollRef = React.useRef(Boolean(paymentReturn))

  React.useEffect(() => {
    let cancelled = false
    stopPollingRef.current = false
    needsPaymentPollRef.current = Boolean(paymentReturn)

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
        needsPaymentPollRef.current = isOnlineUnpaid(remote)

        if (isTerminalShoppingOrderStatus(remote.status)) {
          clearActiveShoppingOrder(slug)
          stopPollingRef.current = true
        } else {
          writeActiveShoppingOrder(slug, remote)
        }
      } catch (err) {
        if (cancelled) return
        if (cachedMatch) {
          setOrder(cachedMatch)
          setLive(false)
          setError(null)
          needsPaymentPollRef.current = isOnlineUnpaid(cachedMatch)
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

    let timer: number | undefined
    function tick() {
      if (cancelled || stopPollingRef.current) return
      const delay = needsPaymentPollRef.current ? PAYMENT_POLL_MS : POLL_MS
      timer = window.setTimeout(() => {
        void load(false).finally(() => {
          tick()
        })
      }, delay)
    }
    tick()

    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [slug, orderId, paymentReturn])

  async function handleContinueCheckout() {
    if (!order || checkoutLoading) return
    setCheckoutLoading(true)
    try {
      const fromOrder = order.checkoutUrl?.trim()
      if (fromOrder) {
        window.location.assign(fromOrder)
        return
      }
      const result = await createPublicOrderCheckout(slug, orderId)
      window.location.assign(result.checkoutUrl)
    } catch (err) {
      const message =
        err instanceof PublicOrderRequestError
          ? err.message
          : "No se pudo abrir el pago. Intentá de nuevo."
      toast.error(message)
    } finally {
      setCheckoutLoading(false)
    }
  }

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

  const unpaidOnline = isOnlineUnpaid(order)
  const paid = isPaid(order)

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
        <PaymentReturnBanner
          paymentReturn={paymentReturn}
          unpaidOnline={unpaidOnline}
          paid={paid}
        />

        {unpaidOnline ? (
          <section className="space-y-3 rounded-lg border px-3 py-3">
            <div>
              <p className="text-sm font-medium">Pago pendiente</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Completá el pago en Mercado Pago para que el local prepare tu
                pedido. Si cerraste la ventana, podés volver a abrir el link.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={checkoutLoading}
              onClick={() => void handleContinueCheckout()}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Abriendo…
                </>
              ) : (
                "Continuar pago"
              )}
            </Button>
          </section>
        ) : null}

        {paid && order.paymentMethod?.trim().toLowerCase() === "online" ? (
          <p className="rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2.5 text-sm dark:bg-emerald-950/30">
            Pago recibido. El local ya puede preparar tu pedido.
          </p>
        ) : null}

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
            {order.paymentMethod?.trim().toLowerCase() === "online"
              ? paid
                ? order.fulfillmentType?.toUpperCase() === "DELIVERY"
                  ? "Seguí el estado acá."
                  : "Te vamos a llamar por tu nombre cuando esté listo."
                : "Cuando el pago se confirme, el local prepara tu pedido."
              : order.fulfillmentType?.toUpperCase() === "DELIVERY"
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

function PaymentReturnBanner({
  paymentReturn,
  unpaidOnline,
  paid,
}: {
  paymentReturn: string | null
  unpaidOnline: boolean
  paid: boolean
}) {
  if (!paymentReturn) return null

  if (paymentReturn === "success") {
    if (paid) return null
    return (
      <div
        className={cn(
          "rounded-lg border px-3 py-2.5 text-sm",
          "border-amber-600/30 bg-amber-50 dark:bg-amber-950/30",
        )}
      >
        <p className="font-medium">Confirmando tu pago…</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Mercado Pago ya volvió. Estamos esperando la confirmación del local.
        </p>
      </div>
    )
  }

  if (paymentReturn === "failure") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
        <p className="font-medium">El pago no se completó</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {unpaidOnline
            ? "Podés reintentar con el botón de continuar pago."
            : "Si ya pagaste, esperá un momento o contactá al local."}
        </p>
      </div>
    )
  }

  if (paymentReturn === "pending") {
    return (
      <div className="rounded-lg border border-amber-600/30 bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-950/30">
        <p className="font-medium">Pago en proceso</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Algunas formas de pago tardan unos minutos. Actualizamos esta página
          automáticamente.
        </p>
      </div>
    )
  }

  return null
}
