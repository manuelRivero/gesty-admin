"use client"

import { cn } from "@/lib/utils"

import {
  getOrderStatusCopy,
  getOrderStepIndex,
  getStatusSteps,
  type ShoppingFulfillmentMode,
} from "./takeaway-status"

type OrderStatusTrackerProps = {
  status: string
  fulfillmentType?: string | null
}

function resolveMode(
  fulfillmentType: string | null | undefined,
): ShoppingFulfillmentMode {
  return fulfillmentType?.trim().toUpperCase() === "DELIVERY"
    ? "DELIVERY"
    : "TAKE_AWAY"
}

export function OrderStatusTracker({
  status,
  fulfillmentType,
}: OrderStatusTrackerProps) {
  const mode = resolveMode(fulfillmentType)
  const steps = getStatusSteps(mode)
  const copy = getOrderStatusCopy(status, mode)
  const activeIndex = getOrderStepIndex(status, mode)
  const cancelled = status.trim().toLowerCase() === "cancelled"
  const highlight =
    mode === "TAKE_AWAY"
      ? status.trim().toLowerCase() === "ready_for_pickup" ||
        status.trim().toLowerCase() === "shipped"
      : status.trim().toLowerCase() === "shipped"

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-xl border px-4 py-4",
          highlight
            ? "border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-border bg-muted/40",
        )}
      >
        <p className="text-lg font-semibold tracking-tight">{copy.title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{copy.hint}</p>
      </div>

      {cancelled ? null : (
        <ol className="space-y-0">
          {steps.map((step, index) => {
            const done = activeIndex > index
            const current = activeIndex === index
            const stepCopy = getOrderStatusCopy(step, mode)
            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      done || current
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  {index < steps.length - 1 ? (
                    <span
                      className={cn(
                        "my-1 w-px flex-1 min-h-6",
                        done ? "bg-primary" : "bg-border",
                      )}
                    />
                  ) : null}
                </div>
                <div className={cn("pb-5", current && "pt-0.5")}>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      current || done
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {stepCopy.title}
                  </p>
                  {current ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {stepCopy.hint}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
