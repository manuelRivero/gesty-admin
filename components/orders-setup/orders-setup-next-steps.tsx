"use client"

import Link from "next/link"
import { ArrowRight, ShoppingBag } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  ordersSetupCtaCopy,
  type OrdersSetupStatus,
} from "@/lib/orders-setup"

type OrdersSetupNextStepsProps = {
  status: OrdersSetupStatus | null
  /** Si el método recién activado es online sin MP, aclarar. */
  onlineNeedsProvider?: boolean
  className?: string
}

/**
 * CTA suave post-pago / post-setup parcial.
 * Nunca implica que el bot ya toma pedidos si `orders_enabled` es false.
 */
export function OrdersSetupNextSteps({
  status,
  onlineNeedsProvider = false,
  className,
}: OrdersSetupNextStepsProps) {
  if (!status || status.isReadyToSell) return null

  const copy = ordersSetupCtaCopy(status)

  return (
    <Alert className={className ?? "border-sky-500/40 bg-sky-500/5"}>
      <ShoppingBag className="text-sky-700 dark:text-sky-400" />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{copy.description}</p>
        {onlineNeedsProvider ? (
          <p>
            El método &quot;Pago online&quot; solo cuenta si Mercado Pago está
            configurado y activo.
          </p>
        ) : null}
        <div>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings#pedidos">
              Ir a setup de pedidos
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
