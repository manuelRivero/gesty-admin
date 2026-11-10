"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import { Loader2, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { TableElement, FLOOR_PLAN_CANVAS_CLASSNAME } from "@/components/tables/table-element"
import { AddRoundDialog } from "@/components/pos/add-round-dialog"
import { RecordPaymentDialog } from "@/components/pos/record-payment-dialog"
import { getOrderStatusLabelEs } from "@/lib/constants/orderWorkflow"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import { formatOrderMoney } from "@/lib/data"
import { getUserIdFromCookie, getUserRoleFromCookie } from "@/lib/auth"
import { useAdminSocket } from "@/contexts/admin-socket-context"
import { adminTableToUi, fetchAdminTables, type UiTable } from "@/lib/requests/admin-tables"
import { fetchAdminBusinessProfile } from "@/lib/requests/business-profile"
import {
  closeTableTab,
  fetchOpenTableTabs,
  fetchTableTabBalance,
  fetchTableTabOrders,
  getTableTabApiErrorMessage,
  openTableTab,
  type TableTabOrder,
} from "@/lib/requests/table-tabs"

type OccupiedTableInfo = {
  tableTabId: string
  assignedUserName: string | null
  /** Solo presente para ADMIN/OWNER (el backend lo omite para MOZO, §4.F). */
  balance: string | null
  /**
   * Si la cuenta ya tuvo alguna ronda — también solo confiable para
   * ADMIN/OWNER. Sin esto, una mesa recién abierta (saldo $0, sin ítems)
   * se pintaría igual que una ya pagada (también saldo $0).
   */
  hasOrders: boolean
}

const BALANCE_ZERO_THRESHOLD = 0.0001
function isBalanceZero(balance: string | null): boolean {
  return balance !== null && Number(balance) <= BALANCE_ZERO_THRESHOLD
}

function apiErrorMessage(e: unknown, fallback: string): string {
  if (!isAxiosError(e)) return fallback
  const d = e.response?.data as { message?: string; error?: string } | undefined
  const msg = d?.message ?? d?.error ?? e.message
  return typeof msg === "string" && msg.trim() ? msg.trim() : fallback
}

/**
 * Fase 8.1: plano de salón de solo lectura — reutiliza el mismo `TableElement`
 * /fondo de grilla que el editor (`/tables`), sin drag ni edición. El color
 * acá es libre/ocupada (no activa/inactiva), y el click abre el panel lateral
 * con la acción que corresponde al rol logueado, en vez de un formulario.
 *
 * Matriz de roles confirmada (auditada contra Fudo — separa "Cerrar ventas"
 * de "Cobrar mesa", ambos a nivel de supervisor/caja, nunca del mozo):
 *   - MOZO: opera la mesa — abre cuenta. No cierra, no cobra.
 *   - ADMIN/OWNER: revisan el consumo (el pedido) y cierran la cuenta.
 * El backend ya aplica esto en `/api/admin/table-tabs/*`; este panel solo
 * muestra la acción que el rol logueado puede ejecutar.
 */
