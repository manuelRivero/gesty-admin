import { Badge } from "@/components/ui/badge"
import type { BillingLifecycleState } from "@/lib/requests/billing"
import { cn } from "@/lib/utils"

/**
 * `billing_state` (calculado por el backend,
 * `gesty-backend/src/services/billing/subscriptionLifecycle.service.ts`)
 * es la única fuente de verdad acá — este componente no vuelve a
 * clasificar `status`/`cancel_at_period_end` por su cuenta. `isTrial` es
 * un dato ORTOGONAL (no reclasifica el estado, solo ajusta el texto
 * cuando el estado es "active" y la suscripción todavía es de prueba).
 */
interface SubscriptionStatusBadgeProps {
  billingState: BillingLifecycleState
  isTrial?: boolean
  className?: string
}

const LABELS: Record<BillingLifecycleState, string> = {
  none: "Sin plan",
  active: "Activo",
  active_canceling: "Cancelación programada",
  past_due: "Pago pendiente",
  expired: "Vencido",
  unknown: "Estado sin verificar",
}

const STYLES: Record<BillingLifecycleState, string> = {
  none: "border-destructive/40 bg-destructive/10 text-destructive",
  active:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  active_canceling:
    "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  past_due:
    "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  // Deliberadamente NO reutiliza el estilo de "active": un estado
  // desconocido nunca debe leerse visualmente como "todo bien".
  unknown: "border-muted-foreground/40 bg-muted text-muted-foreground",
}

export function SubscriptionStatusBadge({
  billingState,
  isTrial = false,
  className,
}: SubscriptionStatusBadgeProps) {
  const label =
    billingState === "active" && isTrial ? "Prueba" : LABELS[billingState]

  return (
    <Badge
      variant="outline"
      className={cn(STYLES[billingState], className)}
      role="status"
      aria-label={`Estado de la suscripción: ${label}`}
    >
      {label}
    </Badge>
  )
}
