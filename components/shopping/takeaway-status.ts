/**
 * Pipelines de estado post-checkout según modo de fulfillment.
 */

export const TAKEAWAY_STATUS_STEPS = [
  "placed",
  "preparing",
  "ready_for_pickup",
  "delivered",
] as const

export const DELIVERY_STATUS_STEPS = [
  "placed",
  "preparing",
  "shipped",
  "delivered",
] as const

export type TakeawayStatusStep = (typeof TAKEAWAY_STATUS_STEPS)[number]
export type DeliveryStatusStep = (typeof DELIVERY_STATUS_STEPS)[number]
export type ShoppingFulfillmentMode = "TAKE_AWAY" | "DELIVERY"

export const TAKEAWAY_STATUS_COPY: Record<
  TakeawayStatusStep | "cancelled",
  { title: string; hint: string }
> = {
  placed: {
    title: "Pedido recibido",
    hint: "Ya llegó a cocina. Te avisamos cuando avance.",
  },
  preparing: {
    title: "En preparación",
    hint: "Están armando tu pedido.",
  },
  ready_for_pickup: {
    title: "Listo para retirar",
    hint: "Acercate al mostrador.",
  },
  delivered: {
    title: "Entregado",
    hint: "¡Buen provecho!",
  },
  cancelled: {
    title: "Cancelado",
    hint: "Este pedido fue cancelado. Consultá con el personal si hace falta.",
  },
}

export const DELIVERY_STATUS_COPY: Record<
  DeliveryStatusStep | "cancelled" | "ready_for_pickup",
  { title: string; hint: string }
> = {
  placed: {
    title: "Pedido recibido",
    hint: "Ya llegó a cocina. Te avisamos cuando avance.",
  },
  preparing: {
    title: "En preparación",
    hint: "Están armando tu pedido para enviarlo.",
  },
  shipped: {
    title: "En camino",
    hint: "El repartidor ya salió hacia tu dirección.",
  },
  ready_for_pickup: {
    title: "Listo",
    hint: "Tu pedido está listo; en breve sale el envío.",
  },
  delivered: {
    title: "Entregado",
    hint: "¡Buen provecho!",
  },
  cancelled: {
    title: "Cancelado",
    hint: "Este pedido fue cancelado. Consultá con el personal si hace falta.",
  },
}

export function isDeliveryFulfillment(fulfillmentType: string | null | undefined) {
  return fulfillmentType?.trim().toUpperCase() === "DELIVERY"
}

export function getStatusSteps(mode: ShoppingFulfillmentMode) {
  return mode === "DELIVERY" ? DELIVERY_STATUS_STEPS : TAKEAWAY_STATUS_STEPS
}

export function getOrderStatusCopy(
  status: string,
  mode: ShoppingFulfillmentMode = "TAKE_AWAY",
): { title: string; hint: string } {
  const s = status.trim().toLowerCase()
  const table = mode === "DELIVERY" ? DELIVERY_STATUS_COPY : TAKEAWAY_STATUS_COPY
  if (s in table) {
    return table[s as keyof typeof table]
  }
  if (mode === "TAKE_AWAY" && s === "shipped") {
    return {
      title: "Listo para retirar",
      hint: "Acercate al mostrador.",
    }
  }
  return {
    title: status || "En curso",
    hint: "Seguí el estado acá o consultá con el personal.",
  }
}

/** @deprecated Preferí `getOrderStatusCopy`. */
export function getTakeawayStatusCopy(status: string) {
  return getOrderStatusCopy(status, "TAKE_AWAY")
}

/** Índice del paso activo en el tracker (-1 si cancelado / desconocido). */
export function getOrderStepIndex(
  status: string,
  mode: ShoppingFulfillmentMode = "TAKE_AWAY",
): number {
  const s = status.trim().toLowerCase()
  if (s === "cancelled") return -1
  const steps = getStatusSteps(mode)
  if (mode === "TAKE_AWAY" && s === "shipped") {
    // Admin PATCH usa `shipped` como “listo para retirar”.
    return steps.indexOf("ready_for_pickup")
  }
  if (mode === "DELIVERY" && s === "ready_for_pickup") {
    return steps.indexOf("preparing")
  }
  return steps.indexOf(s as never)
}

/** @deprecated Preferí `getOrderStepIndex`. */
export function getTakeawayStepIndex(status: string): number {
  return getOrderStepIndex(status, "TAKE_AWAY")
}