export default function PosPage() {
  const [role, setRole] = useState<ReturnType<typeof getUserRoleFromCookie> | null>(null)
  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  const [tables, setTables] = useState<UiTable[]>([])
  const [occupiedByTableId, setOccupiedByTableId] = useState<Map<string, OccupiedTableInfo>>(
    new Map(),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [pendingTableId, setPendingTableId] = useState<string | null>(null)
  const [orders, setOrders] = useState<TableTabOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [addRoundOpen, setAddRoundOpen] = useState(false)
  const [balance, setBalance] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [currencyCode, setCurrencyCode] = useState("ARS")
  const { subscribeToTableTabRealtime } = useAdminSocket()
  const isMobile = useIsMobile()

  useEffect(() => {
    setRole(getUserRoleFromCookie())
    setOwnUserId(getUserIdFromCookie())
  }, [])

  // Solo ADMIN/OWNER manejan montos (saldo/cobro) — `GET /admin/business` es
  // exclusivo de ellos, así que ni se pide para MOZO.
  useEffect(() => {
    if (role !== "ADMIN" && role !== "OWNER") return
    fetchAdminBusinessProfile()
      .then((profile) => setCurrencyCode(profile.currency_code))
      .catch(() => {
        /* noop — se usa el default "ARS" si falla */
      })
  }, [role])

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [tablesList, openTabs] = await Promise.all([fetchAdminTables(), fetchOpenTableTabs()])
      setTables(tablesList.map(adminTableToUi))
      const map = new Map<string, OccupiedTableInfo>()
      for (const tab of openTabs) {
        for (const t of tab.tables) {
          map.set(t.tableId, {
            tableTabId: tab.id,
            assignedUserName: tab.assignedUserName,
            balance: tab.balance,
            hasOrders: tab.hasOrders,
          })
        }
      }
      setOccupiedByTableId(map)
    } catch (err) {
      setLoadError(apiErrorMessage(err, "No se pudo cargar el mapa de mesas."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const environmentOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const t of tables) {
      if (!byId.has(t.environmentId)) byId.set(t.environmentId, t.environmentName)
    }
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
  }, [tables])

  const activeEnvironmentId = useMemo(() => {
    if (environmentOptions.length === 0) return ""
    if (environmentOptions.some((e) => e.id === selectedEnvironmentId)) return selectedEnvironmentId
    return environmentOptions[0].id
  }, [environmentOptions, selectedEnvironmentId])

  const tablesInActiveEnvironment = useMemo(
    () => (activeEnvironmentId ? tables.filter((t) => t.environmentId === activeEnvironmentId) : []),
    [tables, activeEnvironmentId],
  )

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null
  const selectedOccupied = selectedTableId ? occupiedByTableId.get(selectedTableId) : undefined

  const isMozo = role === "MOZO"
  const isSupervisor = role === "ADMIN" || role === "OWNER"

  const loadOrders = useCallback(async (tableTabId: string) => {
    setOrdersLoading(true)
    setOrdersError(null)
    try {
      setOrders(await fetchTableTabOrders(tableTabId))
    } catch (err) {
      setOrdersError(apiErrorMessage(err, "No se pudo cargar el pedido de esta mesa."))
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  // Saldo pendiente: solo ADMIN/OWNER (caja). El mozo nunca lo pide — el
  // endpoint le devolvería 403 — así que ni se llama para ese rol. También
  // actualiza el mapa de ocupación para que el plano repinte la mesa de
  // amarillo ("lista para cerrar") sin esperar un `load()` completo.
  const loadBalance = useCallback(
    async (tableId: string, tableTabId: string) => {
      setBalanceLoading(true)
      setBalanceError(null)
      try {
        const b = await fetchTableTabBalance(tableTabId)
        setBalance(b)
        setOccupiedByTableId((prev) => {
          const current = prev.get(tableId);
          if (!current) return prev;
          const next = new Map(prev);
          next.set(tableId, { ...current, balance: b });
          return next;
        })
      } catch (err) {
        setBalanceError(apiErrorMessage(err, "No se pudo cargar el saldo de esta mesa."))
        setBalance(null)
      } finally {
        setBalanceLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (selectedOccupied && selectedTableId) {
      void loadOrders(selectedOccupied.tableTabId)
      if (isSupervisor) void loadBalance(selectedTableId, selectedOccupied.tableTabId)
    } else {
      setOrders([])
      setOrdersError(null)
      setBalance(null)
      setBalanceError(null)
    }
    // Solo cuando cambia la mesa seleccionada o su cuenta — no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTableId, selectedOccupied?.tableTabId, isSupervisor])

  // Cuando cierran una mesa del mozo logueado: mutación LOCAL del mapa de
  // ocupación, nunca un refetch. El toast y la entrada en la campana ya los
  // maneja el contexto (`admin-socket-context.tsx`), a nivel global, para
  // que lleguen aunque el mozo esté en `/kds` en ese momento — acá solo se
  // actualiza el plano. Llamar a `load()` acá disparaba `isLoading`, que
  // reemplaza TODA la pantalla por el skeleton de carga — desde la
  // perspectiva del mozo, eso se ve y se siente como si se le hubiera
  // "refrescado la página" en medio de lo que estuviera haciendo. Esta mesa
  // en particular ya se liberó según el propio evento; no hace falta
  // preguntarle al backend de nuevo para saberlo.
  useEffect(() => {
    if (!ownUserId) return
    return subscribeToTableTabRealtime((payload) => {
      if (payload.type !== "table_tab.closed") return
      if (payload.assignedUserAppUserId !== ownUserId) return

      const closedTableIds = new Set(payload.tableIds)
      setOccupiedByTableId((prev) => {
        if (![...closedTableIds].some((id) => prev.has(id))) return prev
        const next = new Map(prev)
        for (const tableId of closedTableIds) {
          next.delete(tableId)
        }
        return next
      })
      setSelectedTableId((current) => (current && closedTableIds.has(current) ? null : current))
    })
  }, [ownUserId, subscribeToTableTabRealtime])

  // Cuando un mozo abre una mesa: mutación LOCAL del mapa de ocupación para
  // que el plano de ADMIN/OWNER (y de cualquier otro mozo viéndolo) la pinte
  // como ocupada sin refrescar la pantalla — mismo criterio que el listener
  // de `table_tab.closed` arriba. Una cuenta recién abierta nunca trae
  // órdenes todavía, por eso `hasOrders: false` y `balance: "0"` fijos: así
  // nunca aparece "lista para cerrar" antes de que el mozo cargue nada.
  useEffect(() => {
    return subscribeToTableTabRealtime((payload) => {
      if (payload.type !== "table_tab.opened") return

      setOccupiedByTableId((prev) => {
        const next = new Map(prev)
        for (const tableId of payload.tableIds) {
          next.set(tableId, {
            tableTabId: payload.tableTabId,
            assignedUserName: payload.assignedUserName,
            balance: "0",
            hasOrders: false,
          })
        }
        return next
      })
    })
  }, [subscribeToTableTabRealtime])

  async function handleOpenTableTab(tableId: string) {
    setPendingTableId(tableId)
    try {
      await openTableTab(tableId)
      toast.success("Cuenta abierta.")
      await load()
      setSelectedTableId(tableId)
      setAddRoundOpen(true)
    } catch (err) {
      toast.error(getTableTabApiErrorMessage(err, "No se pudo abrir la cuenta."))
    } finally {
      setPendingTableId(null)
    }
  }

  async function handleCloseTableTab(tableId: string, tableTabId: string) {
    setPendingTableId(tableId)
    try {
      const { hasPendingKitchenItems } = await closeTableTab(tableTabId)
      toast.success(
        hasPendingKitchenItems
          ? "Cuenta cerrada. Atención: hay productos sin despachar en cocina."
          : "Cuenta cerrada.",
      )
      setSelectedTableId(null)
      await load()
    } catch (err) {
      toast.error(getTableTabApiErrorMessage(err, "No se pudo cerrar la cuenta."))
    } finally {
      setPendingTableId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  // Contenido del detalle de mesa — el mismo en desktop (panel lateral fijo)
  // y en mobile/tablet chica (Sheet superpuesto, ver más abajo). Evita que el
  // sidebar le robe ancho al plano en pantallas angostas: en mobile no
  // comparte columna con el canvas, flota encima.
  // El pedido de la mesa seleccionada ya se carga para ambos roles (`loadOrders`
  // corre siempre). Una mesa recién abierta, sin ninguna ronda todavía, tiene
  // saldo $0 igual que una ya pagada — por eso "lista para cerrar" exige
  // ADEMÁS que haya al menos un pedido, si no toda mesa recién abierta
  // aparecería como pagada antes de que el mozo cargue nada.
  const selectedHasOrders = orders.length > 0
  const selectedReadyToClose = isBalanceZero(balance) && selectedHasOrders

  const detailPanelContent = selectedTable ? (
    <>
      <div>
        <h2 className="text-lg font-semibold">{selectedTable.name}</h2>
        <p className="text-sm text-muted-foreground">
          Capacidad: {selectedTable.capacity} · {selectedTable.environmentName}
        </p>
      </div>

      <Badge
        variant={!selectedOccupied ? "secondary" : selectedReadyToClose ? "outline" : "destructive"}
        className={
          selectedOccupied && selectedReadyToClose
            ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            : undefined
        }
      >
        {!selectedOccupied ? "Libre" : selectedReadyToClose ? "Lista para cerrar" : "Ocupada"}
      </Badge>

      {isSupervisor && selectedOccupied && selectedReadyToClose ? (
        <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Saldo en $0 — el cliente pagó. Cerrá la cuenta cuando quieras liberar la mesa; hasta
          entonces va a seguir marcada como pendiente de cierre.
        </div>
      ) : null}

      {selectedOccupied ? (
        <>
          <p className="text-sm">
            Mozo: <span className="font-medium">{selectedOccupied.assignedUserName ?? "Sin asignar"}</span>
          </p>

          {isMozo ? (
            <Button variant="outline" className="w-full" onClick={() => setAddRoundOpen(true)}>
              Agregar ítems
            </Button>
          ) : null}

          {isSupervisor ? (
            <div className="space-y-1">
              <Label>Saldo pendiente</Label>
              {balanceLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : balanceError ? (
                <div className="space-y-1">
                  <p className="text-sm text-destructive">{balanceError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadBalance(selectedTable.id, selectedOccupied.tableTabId)}
                  >
                    Reintentar
                  </Button>
                </div>
              ) : (
                <p className="text-lg font-semibold">
                  {balance !== null ? formatOrderMoney(Number(balance), currencyCode) : "—"}
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Pedido</Label>
            {ordersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : ordersError ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{ordersError}</p>
                <Button variant="outline" size="sm" onClick={() => void loadOrders(selectedOccupied.tableTabId)}>
                  Reintentar
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no se registró ninguna ronda en esta cuenta.
              </p>
            ) : (
              <ul className="space-y-3">
                {orders.map((order, i) => (
                  <li key={order.orderId} className="rounded-md border bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Ronda {i + 1}</span>
                      <span>{getOrderStatusLabelEs(order.status)}</span>
                    </div>
                    <ul className="mt-1 space-y-1 text-sm">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {item.quantity}× {item.menuItemName}
                              {item.variation ? ` (${item.variation})` : ""}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatMenuItemPrice(item.unitPrice)}
                            </span>
                          </div>
                          {item.notes ? (
                            <p className="truncate text-xs italic text-muted-foreground">
                              Nota: {item.notes}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {order.totalAmount ? (
                      <p className="mt-1 text-right text-sm font-medium">
                        {formatMenuItemPrice(order.totalAmount)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Mesa libre.</p>
      )}

      {isMozo && !selectedOccupied ? (
        <Button
          className="w-full"
          disabled={pendingTableId === selectedTable.id}
          onClick={() => handleOpenTableTab(selectedTable.id)}
        >
          {pendingTableId === selectedTable.id ? <Loader2 className="size-4 animate-spin" /> : "Abrir cuenta"}
        </Button>
      ) : null}

      {isSupervisor && selectedOccupied ? (
        <>
          <Button
            className="w-full"
            disabled={balanceLoading || balance === null}
            onClick={() => setRecordPaymentOpen(true)}
          >
            Cobrar
          </Button>
          <Button
            variant="outline"
            className={cn("w-full")}
            disabled={
              pendingTableId === selectedTable.id ||
              balanceLoading ||
              balance === null ||
              Number(balance) > 0.0001
            }
            title={
              balance !== null && Number(balance) > 0.0001
                ? "No se puede cerrar: la cuenta tiene saldo pendiente."
                : undefined
            }
            onClick={() => handleCloseTableTab(selectedTable.id, selectedOccupied.tableTabId)}
          >
            {pendingTableId === selectedTable.id ? <Loader2 className="size-4 animate-spin" /> : "Cerrar cuenta"}
          </Button>
        </>
      ) : null}
    </>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Salón</h1>
        <p className="text-muted-foreground">
          {isSupervisor
            ? "Tocá una mesa ocupada para revisar el pedido y cerrar la cuenta."
            : "Tocá una mesa libre para abrir cuenta."}
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-semibold">Error</p>
          <p className="text-pretty">{loadError}</p>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!loadError && environmentOptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay mesas creadas. Pedile a un administrador que las agregue desde{" "}
          <a href="/tables" className="underline">
            Mesas
          </a>
          .
        </p>
      ) : null}

      {environmentOptions.length > 0 ? (
        <div className="flex items-center gap-2">
          <Label htmlFor="pos-environment-filter" className="text-sm font-medium">
            Ambiente:
          </Label>
          <Select value={activeEnvironmentId} onValueChange={setSelectedEnvironmentId}>
            <SelectTrigger id="pos-environment-filter" className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {environmentOptions.map((env) => (
                <SelectItem key={env.id} value={env.id}>
                  {env.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {environmentOptions.length > 0 ? (
        <div className="flex flex-col gap-6 md:flex-row">
          {/* El scroll horizontal tiene que vivir en la `Card` misma — un
              wrapper por fuera con `overflow-x-auto` y la `Card` con
              `overflow-hidden` (como en `/tables`) no funciona: el
              `overflow-hidden` recorta el canvas ancho ANTES de que el
              wrapper externo llegue a verlo más ancho que él, así que nunca
              tiene nada para scrollear. `min-w-[900px]` en el canvas: en
              pantallas angostas se scrollea horizontal en vez de
              achicar/superponer las mesas (que tienen posición absoluta en
              píxeles reales). */}
          <div className="min-w-0 flex-1">
            <Card className="min-w-0 overflow-x-auto overflow-y-hidden">
              <CardContent className="min-w-0 p-0">
                <div className={cn(FLOOR_PLAN_CANVAS_CLASSNAME, "min-w-[900px]")}>
                  {tablesInActiveEnvironment.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-muted-foreground">
                      <Square className="h-12 w-12 opacity-40" />
                      <p className="text-sm">No hay mesas en este ambiente</p>
                    </div>
                  ) : (
                    tablesInActiveEnvironment.map((table) => {
                      const occupied = occupiedByTableId.get(table.id)
                      const paidPendingClose =
                        Boolean(occupied) &&
                        Boolean(occupied?.hasOrders) &&
                        isBalanceZero(occupied?.balance ?? null)
                      return (
                        <TableElement
                          key={table.id}
                          table={table}
                          color={!occupied ? "free" : paidPendingClose ? "paid_pending_close" : "occupied"}
                          isSelected={selectedTableId === table.id}
                          subLabel={
                            isSupervisor && occupied
                              ? paidPendingClose
                                ? "Lista para cerrar"
                                : `Mozo: ${occupied.assignedUserName ?? "Sin asignar"}`
                              : undefined
                          }
                          onClick={() => setSelectedTableId(table.id)}
                        />
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop/tablet grande: panel lateral fijo, no se superpone al plano. */}
          {!isMobile && selectedTable ? (
            <Card className="w-[320px] shrink-0">
              <CardContent className="space-y-4 pt-6">{detailPanelContent}</CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Mobile/tablet chica: el detalle flota ENCIMA del plano (Sheet) en vez
          de compartir columna y achicar el canvas — mismo contenido para
          todos los roles, no solo mozo. */}
      {isMobile ? (
        <Sheet
          open={Boolean(selectedTable)}
          onOpenChange={(open) => {
            if (!open) setSelectedTableId(null)
          }}
        >
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
            <SheetHeader>
              <SheetTitle className="sr-only">{selectedTable?.name ?? "Detalle de mesa"}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">{detailPanelContent}</div>
          </SheetContent>
        </Sheet>
      ) : null}

      {selectedOccupied ? (
        <AddRoundDialog
          open={addRoundOpen}
          onOpenChange={setAddRoundOpen}
          tableTabId={selectedOccupied.tableTabId}
          onSuccess={() => void loadOrders(selectedOccupied.tableTabId)}
        />
      ) : null}

      {selectedOccupied && selectedTableId && balance !== null ? (
        <RecordPaymentDialog
          open={recordPaymentOpen}
          onOpenChange={setRecordPaymentOpen}
          tableTabId={selectedOccupied.tableTabId}
          balance={balance}
          currencyCode={currencyCode}
          onSuccess={() => void loadBalance(selectedTableId, selectedOccupied.tableTabId)}
        />
      ) : null}
    </div>
  )
}
