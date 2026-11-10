"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import { fetchAdminMenuItems } from "@/lib/requests/menu-items"
import type { MenuItem } from "@/components/menu-items/types"
import {
  createTableTabRound,
  getCreateRoundApiErrorMessage,
} from "@/lib/requests/table-tabs"

/**
 * Fase 8.1: armar una ronda (tomar pedido) sobre una cuenta de salón abierta.
 * Lista plana del menú disponible con un stepper de cantidad — sin
 * categorías ni variaciones todavía (iteración posterior si se necesita).
 */
export function AddRoundDialog({
  open,
  onOpenChange,
  tableTabId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableTabId: string
  onSuccess: () => void
}) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuantities({})
    setSearch("")
    setIsLoading(true)
    setLoadError(null)
    fetchAdminMenuItems({ all: true, includeUnavailable: false })
      .then((res) => setMenuItems(res.items))
      .catch(() => setLoadError("No se pudo cargar el menú."))
      .finally(() => setIsLoading(false))
  }, [open])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return menuItems
    return menuItems.filter((m) => m.name.toLowerCase().includes(q))
  }, [menuItems, search])

  const selectedCount = Object.values(quantities).reduce((sum, qty) => sum + qty, 0)

  function setQuantity(menuItemId: string, qty: number) {
    setQuantities((prev) => {
      const next = { ...prev }
      if (qty <= 0) {
        delete next[menuItemId]
      } else {
        next[menuItemId] = Math.min(qty, 99)
      }
      return next
    })
  }

  async function handleSubmit() {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }))
    if (items.length === 0) return

    setSubmitting(true)
    try {
      await createTableTabRound(tableTabId, items)
      toast.success("Ronda agregada.")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(getCreateRoundApiErrorMessage(err, "No se pudo agregar la ronda."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar ítems</DialogTitle>
          <DialogDescription>
            Elegí los productos y la cantidad. Se agregan como una ronda nueva a la cuenta.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Buscar producto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isLoading || submitting}
        />

        {isLoading ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : loadError ? (
          <p className="py-2 text-sm text-destructive">{loadError}</p>
        ) : filteredItems.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No se encontraron productos.</p>
        ) : (
          <ScrollArea className="h-[360px]">
            <ul className="space-y-2 pr-3">
              {filteredItems.map((item) => {
                const qty = quantities[item.id] ?? 0
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMenuItemPrice(item.price, item.currencyCode)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-7"
                        disabled={qty === 0 || submitting}
                        onClick={() => setQuantity(item.id, qty - 1)}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-7"
                        disabled={submitting}
                        onClick={() => setQuantity(item.id, qty + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={selectedCount === 0 || submitting}>
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {submitting ? "Agregando…" : `Agregar (${selectedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
