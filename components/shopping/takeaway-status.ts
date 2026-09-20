/**
 * Estados relevantes para el cliente en retiro en mostrador.
 * (Omite `draft` / `shipped` del flujo delivery.)
 */
export const TAKEAWAY_STATUS_STEPS = [
  "placed",
  "preparing",
  "ready_for_pickup",
  "delivered",
] as const

export type TakeawayStatusStep = (typeof TAKEAWAY_STATUS_STEPS)[number]

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
    hint: "Acercate al mostrador y decí tu nombre.",
  },
  delivered: {
    title: "Entregado",
    hint: "¡Buen provecho!",
  },
  cancelled: {
    title: "Cancelado",
    hint: "Este pedido fue cancelado. Consultá en el local si hace falta.",
  },
}

export function getTakeawayStatusCopy(status: string): {
  title: string
  hint: string
} {
  const s = status.trim().toLowerCase()
  if (s in TAKEAWAY_STATUS_COPY) {
    return TAKEAWAY_STATUS_COPY[s as keyof typeof TAKEAWAY_STATUS_COPY]
  }
  if (s === "shipped") {
    return {
      title: "En camino",
      hint: "Tu pedido está en tránsito.",
    }
  }
  return {
    title: status || "En curso",
    hint: "Seguí el estado acá o preguntá en el mostrador.",
  }
}

/** Índice del paso activo en el tracker (-1 si cancelado / desconocido). */
export function getTakeawayStepIndex(status: string): number {
  const s = status.trim().toLowerCase()
  if (s === "cancelled") return -1
  if (s === "shipped") return TAKEAWAY_STATUS_STEPS.indexOf("preparing")
  const idx = TAKEAWAY_STATUS_STEPS.indexOf(s as TakeawayStatusStep)
  return idx
}
