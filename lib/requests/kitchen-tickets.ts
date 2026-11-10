import { api } from "@/lib/api"

export const ADMIN_KITCHEN_TICKETS_PATH = "/admin/kitchen-tickets"

export interface KitchenTicketItem {
  id: string
  orderItemId: string
  status: "pending" | "preparing" | "ready" | "canceled"
  menuItemId: string
  quantity: number
  notes: string | null
  variation: string | null
}

export interface KitchenTicket {
  id: string
  orderId: string
  stationId: string
  createdAt: string
  items: KitchenTicketItem[]
}

/** Snapshot REST — ver `kitchenTicket.service.ts` en el backend (Fase 5). */
export async function fetchKitchenTickets(): Promise<KitchenTicket[]> {
  const { data } = await api.get<{ items?: unknown[] }>(ADMIN_KITCHEN_TICKETS_PATH)
  return Array.isArray(data.items) ? (data.items as KitchenTicket[]) : []
}
