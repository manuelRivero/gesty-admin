import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  BILLING_READINESS_LABEL,
  FISCAL_CONFIG_STATUS_LABEL,
  INVOICE_STATUS_LABEL,
  type BillingReadinessState,
  type FiscalConfigStatus,
  type FiscalInvoiceStatus,
} from "@/lib/requests/invoicing"

const BILLING_READINESS_STYLE: Record<BillingReadinessState, string> = {
  pending_data: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  provisioning: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  ready: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
  requires_attention: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

/**
 * Estado simplificado para el restaurante (`deriveBillingReadiness`) — no confundir con
 * `FiscalConfigStatusBadge`, que refleja el `FiscalConfigStatus` persistido (diagnóstico interno).
 */
export function BillingReadinessBadge({
  state,
  className,
}: {
  state: BillingReadinessState
  className?: string
}) {
  return (
    <Badge className={cn(BILLING_READINESS_STYLE[state], className)}>
      {BILLING_READINESS_LABEL[state]}
    </Badge>
  )
}

const FISCAL_CONFIG_STATUS_STYLE: Record<FiscalConfigStatus, string> = {
  not_configured:
    "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  pending_validation:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  validated:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

export function FiscalConfigStatusBadge({
  status,
  className,
}: {
  status: FiscalConfigStatus
  className?: string
}) {
  return (
    <Badge className={cn(FISCAL_CONFIG_STATUS_STYLE[status], className)}>
      {FISCAL_CONFIG_STATUS_LABEL[status]}
    </Badge>
  )
}

const INVOICE_STATUS_STYLE: Record<FiscalInvoiceStatus, string> = {
  pending: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  authorized:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  requires_review:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  cancelled: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  // Violeta deliberadamente distinto de "authorized" (verde): nunca debe confundirse con un
  // comprobante con validez fiscal real.
  simulated: "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-300",
}

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: FiscalInvoiceStatus
  className?: string
}) {
  return (
    <Badge className={cn(INVOICE_STATUS_STYLE[status], className)}>
      {INVOICE_STATUS_LABEL[status]}
    </Badge>
  )
}
