import { isAxiosError } from "axios"

import { api } from "@/lib/api"

export const ADMIN_TABLE_TABS_PATH = "/admin/table-tabs"

/** Fila tal como la devuelve el backend (snake_case, ver `adminTableTab.service.ts`). */
export interface AdminTableTab {
  id: string
  businessId: string
  status: "open" | "closed" | "merged"
  openedAt: string
  closedAt: string | null
  openedByUserId: string | null
  assignedUserId: string | null
  /** Nombre del mozo responsable actual — para mostrar "quién atiende esta mesa". */
  assignedUserName: string | null
  /** `AppUser.id` del mozo responsable — comparar contra el propio JWT decodificado (`getUserIdFromCookie`). */
  assignedUserAppUserId: string | null
  /** Saldo pendiente — solo presente para ADMIN/OWNER (el backend lo omite para MOZO). */
  balance: string | null
  /**
   * Si la cuenta tuvo al menos una orden — solo presente para ADMIN/OWNER,
   * igual que `balance`. Distingue "recién abierta, sin ítems" (saldo $0,
   * NO lista para cerrar) de "ya pagada" (saldo $0, SÍ lista para cerrar).
   */
  hasOrders: boolean
  tables: Array<{
    tableId: string
    tableName: string
    environmentId: string
    assignedAt: string
  }>
}

function mapRow(raw: Record<string, unknown>): AdminTableTab {
  return {
    id: String(raw.id ?? ""),
    businessId: String(raw.businessId ?? raw.business_id ?? ""),
    status: (raw.status as AdminTableTab["status"]) ?? "open",
    openedAt: String(raw.openedAt ?? raw.opened_at ?? ""),
    closedAt: (raw.closedAt ?? raw.closed_at ?? null) as string | null,
    openedByUserId: (raw.openedByUserId ?? raw.opened_by_user_id ?? null) as string | null,
    assignedUserId: (raw.assignedUserId ?? raw.assigned_user_id ?? null) as string | null,
    assignedUserName: (raw.assignedUserName ?? raw.assigned_user_name ?? null) as string | null,
    assignedUserAppUserId: (raw.assignedUserAppUserId ??
      raw.assigned_user_app_user_id ??
      null) as string | null,
    balance: (raw.balance ?? null) as string | null,
    hasOrders: Boolean(raw.hasOrders ?? raw.has_orders ?? false),
    tables: Array.isArray(raw.tables)
      ? (raw.tables as Array<Record<string, unknown>>).map((t) => ({
          tableId: String(t.tableId ?? t.table_id ?? ""),
          tableName: String(t.tableName ?? t.table_name ?? ""),
          environmentId: String(t.environmentId ?? t.environment_id ?? ""),
          assignedAt: String(t.assignedAt ?? t.assigned_at ?? ""),
        }))
      : [],
  }
}

export async function fetchOpenTableTabs(): Promise<AdminTableTab[]> {
  const { data } = await api.get<{ items?: unknown[] }>(ADMIN_TABLE_TABS_PATH)
  const items = Array.isArray(data.items) ? data.items : []
  return items.map((row) => mapRow(row as Record<string, unknown>))
}

export async function fetchOccupiedTableIds(): Promise<Set<string>> {
  const { data } = await api.get<{ tableIds?: unknown[] }>(
    `${ADMIN_TABLE_TABS_PATH}/occupied-tables`,
  )
  const ids = Array.isArray(data.tableIds) ? data.tableIds : []
  return new Set(ids.map((id) => String(id)))
}

export type OpenTableTabErrorReason = "TABLE_NOT_FOUND" | "TABLE_ALREADY_OCCUPIED"

export async function openTableTab(tableId: string): Promise<AdminTableTab> {
  const { data } = await api.post(ADMIN_TABLE_TABS_PATH, { tableId })
  return mapRow(data as Record<string, unknown>)
}

export async function closeTableTab(
  tableTabId: string,
): Promise<{ tableTab: AdminTableTab; hasPendingKitchenItems: boolean }> {
  const { data } = await api.post(
    `${ADMIN_TABLE_TABS_PATH}/${encodeURIComponent(tableTabId)}/close`,
    {},
  )
  const { hasPendingKitchenItems, ...tableTab } = data as Record<string, unknown> & {
    hasPendingKitchenItems?: boolean
  }
  return {
    tableTab: mapRow(tableTab),
    hasPendingKitchenItems: Boolean(hasPendingKitchenItems),
  }
}

export interface TableTabOrderItem {
  id: string
  menuItemId: string
  menuItemName: string
  quantity: number
  unitPrice: string
  notes: string | null
  variation: string | null
}

export interface TableTabOrder {
  orderId: string
  createdAt: string
  status: string
  totalAmount: string | null
  items: TableTabOrderItem[]
}

function mapOrderRow(raw: Record<string, unknown>): TableTabOrder {
  const items = Array.isArray(raw.items) ? (raw.items as Array<Record<string, unknown>>) : []
  return {
    orderId: String(raw.orderId ?? raw.order_id ?? ""),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    status: String(raw.status ?? ""),
    totalAmount: (raw.totalAmount ?? raw.total_amount ?? null) as string | null,
    items: items.map((it) => ({
      id: String(it.id ?? ""),
      menuItemId: String(it.menuItemId ?? it.menu_item_id ?? ""),
      menuItemName: String(it.menuItemName ?? it.menu_item_name ?? ""),
      quantity: Number(it.quantity ?? 0),
      unitPrice: String(it.unitPrice ?? it.unit_price ?? "0"),
      notes: (it.notes ?? null) as string | null,
      variation: (it.variation ?? null) as string | null,
    })),
  }
}

