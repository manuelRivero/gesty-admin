"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchKitchenTickets, type KitchenTicket } from "@/lib/requests/kitchen-tickets"

/**
 * Fase 8.1: scaffolding mínimo del KDS — solo la ruta protegida y el
 * snapshot REST (`GET /api/admin/kitchen-tickets`) renderizado como lista
 * básica. El diseño real de la pantalla de cocina (tiempo real, por
 * estación, transición de estado) es una iteración posterior.
 */
export default function KdsPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cocina (KDS)</h1>
        <p className="text-sm text-muted-foreground">
          Comandas abiertas — vista preliminar, sin tiempo real todavía.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay comandas abiertas.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Comanda #{ticket.id.slice(0, 8)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ticket.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span>
                      {item.quantity}× ítem {item.menuItemId.slice(0, 8)}
                    </span>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
