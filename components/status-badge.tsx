import { getOrderPaymentStatusLabelEs } from "@/lib/constants/orderWorkflow"
import { cn } from "@/lib/utils"

/** Mapeo para `orders.status` (string en BD) y valores legacy de la UI. */
const ORDER_STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Borrador",
    className: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  },
  placed: {
    label: "Pedido recibido",
    className: "bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-300",
  },
  pending_payment: {
    label: "Pago pendiente",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  preparing: {
    label: "En preparación",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  shipped: {
    label: "Enviado",
    className: "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-300",
  },
  ready_for_pickup: {
    label: "Listo para retirar",
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  delivered: {
    label: "Entregado",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  pending: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  processing: {
    label: "En proceso",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    label: "Completado",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
}

const RESERVATION_STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  /** Cancelación por el usuario (backend `closed`). */
  closed: {
    label: "Cancelada",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
}

const ORDER_PAYMENT_STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  paid: {
    label: "Pagado",
    className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  unpaid: {
    label: "Pendiente de pago",
    className:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  },
  /** Legacy */
  pending: {
    label: "Pendiente de pago",
    className:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  },
  deferred: {
    label: "Pago al entregar",
    className: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
  },
}

export function OrderStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase()
  const config = ORDER_STATUS_BADGE[key] ?? {
    label: status,
    className:
      "bg-muted text-muted-foreground dark:bg-muted/80",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}

/** Cobro (`payment_status`), independiente de la logística (`OrderStatusBadge`). Solo lectura. */
export function OrderPaymentStatusBadge({ paymentStatus }: { paymentStatus: string }) {
  const raw = paymentStatus?.trim() ?? ""
  if (!raw) {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">—</span>
    )
  }
  const key = raw.toLowerCase()
  const fromMap = ORDER_PAYMENT_STATUS_BADGE[key]
  const label = fromMap?.label ?? getOrderPaymentStatusLabelEs(raw)
  const badgeClassName =
    fromMap?.className ??
    "bg-muted text-muted-foreground dark:bg-muted/80"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        badgeClassName,
      )}
      title={`Estado de pago: ${label}`}
    >
      {label}
    </span>
  )
}

export function ReservationStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase()
  const config = RESERVATION_STATUS_BADGE[key] ?? {
    label: status,
    className:
      "bg-muted text-muted-foreground dark:bg-muted/80",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