/** "El pedido" de la cuenta — rondas + ítems, para el sidebar de `/pos`. */
export async function fetchTableTabOrders(tableTabId: string): Promise<TableTabOrder[]> {
  const { data } = await api.get<{ items?: unknown[] }>(
    `${ADMIN_TABLE_TABS_PATH}/${encodeURIComponent(tableTabId)}/orders`,
  )
  const items = Array.isArray(data.items) ? data.items : []
  return items.map((row) => mapOrderRow(row as Record<string, unknown>))
}

export type CreateTableTabRoundItemInput = {
  menuItemId: string
  quantity: number
  notes?: string
  variation?: string
}

/** Crea una ronda (ítems tomados del pedido) sobre una cuenta abierta — exclusivo de MOZO. */
export async function createTableTabRound(
  tableTabId: string,
  items: CreateTableTabRoundItemInput[],
): Promise<{ orderId: string; total: string }> {
  const { data } = await api.post<{ orderId: string; total: string }>(
    `${ADMIN_TABLE_TABS_PATH}/${encodeURIComponent(tableTabId)}/rounds`,
    { items },
  )
  return data
}

/** Mensajes amigables para los errores de negocio conocidos de armar una ronda. */
export function getCreateRoundApiErrorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { error?: string } | undefined
  const reason = data?.error
  const messages: Record<string, string> = {
    EMPTY_ROUND: "Agregá al menos un ítem.",
    TABLE_TAB_NOT_FOUND: "La cuenta no existe.",
    TABLE_TAB_NOT_OPEN: "La cuenta ya está cerrada.",
    MENU_ITEM_NOT_FOUND: "Uno de los ítems ya no existe.",
    MENU_ITEM_UNAVAILABLE: "Uno de los ítems ya no está disponible.",
    PRICE_NOT_AVAILABLE: "Uno de los ítems no tiene precio disponible.",
  }
  if (reason && messages[reason]) return messages[reason]
  return fallback
}

/** Saldo pendiente de la cuenta — solo ADMIN/OWNER (caja). El mozo no lo ve. */
export async function fetchTableTabBalance(tableTabId: string): Promise<string> {
  const { data } = await api.get<{ balance: string }>(
    `${ADMIN_TABLE_TABS_PATH}/${encodeURIComponent(tableTabId)}/balance`,
  )
  return data.balance
}

export type TabPaymentMethod = "cash" | "card" | "transfer" | "qr"

export const TAB_PAYMENT_METHOD_LABELS_ES: Record<TabPaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  qr: "QR",
}

export interface TabPaymentLineInput {
  method: TabPaymentMethod
  amountTendered: string
}

export interface TabPaymentLineResult {
  tabPaymentId: string
  method: TabPaymentMethod
  amountTendered: string
  amountApplied: string
  /** Vuelto de ESTA línea — cae por convención en las últimas líneas (ver backend). */
  change: string
}

export interface RecordTabPaymentResult {
  payments: TabPaymentLineResult[]
  totalAmountTendered: string
  totalAmountApplied: string
  /** Vuelto total a entregar — calculado, nunca persistido como saldo a favor (§4.D). */
  totalChange: string
}

/**
 * Registra un cobro — exclusivo de ADMIN/OWNER (caja/encargado), nunca del
 * mozo. Puede partirse entre varios medios (`lines`) en una sola llamada —
 * cada línea queda como su propia fila en el ledger del backend.
 */
export async function recordTabPayment(
  tableTabId: string,
  lines: TabPaymentLineInput[],
): Promise<RecordTabPaymentResult> {
  const { data } = await api.post<RecordTabPaymentResult>(
    `${ADMIN_TABLE_TABS_PATH}/${encodeURIComponent(tableTabId)}/payments`,
    { payments: lines },
  )
  return data
}

/** Mensajes amigables para los errores de negocio conocidos de registrar un cobro. */
export function getRecordPaymentApiErrorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { error?: string } | undefined
  const reason = data?.error
  const messages: Record<string, string> = {
    TABLE_TAB_NOT_FOUND: "La cuenta no existe.",
    NOTHING_TO_APPLY: "El monto ingresado no se puede aplicar a ningún consumo.",
  }
  if (reason && messages[reason]) return messages[reason]
  return fallback
}

/** Mensajes amigables para los errores de negocio conocidos de abrir/cerrar cuenta. */
export function getTableTabApiErrorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { error?: string } | undefined
  const reason = data?.error
  const messages: Record<string, string> = {
    TABLE_NOT_FOUND: "La mesa no existe.",
    TABLE_ALREADY_OCCUPIED: "La mesa ya tiene una cuenta abierta.",
    TABLE_TAB_NOT_FOUND: "La cuenta no existe.",
    TABLE_TAB_NOT_OPEN: "La cuenta ya está cerrada.",
    BALANCE_NOT_ZERO: "No se puede cerrar: la cuenta tiene saldo pendiente.",
    PENDING_PAYMENT_EXISTS: "No se puede cerrar: hay un pago sin confirmar.",
    OPEN_BILLABLE_CHARGE_EXISTS: "No se puede cerrar: hay un cargo sin facturar.",
  }
  if (reason && messages[reason]) return messages[reason]
  return fallback
}
