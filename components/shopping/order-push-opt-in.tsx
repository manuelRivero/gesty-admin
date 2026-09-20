"use client"

import * as React from "react"
import { Bell, BellRing, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PublicOrderPushError } from "@/lib/requests/public-order-push"
import {
  isStorefrontPushConfigured,
  isStorefrontPushSupported,
  readStorefrontPushOptIn,
  subscribeStorefrontOrderPush,
} from "@/lib/storefront-push"
import { isTerminalShoppingOrderStatus } from "./active-order-storage"

type OrderPushOptInProps = {
  slug: string
  orderId: string
  status: string
  fulfillmentType?: string | null
}

function pushHintForFulfillment(fulfillmentType?: string | null): string {
  const delivery = fulfillmentType?.trim().toUpperCase() === "DELIVERY"
  return delivery
    ? "Te avisamos cuando el pedido salga en camino (aunque cierres esta página)."
    : "Te avisamos cuando esté listo para retirar (aunque cierres esta página)."
}

export function OrderPushOptIn({
  slug,
  orderId,
  status,
  fulfillmentType,
}: OrderPushOptInProps) {
  const terminal = isTerminalShoppingOrderStatus(status)
  const [supported, setSupported] = React.useState(false)
  const [configured, setConfigured] = React.useState<boolean | null>(null)
  const [optedIn, setOptedIn] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const hint = pushHintForFulfillment(fulfillmentType)

  React.useEffect(() => {
    setSupported(isStorefrontPushSupported())
    setOptedIn(readStorefrontPushOptIn(slug, orderId))
  }, [slug, orderId])

  React.useEffect(() => {
    if (!supported || terminal) {
      setConfigured(false)
      return
    }
    let cancelled = false
    void isStorefrontPushConfigured().then((ok) => {
      if (!cancelled) setConfigured(ok)
    })
    return () => {
      cancelled = true
    }
  }, [supported, terminal])

  if (!supported || terminal || configured !== true) {
    return null
  }

  if (optedIn) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50">
        <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Te vamos a avisar</p>
          <p className="mt-0.5 text-xs opacity-90">{hint}</p>
        </div>
      </div>
    )
  }

  async function handleEnable() {
    setBusy(true)
    setError(null)
    try {
      await subscribeStorefrontOrderPush(slug, orderId)
      setOptedIn(true)
    } catch (err) {
      if (
        err instanceof PublicOrderPushError &&
        (err.code === "PUSH_NOT_CONFIGURED" || err.httpStatus === 503)
      ) {
        setConfigured(false)
        return
      }
      if (err instanceof PublicOrderPushError) {
        if (err.code === "PERMISSION_DENIED") {
          setError(
            "Activá las notificaciones en el navegador para este sitio y probá de nuevo.",
          )
        } else if (err.code === "ORDER_TERMINAL" || err.httpStatus === 409) {
          setError("Este pedido ya terminó; no hace falta avisar.")
        } else if (err.code === "SW_REGISTER_FAILED") {
          setError(
            "No se pudo preparar el aviso en este dispositivo. Recargá la página e intentá de nuevo.",
          )
        } else {
          setError(err.message)
        }
      } else if (err instanceof Error && err.message.trim()) {
        setError(err.message.trim())
      } else {
        setError("No se pudo activar el aviso. Probá de nuevo.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border px-4 py-3">
      <div className="flex items-start gap-3">
        <Bell className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium">Avisame cuando avance</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void handleEnable()}
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Activando…
              </>
            ) : (
              "Activar avisos"
            )}
          </Button>
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
