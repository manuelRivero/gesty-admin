import { Badge } from "@/components/ui/badge"
import type { BillingSubscription } from "@/lib/requests/billing"
import { cn } from "@/lib/utils"

type StatusKind = "trial" | "active" | "past_due" | "expired" | "canceled" | "none"

function resolveStatusKind(
  subscription: BillingSubscription | null,
  accessOk: boolean,
): StatusKind {
  if (!subscription) return accessOk ? "trial" : "none"
  if (subscription.is_trial) return "trial"
  const status = subscription.status.toLowerCase()
  if (status === "past_due") return "past_due"
  if (status === "canceled" || status === "cancelled") {
    return accessOk ? "canceled" : "expired"
  }
  if (status === "active" || status === "trialing") return "active"
  if (!accessOk) return "expired"
  return "active"
}

const LABELS: Record<StatusKind, string> = {
  trial: "Trial",
  active: "Activo",
  past_due: "Past due",
  expired: "Vencido",
  canceled: "Cancelado",
  none: "Sin plan",
}

const STYLES: Record<StatusKind, string> = {
  trial:
    "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  active:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  past_due:
    "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  expired:
    "border-destructive/40 bg-destructive/10 text-destructive",
  canceled:
    "border-muted-foreground/30 bg-muted text-muted-foreground",
  none:
    "border-destructive/40 bg-destructive/10 text-destructive",
}

interface SubscriptionStatusBadgeProps {
  subscription: BillingSubscription | null
  accessOk: boolean
  className?: string
}

export function SubscriptionStatusBadge({
  subscription,
  accessOk,
  className,
}: SubscriptionStatusBadgeProps) {
  const kind = resolveStatusKind(subscription, accessOk)
  return (
    <Badge
      variant="outline"
      className={cn(STYLES[kind], className)}
    >
      {LABELS[kind]}
    </Badge>
  )
}
