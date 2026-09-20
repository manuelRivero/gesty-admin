"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { isAxiosError } from "axios"

import { useAdminSocket } from "@/contexts/admin-socket-context"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { OrdersTable } from "@/components/orders-table"
import type { Order } from "@/lib/data"
import {
  ADMIN_ORDERS_STATUS_ALL,
  fetchAdminOrderById,
  fetchAdminOrders,
  mapAdminOrderToOrder,
  type AdminOrdersAssignmentFilter,
} from "@/lib/requests/orders"
import {
  fetchDeliveryBusinessUsers,
  type BusinessUser,
} from "@/lib/requests/business-users"
import { fetchAdminBusinessConfig } from "@/lib/requests/business-config"

function monthBoundsISO() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

const ASSIGNMENT_FILTER_OPTIONS: {
  value: "all" | AdminOrdersAssignmentFilter
  label: string
}[] = [
  { value: "all", label: "Todos" },
  { value: "assigned", label: "Con repartidor" },
  { value: "unassigned", label: "Sin repartidor" },
]

const FULFILLMENT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "PICKUP", label: "Retiro" },
]

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: ADMIN_ORDERS_STATUS_ALL, label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "placed", label: "Pedido recibido" },
  { value: "preparing", label: "En preparación" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
]

function orderMatchesFilter(orderStatus: string, filter: string): boolean {
  if (filter === ADMIN_ORDERS_STATUS_ALL) return true
  return orderStatus.toLowerCase() === filter.toLowerCase()
}

const ORDER_HIGHLIGHT_MS = 12_000

function OrdersPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkOrderId = searchParams.get("orderId")
  const deepLinkProofId = searchParams.get("proofId")

  const { subscribeToOrderRealtime } = useAdminSocket()
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )
  const [highlightOrderIds, setHighlightOrderIds] = useState<string[]>([])

  const bounds = monthBoundsISO()
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState(bounds.from)
  const [dateTo, setDateTo] = useState(bounds.to)
  const [phoneFilter, setPhoneFilter] = useState("")
  const [debouncedPhone, setDebouncedPhone] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(
    ADMIN_ORDERS_STATUS_ALL,
  )
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | AdminOrdersAssignmentFilter
  >("all")
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all")
  const [deliveryUserFilter, setDeliveryUserFilter] = useState("all")
  const [deliveryUsers, setDeliveryUsers] = useState<BusinessUser[]>([])
  /** Flota propia: filtros de asignación. Externo: se ocultan. */
  const [ownFleetAssignment, setOwnFleetAssignment] = useState(true)

  const [orders, setOrders] = useState<Order[]>([])
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 1,
    pageSize: 20,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPhone(phoneFilter), 400)
    return () => clearTimeout(t)
  }, [phoneFilter])

  useEffect(() => {
    setPage(1)
  }, [
    dateFrom,
    dateTo,
    debouncedPhone,
    statusFilter,
    assignmentFilter,
    fulfillmentFilter,
    deliveryUserFilter,
  ])

  useEffect(() => {
    void fetchDeliveryBusinessUsers()
      .then(setDeliveryUsers)
      .catch(() => setDeliveryUsers([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const cfg = await fetchAdminBusinessConfig()
        if (cancelled) return
        const ownFleet = !cfg.external_delivery_enabled
        setOwnFleetAssignment(ownFleet)
        if (!ownFleet) {
          setAssignmentFilter("all")
          setDeliveryUserFilter("all")
        }
      } catch {
        if (!cancelled) setOwnFleetAssignment(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminOrders({
        page,
        dateFrom,
        dateTo,
        customerPhone: debouncedPhone.trim() || undefined,
        status: statusFilter,
        ...(ownFleetAssignment && assignmentFilter !== "all"
          ? { assignment: assignmentFilter }
          : {}),
        ...(ownFleetAssignment && deliveryUserFilter !== "all"
          ? { assignedDeliveryUserId: deliveryUserFilter }
          : {}),
        ...(fulfillmentFilter !== "all"
          ? { fulfillmentType: fulfillmentFilter }
          : {}),
      })
      setOrders(data.items.map(mapAdminOrderToOrder))
      setMeta({
        total: data.total,
        totalPages: data.totalPages > 0 ? data.totalPages : 1,
        pageSize: data.pageSize,
      })
    } catch (e) {
      setOrders([])
      if (isAxiosError(e)) {
        const msg =
          (e.response?.data as { message?: string })?.message ?? e.message
        setError(
          typeof msg === "string" && msg
            ? msg
            : "No se pudieron cargar los pedidos. Revisá la API y la sesión.",
        )
      } else {
        setError("Error inesperado al cargar los pedidos.")
      }
    } finally {
      setLoading(false)
    }
  }, [
    page,
    dateFrom,
    dateTo,
    debouncedPhone,
    statusFilter,
    assignmentFilter,
    fulfillmentFilter,
    deliveryUserFilter,
    ownFleetAssignment,
  ])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const mergeOrderIntoList = useCallback(
    (order: Order) => {
      setOrders((prev) => {
        const existed = prev.some((o) => o.id === order.id)
        const matches = orderMatchesFilter(order.status, statusFilter)
        if (!matches) {
          if (existed) {
            setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }))
          }
          return prev.filter((o) => o.id !== order.id)
        }
        if (!existed) {
          setMeta((m) => ({ ...m, total: m.total + 1 }))
        }
        return [order, ...prev.filter((o) => o.id !== order.id)]
      })
    },
    [statusFilter],
  )

  const clearDeepLink = useCallback(() => {
    if (!deepLinkOrderId && !deepLinkProofId) return
    router.replace("/orders", { scroll: false })
  }, [deepLinkOrderId, deepLinkProofId, router])

  useEffect(() => {
    return subscribeToOrderRealtime((payload) => {
      switch (payload.type) {
        case "order.created": {
          const orderId = payload.orderId
          void (async () => {
            try {
              const order = await fetchAdminOrderById(orderId)
              if (!orderMatchesFilter(order.status, statusFilter)) {
                return
              }
              mergeOrderIntoList(order)
              setHighlightOrderIds((ids) =>
                ids.includes(orderId) ? ids : [...ids, orderId],
              )
              const prevT = highlightTimersRef.current.get(orderId)
              if (prevT) clearTimeout(prevT)
              const t = setTimeout(() => {
                setHighlightOrderIds((ids) =>
                  ids.filter((x) => x !== orderId),
                )
                highlightTimersRef.current.delete(orderId)
              }, ORDER_HIGHLIGHT_MS)
              highlightTimersRef.current.set(orderId, t)
            } catch {
              /* noop */
            }
          })()
          break
        }
        case "order.status_changed":
        case "order.payment_status_changed": {
          const orderId = payload.orderId
          void (async () => {
            try {
              const order = await fetchAdminOrderById(orderId)
              mergeOrderIntoList(order)
            } catch {
              /* noop */
            }
          })()
          break
        }
        default:
          break
      }
    })
  }, [subscribeToOrderRealtime, statusFilter, mergeOrderIntoList])

  useEffect(() => {
    return () => {
      highlightTimersRef.current.forEach((t) => clearTimeout(t))
    }
  }, [])

  const canPrev = page > 1
  const canNext = page < meta.totalPages

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground">
          Consulta y gestiona los pedidos de tus clientes
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="orders-from">Desde</Label>
          <Input
            id="orders-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[11rem]"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="orders-to">Hasta</Label>
          <Input
            id="orders-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[11rem]"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="orders-status">Estado</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="orders-status" className="w-[12rem]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {ownFleetAssignment ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="orders-assignment">Asignación</Label>
              <Select
                value={assignmentFilter}
                onValueChange={(v) =>
                  setAssignmentFilter(v as "all" | AdminOrdersAssignmentFilter)
                }
              >
                <SelectTrigger id="orders-assignment" className="w-[12rem]">
                  <SelectValue placeholder="Asignación" />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="orders-delivery-user">Repartidor</Label>
              <Select
                value={deliveryUserFilter}
                onValueChange={setDeliveryUserFilter}
              >
                <SelectTrigger id="orders-delivery-user" className="w-[12rem]">
                  <SelectValue placeholder="Repartidor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {deliveryUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name?.trim() || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="orders-fulfillment">Modalidad</Label>
          <Select
            value={fulfillmentFilter}
            onValueChange={setFulfillmentFilter}
          >
            <SelectTrigger id="orders-fulfillment" className="w-[12rem]">
              <SelectValue placeholder="Modalidad" />
            </SelectTrigger>
            <SelectContent>
              {FULFILLMENT_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[12rem] flex-1 gap-2">
          <Label htmlFor="orders-phone">Teléfono cliente</Label>
          <Input
            id="orders-phone"
            type="search"
            inputMode="tel"
            autoComplete="off"
            placeholder="Ej. 549…"
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
          />
        </div>
      </div>

      <p className="text-right text-sm text-muted-foreground">
        {meta.total} pedido{meta.total === 1 ? "" : "s"} · Página {page} de{" "}
        {meta.totalPages}
        {meta.pageSize ? ` (${meta.pageSize} por página)` : ""}
      </p>

      <OrdersTable
        orders={orders}
        isLoading={loading}
        highlightOrderIds={highlightOrderIds}
        onOrderPatched={mergeOrderIntoList}
        deepLinkOrderId={deepLinkOrderId}
        deepLinkProofId={deepLinkProofId}
        onDeepLinkConsumed={clearDeepLink}
      />

      {!loading && meta.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {meta.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canNext}
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
          >
            Siguiente
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageContent />
    </Suspense>
  )
}
