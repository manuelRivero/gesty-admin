import { api } from "@/lib/api"

export const ADMIN_KITCHEN_TICKETS_PATH = "/admin/kitchen-tickets"

export type KitchenTicketItemStatus = "pending" | "preparing" | "ready" | "canceled"

export const KITCHEN_TICKET_ITEM_STATUS_LABELS_ES: Record<KitchenTicketItemStatus, string> = {
  pending: "Pendiente",
  preparing: "Preparando",
  ready: "Listo",
  canceled: "Cancelado",
}

export interface KitchenTicketItem {
  id: string
  orderItemId: string
  status: KitchenTicketItemStatus
  menuItemId: string
  menuItemName: string
  quantity: number
  notes: string | null
  variation: string | null
}

export interface KitchenTicket {
  id: string
  orderId: string
  stationId: string
  createdAt: string
  tableNames: string[]
  /** Posición de esta ronda entre las de la misma cuenta (1 = primera) — mismo criterio que "Ronda N" en /pos. */
  roundNumber: number | null
  items: KitchenTicketItem[]
}

/** Snapshot REST — ver `kitchenTicket.service.ts` en el backend (Fase 5). */
export async function fetchKitchenTickets(): Promise<KitchenTicket[]> {
  const { data } = await api.get<{ items?: unknown[] }>(ADMIN_KITCHEN_TICKETS_PATH)
  return Array.isArray(data.items) ? (data.items as KitchenTicket[]) : []
}

/** Avanza `pending -> preparing` o `preparing -> ready` (CAS en el backend). */
export async function patchKitchenTicketItemStatus(
  itemId: string,
  status: "preparing" | "ready",
): Promise<{ id: string; status: KitchenTicketItemStatus }> {
  const { data } = await api.patch<{ id: string; status: KitchenTicketItemStatus }>(
    `${ADMIN_KITCHEN_TICKETS_PATH}/items/${itemId}/status`,
    { status },
  )
  return data
}
