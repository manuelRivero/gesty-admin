"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  fetchKitchenTickets,
  patchKitchenTicketItemStatus,
  KITCHEN_TICKET_ITEM_STATUS_LABELS_ES,
  type KitchenTicket,
  type KitchenTicketItemStatus,
} from "@/lib/requests/kitchen-tickets"

/** Próximo estado al que puede avanzar un ítem con un solo click, o null si ya es terminal. */
const NEXT_STATUS: Partial<Record<KitchenTicketItemStatus, "preparing" | "ready">> = {
  pending: "preparing",
  preparing: "ready",
}

const NEXT_STATUS_LABEL: Record<"preparing" | "ready", string> = {
  preparing: "Marcar en preparación",
  ready: "Marcar listo",
}

/** Colores por estado — misma convención de la app (emerald=ok, amber=pendiente, rose=cancelado). */
const STATUS_BADGE_CLASSNAME: Record<KitchenTicketItemStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  preparing: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-400",
  ready: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  canceled: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-400",
}

const FILTERS: { value: KitchenTicketItemStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listos" },
  { value: "canceled", label: "Cancelados" },
  { value: "all", label: "Todos" },
]

interface KitchenTicketItemRow {
  ticketId: string
  itemId: string
  tableNames: string[]
  roundNumber: number | null
  menuItemName: string
  quantity: number
  notes: string | null
  status: KitchenTicketItemStatus
}

export default function KdsPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<KitchenTicketItemStatus | "all">("pending")

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setTickets(await fetchKitchenTickets())
    } catch {
      toast.error("No se pudieron cargar las comandas.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo<KitchenTicketItemRow[]>(() => {
    return tickets.flatMap((ticket) =>
      ticket.items.map((item) => ({
        ticketId: ticket.id,
        itemId: item.id,
        tableNames: ticket.tableNames,
        roundNumber: ticket.roundNumber,
        menuItemName: item.menuItemName,
        quantity: item.quantity,
        notes: item.notes,
        status: item.status,
      })),
    )
  }, [tickets])

  const visibleRows = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((row) => row.status === statusFilter)),
    [rows, statusFilter],
  )

  async function handleAdvance(itemId: string, nextStatus: "preparing" | "ready") {
    setUpdatingItemId(itemId)
    try {
      await patchKitchenTicketItemStatus(itemId, nextStatus)
      setTickets((prev) =>
        prev.map((ticket) => ({
          ...ticket,
          items: ticket.items.map((item) =>
            item.id === itemId ? { ...item, status: nextStatus } : item,
          ),
        })),
      )
      if (nextStatus === "ready") {
        toast.success("Comanda marcada como lista.")
      }
    } catch {
      toast.error("No se pudo actualizar el estado de la comanda.")
    } finally {
      setUpdatingItemId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cocina (KDS)</h1>
        <p className="text-sm text-muted-foreground">Comandas abiertas</p>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as KitchenTicketItemStatus | "all")}>
        <TabsList>
          {FILTERS.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay comandas en este estado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {visibleRows.map((row) => {
            const nextStatus = NEXT_STATUS[row.status]
            return (
              <Card key={row.itemId}>
                <CardHeader className="pb-2">
                  <CardTitle className="truncate text-sm font-medium">
                    {row.tableNames.length > 0 ? row.tableNames.join(" + ") : "Pedido sin mesa"}
                    {row.roundNumber ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        · Ronda {row.roundNumber}
                      </span>
                    ) : null}
                  </CardTitle>
                  <CardAction>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0", STATUS_BADGE_CLASSNAME[row.status])}
                    >
                      {KITCHEN_TICKET_ITEM_STATUS_LABELS_ES[row.status]}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="truncate text-sm">
                      {row.quantity}× {row.menuItemName}
                    </p>
                    {row.notes ? (
                      <p className="truncate text-xs italic text-muted-foreground">
                        Nota: {row.notes}
                      </p>
                    ) : null}
                  </div>
                  {nextStatus ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={updatingItemId === row.itemId}
                      onClick={() => handleAdvance(row.itemId, nextStatus)}
                    >
                      {NEXT_STATUS_LABEL[nextStatus]}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
