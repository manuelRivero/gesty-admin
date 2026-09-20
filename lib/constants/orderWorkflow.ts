/**
 * Logística / cocina / entrega (`orders.status`).
 * `cancelled` es terminal y no entra en el pipeline lineal.
 */
export const ORDER_STATUS_PIPELINE = [
  "draft",
  "placed",
  "preparing",
  "shipped",
  "delivered",
] as const

/** Solo estos valores acepta PATCH ` /admin/orders/:id/status` (logística). */
export const ADMIN_PATCH_ORDER_STATUSES = [
  "preparing",
  "shipped",
  "delivered",
] as const

export type AdminPatchableOrderStatus =
  (typeof ADMIN_PATCH_ORDER_STATUSES)[number]

export const ORDER_STATUS_LABEL_ES: Record<
  (typeof ORDER_STATUS_PIPELINE)[number] | "cancelled" | "ready_for_pickup",
  string
> = {
  draft: "Borrador",
  placed: "Pedido recibido",
  preparing: "En preparación",
  shipped: "Enviado",
  ready_for_pickup: "Listo para retirar",
  delivered: "Entregado",
  cancelled: "Cancelado",
}

/** Etiquetas para el body del PATCH (subconjunto de logística). */
export const ADMIN_PATCH_ORDER_LABEL_ES: Record<
  AdminPatchableOrderStatus,
  string
> = {
  preparing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
}

const LEGACY_ORDER_STATUS_LABEL_ES: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendiente",
  pending_payment: "Pago pendiente",
  completed: "Completado",
}

/** Cobro (`orders.payment_status`): valores actuales del backend. */
export const ORDER_PAYMENT_STATUSES = ["paid", "unpaid"] as const

export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number]

export const ORDER_PAYMENT_STATUS_LABEL_ES: Record<
  OrderPaymentStatus,
  string
> = {
  paid: "Pagado",
  unpaid: "Pendiente de pago",
}

/** Valores legacy que aún pueden aparecer en datos viejos. */
const LEGACY_ORDER_PAYMENT_LABEL_ES: Record<string, string> = {
  pending: "Pendiente de pago",
  deferred: "Pago al entregar",
}

export function getOrderPaymentStatusLabelEs(paymentStatus: string): string {
  const s = paymentStatus.trim().toLowerCase()
  if (!s) return "—"
  if (s in ORDER_PAYMENT_STATUS_LABEL_ES) {
    return ORDER_PAYMENT_STATUS_LABEL_ES[s as OrderPaymentStatus]
  }
  return LEGACY_ORDER_PAYMENT_LABEL_ES[s] ?? paymentStatus
}

/** Texto para badge / notificaciones de `status`. */
export function getOrderStatusLabelEs(status: string): string {
  const s = status.trim().toLowerCase()
  if (s in ORDER_STATUS_LABEL_ES) {
    return ORDER_STATUS_LABEL_ES[s as keyof typeof ORDER_STATUS_LABEL_ES]
  }
  return LEGACY_ORDER_STATUS_LABEL_ES[s] ?? status
}

/**
 * Siguiente valor permitido por PATCH de logística (no mezclar con pago).
 * Desde `draft` / `placed` el primer paso operativo es `preparing`.
 */
export function getNextPatchableOrderStatus(
  currentStatus: string,
): AdminPatchableOrderStatus | null {
  const s = currentStatus.trim().toLowerCase()
  if (s === "cancelled" || s === "delivered") return null
  if (s === "shipped") return "delivered"
  if (s === "preparing") return "shipped"
  if (s === "draft" || s === "placed") return "preparing"
  if (
    s === "pending_payment" ||
    s === "confirmed" ||
    s === "pending"
  ) {
    return "preparing"
  }
  return "preparing"
}
