"use client"

import { cn } from "@/lib/utils"

import {
  TAKEAWAY_STATUS_STEPS,
  getTakeawayStepIndex,
  getTakeawayStatusCopy,
} from "./takeaway-status"

type OrderStatusTrackerProps = {
  status: string
}

export function OrderStatusTracker({ status }: OrderStatusTrackerProps) {
  const copy = getTakeawayStatusCopy(status)
  const activeIndex = getTakeawayStepIndex(status)
  const cancelled = status.trim().toLowerCase() === "cancelled"
  const isReady = status.trim().toLowerCase() === "ready_for_pickup"

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-xl border px-4 py-4",
          isReady
            ? "border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-border bg-muted/40",
        )}
      >
        <p className="text-lg font-semibold tracking-tight">{copy.title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{copy.hint}</p>
      </div>

      {cancelled ? null : (
        <ol className="space-y-0">
          {TAKEAWAY_STATUS_STEPS.map((step, index) => {
            const done = activeIndex > index
            const current = activeIndex === index
            const stepCopy = getTakeawayStatusCopy(step)
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
                  {index < TAKEAWAY_STATUS_STEPS.length - 1 ? (
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
                      current
                        ? "text-foreground"
                        : done
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
