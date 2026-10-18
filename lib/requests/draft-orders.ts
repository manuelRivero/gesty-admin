import { api } from "@/lib/api"

function adminDraftOrderPath(conversationId: string): string {
  return `/admin/whatsapp/conversations/${conversationId}/draft-order`
}

function adminDraftOrderItemsPath(conversationId: string): string {
  return `${adminDraftOrderPath(conversationId)}/items`
}

function adminDraftOrderItemPath(conversationId: string, itemId: string): string {
  return `${adminDraftOrderItemsPath(conversationId)}/${itemId}`
}

function adminDraftOrderFulfillmentPath(conversationId: string): string {
  return `${adminDraftOrderPath(conversationId)}/fulfillment`
}

function adminDraftOrderRequestConfirmationPath(conversationId: string): string {
  return `${adminDraftOrderPath(conversationId)}/request-confirmation`
}

export type AdminDraftOrderFulfillmentType = "TAKE_AWAY" | "DELIVERY"

export type AdminDraftOrderDeliveryCoverage =
  | "ok"
  | "no_address"
  | "out_of_coverage"
  | "not_applicable"

export interface AdminDraftOrderItem {
  id: string
  menuItemId: string | null
  name: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  variation: string | null
}

export interface AdminOfferedPaymentMethod {
  id: string
  label: string
  emoji: string
}

export interface AdminDraftOrder {
  id: string
  totalAmount: number
  currency: string
  items: AdminDraftOrderItem[]
  fulfillmentType: AdminDraftOrderFulfillmentType | null
  deliveryAddress: string | null
  deliveryFee: number
  deliveryCoverage: AdminDraftOrderDeliveryCoverage
  offeredPaymentMethods: AdminOfferedPaymentMethod[]
}

interface AdminDraftOrderItemRaw {
  id?: string
  product_id?: string | null
  quantity?: number
  unit_price?: string | number
  total_price?: string | number
  variation?: string | null
  menu_item?: {
    id?: string
    name?: string | null
    image?: string | null
  } | null
}

interface AdminDraftOrderRaw {
  draft?: {
    id?: string
    total_amount?: string | number
    currency?: string
  }
  items?: AdminDraftOrderItemRaw[]
  delivery?: {
    fulfillmentType?: string | null
    deliveryAddress?: string | null
    deliveryFee?: string | number
    deliveryCoverage?: string
  }
  offeredPaymentMethods?: Array<{
    id?: string
    label?: string
    emoji?: string
  }>
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === "number" ? value : parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function toFulfillmentType(
  value: string | null | undefined,
): AdminDraftOrderFulfillmentType | null {
  return value === "TAKE_AWAY" || value === "DELIVERY" ? value : null
}

function toDeliveryCoverage(
  value: string | undefined,
): AdminDraftOrderDeliveryCoverage {
  if (value === "ok" || value === "no_address" || value === "out_of_coverage") {
    return value
  }
  return "not_applicable"
}

function mapRawDraftOrder(raw: AdminDraftOrderRaw): AdminDraftOrder {
  return {
    id: raw.draft?.id ?? "",
    totalAmount: toNumber(raw.draft?.total_amount),
    currency: raw.draft?.currency ?? "ARS",
    items: Array.isArray(raw.items)
      ? raw.items.map((item) => ({
          id: item.id ?? "",
          menuItemId: item.product_id ?? item.menu_item?.id ?? null,
          name: item.menu_item?.name ?? "Producto",
          imageUrl: item.menu_item?.image ?? null,
          quantity: item.quantity ?? 0,
          unitPrice: toNumber(item.unit_price),
          totalPrice: toNumber(item.total_price),
          variation: item.variation ?? null,
        }))
      : [],
    fulfillmentType: toFulfillmentType(raw.delivery?.fulfillmentType),
    deliveryAddress: raw.delivery?.deliveryAddress ?? null,
    deliveryFee: toNumber(raw.delivery?.deliveryFee),
    deliveryCoverage: toDeliveryCoverage(raw.delivery?.deliveryCoverage),
    offeredPaymentMethods: Array.isArray(raw.offeredPaymentMethods)
      ? raw.offeredPaymentMethods
          .filter((m): m is { id: string; label?: string; emoji?: string } =>
            Boolean(m?.id),
          )
          .map((m) => ({
            id: m.id,
            label: m.label ?? m.id,
            emoji: m.emoji ?? "",
          }))
      : [],
  }
}

export async function fetchAdminDraftOrder(
  conversationId: string,
): Promise<AdminDraftOrder> {
  const { data } = await api.get<AdminDraftOrderRaw>(
    adminDraftOrderPath(conversationId),
  )
  return mapRawDraftOrder(data)
}

export async function addAdminDraftOrderItem(
  conversationId: string,
  input: { menuItemId: string; quantity?: number; variation?: string | null },
): Promise<AdminDraftOrder> {
  const { data } = await api.post<AdminDraftOrderRaw>(
    adminDraftOrderItemsPath(conversationId),
    input,
  )
  return mapRawDraftOrder(data)
}

export async function updateAdminDraftOrderItemQuantity(
  conversationId: string,
  itemId: string,
  quantity: number,
): Promise<AdminDraftOrder> {
  const { data } = await api.patch<AdminDraftOrderRaw>(
    adminDraftOrderItemPath(conversationId, itemId),
    { quantity },
  )
  return mapRawDraftOrder(data)
}

export async function removeAdminDraftOrderItem(
  conversationId: string,
  itemId: string,
): Promise<AdminDraftOrder> {
  const { data } = await api.delete<AdminDraftOrderRaw>(
    adminDraftOrderItemPath(conversationId, itemId),
  )
  return mapRawDraftOrder(data)
}

export async function setAdminDraftOrderFulfillment(
  conversationId: string,
  fulfillmentType: AdminDraftOrderFulfillmentType,
): Promise<AdminDraftOrder> {
  const { data } = await api.patch<AdminDraftOrderRaw>(
    adminDraftOrderFulfillmentPath(conversationId),
    { fulfillmentType },
  )
  return mapRawDraftOrder(data)
}

export async function requestAdminDraftOrderConfirmation(
  conversationId: string,
  payload: { paymentMethod: string },
): Promise<{ sent: boolean }> {
  const { data } = await api.post<{ sent?: boolean }>(
    adminDraftOrderRequestConfirmationPath(conversationId),
    payload,
  )
  return { sent: Boolean(data.sent) }
}
