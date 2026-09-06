"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import { AlertCircle, CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PaymentProviderCard } from "@/components/online-payments/payment-provider-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  fetchAdminPaymentProviders,
  type AdminPaymentProvider,
  type AvailablePaymentProvider,
} from "@/lib/requests/payment-providers"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

export default function OnlinePaymentsPage() {
  const [items, setItems] = useState<AdminPaymentProvider[]>([])
  const [availableProviders, setAvailableProviders] = useState<
    AvailablePaymentProvider[]
  >([])
  const [isLoading, setIsLoading] = useState(true)

  const loadProviders = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchAdminPaymentProviders()
      setItems(data.items)
      setAvailableProviders(data.availableProviders)
    } catch (err) {
      toast.error(
        errorMessage(err, "No se pudieron cargar los métodos de pago online."),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  const configuredByProvider = useMemo(() => {
    const map = new Map<string, AdminPaymentProvider>()
    for (const item of items) {
      map.set(item.provider, item)
    }
    return map
  }, [items])

  const hasActiveProvider = useMemo(
    () => items.some((item) => item.isActive),
    [items],
  )

  const providersToShow = useMemo(() => {
    if (availableProviders.length > 0) return availableProviders
    return items.map((item) => ({
      id: item.provider,
      name: item.provider,
      image: null,
      description: null,
    }))
  }, [availableProviders, items])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pagos online</h1>
        <p className="text-muted-foreground">
          Configurá y activá los métodos de pago para que tus clientes puedan
          pagar pedidos desde la web o el bot.
        </p>
      </div>

      {!isLoading && !hasActiveProvider ? (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="text-amber-600" />
          <AlertTitle>Ningún método activo</AlertTitle>
          <AlertDescription>
            Activá al menos un proveedor antes de vender online. El método
            &quot;Pago online&quot; en ajustes de pago no cuenta sin Mercado Pago
            activo. Esto no habilita pedidos automáticamente.
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : providersToShow.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <CreditCard className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Sin proveedores disponibles</p>
            <p className="text-sm text-muted-foreground">
              El backend no devolvió métodos de pago configurables.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providersToShow.map((provider) => (
            <PaymentProviderCard
              key={provider.id}
              available={provider}
              configured={configuredByProvider.get(provider.id) ?? null}
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando métodos de pago…
        </div>
      ) : null}
    </div>
  )
}
