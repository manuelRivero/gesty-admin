"use client"

import Link from "next/link"
import { Check, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OrdersSetupStatus } from "@/lib/orders-setup"

type OrdersSetupChecklistProps = {
  status: OrdersSetupStatus | null
  isLoading?: boolean
  className?: string
}

export function OrdersSetupChecklist({
  status,
  isLoading = false,
  className,
}: OrdersSetupChecklistProps) {
  if (isLoading || !status) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        Cargando checklist de pedidos…
      </div>
    )
  }

  if (status.isReadyToSell) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3",
          className,
        )}
      >
        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Listo para vender</p>
          <p className="text-sm text-muted-foreground">
            Menú, fulfillment, pago y pedidos están configurados. El bot solo
            toma pedidos si también está habilitado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <p className="text-sm font-medium">Listo para vender</p>
        <p className="text-sm text-muted-foreground">
          Completá estos pasos antes de habilitar pedidos. Nada se activa solo.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {status.steps.map((step, index) => (
          <li
            key={step.id}
            className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                  step.done
                    ? "bg-emerald-600 text-white"
                    : "border border-muted-foreground/40 text-muted-foreground",
                )}
                aria-hidden
              >
                {step.done ? (
                  <Check className="size-3" />
                ) : (
                  <span className="text-[10px] font-medium">{index + 1}</span>
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done && "text-muted-foreground line-through",
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {!step.done ? (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href={step.href}>
                  Ir
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <span className="w-12 shrink-0" aria-hidden />
            )}
          </li>
        ))}
      </ol>
      {status.canEnableOrders ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Prerequisitos OK — ya podés activar &quot;Habilitar pedidos&quot; abajo.
        </p>
      ) : null}
    </div>
  )
}
