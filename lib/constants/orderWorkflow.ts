/**
 * Logística / cocina / entrega (`orders.status`).
 * `cancelled` es terminal y no entra en el pipeline lineal.
 *
 * Alineado a gesty-backend `orderWorkflow`:
 * - Retiro (TAKE_AWAY): preparing → ready_for_pickup → delivered
 * - Envío (DELIVERY):   preparing → shipped → delivered
 *
 * El PATCH admin acepta: preparing | ready_for_pickup | shipped | delivered.
 */
export const ORDER_STATUS_PIPELINE = [
  "draft",
  "placed",
  "preparing",
  "ready_for_pickup",
  "shipped",
  "delivered",
] as const

/** Valores que acepta PATCH `/admin/orders/:id/status` (logística). */
export const ADMIN_PATCH_ORDER_STATUSES = [
  "preparing",
  "ready_for_pickup",
  "shipped",
  "delivered",
] as const

export type AdminPatchableOrderStatus =
  (typeof ADMIN_PATCH_ORDER_STATUSES)[number]

export const ORDER_STATUS_LABEL_ES: Record<
  (typeof ORDER_STATUS_PIPELINE)[number] | "cancelled",
  string
> = {
  draft: "Borrador",
  placed: "Pedido recibido",
  preparing: "En preparación",
  ready_for_pickup: "Listo para retirar",
  shipped: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
}

/** Etiquetas por defecto del PATCH (pueden refinarse por modalidad). */
export const ADMIN_PATCH_ORDER_LABEL_ES: Record<
  AdminPatchableOrderStatus,
  string
> = {
  preparing: "En preparación",
  ready_for_pickup: "Listo para retirar",
  shipped: "En camino",
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

/**
 * Texto para badge / notificaciones de `status`.
 * @param isDelivery — si false (retiro), `shipped` legacy se muestra como listo para retirar.
 */
export function getOrderStatusLabelEs(
  status: string,
  isDelivery = true,
): string {
  const s = status.trim().toLowerCase()
  if (!isDelivery && (s === "shipped" || s === "ready_for_pickup")) {
    return "Listo para retirar"
  }
  if (isDelivery && s === "ready_for_pickup") {
    return "Listo para enviar"
  }
  if (isDelivery && s === "shipped") {
    return "En camino"
  }
  if (s in ORDER_STATUS_LABEL_ES) {
    return ORDER_STATUS_LABEL_ES[s as keyof typeof ORDER_STATUS_LABEL_ES]
  }
  return LEGACY_ORDER_STATUS_LABEL_ES[s] ?? status
}

/** Label del botón “Cambiar a …” según modalidad. */
export function getAdminPatchOrderLabelEs(
  status: AdminPatchableOrderStatus,
  isDelivery: boolean,
): string {
  if (status === "ready_for_pickup") return "Listo para retirar"
  if (status === "shipped") return "En camino"
  if (status === "delivered" && !isDelivery) return "Entregado / retirado"
  return ADMIN_PATCH_ORDER_LABEL_ES[status]
}

/**
 * Siguiente valor PATCH según modalidad (alineado a backend).
 * - Retiro: preparing → ready_for_pickup → delivered
 * - Envío:  preparing → shipped → delivered
 * También avanza pedidos legacy de retiro que quedaron en `shipped`.
 */
export function getNextPatchableOrderStatus(
  currentStatus: string,
  isDelivery = true,
): AdminPatchableOrderStatus | null {
  const s = currentStatus.trim().toLowerCase()
  if (s === "cancelled" || s === "delivered") return null

  if (s === "shipped" || s === "ready_for_pickup") return "delivered"

  if (s === "preparing") {
    return isDelivery ? "shipped" : "ready_for_pickup"
  }

  if (
    s === "draft" ||
    s === "placed" ||
    s === "pending_payment" ||
    s === "confirmed" ||
    s === "pending"
  ) {
    return "preparing"
  }

  return "preparing"
}
