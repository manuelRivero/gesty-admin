"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { isAxiosError } from "axios"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { ToggleField } from "@/components/settings/toggle-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatOrderMoney } from "@/lib/data"
import { getUserRoleFromCookie } from "@/lib/auth"
import {
  fetchInvoicingAddon,
  fetchInvoicingUsage,
  saveInvoicingAddon,
  type InvoicingAddon,
  type InvoicingUsagePeriod,
} from "@/lib/requests/invoicing"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

/** Monto comercial a mostrar o "pendiente de definición" si el backend lo tiene en `null`. */
function formatCommercialAmount(value: string | null, currencyCode: string): string {
  if (value === null) return "Pendiente de definición"
  return formatOrderMoney(Number(value), currencyCode)
}

export default function InvoicingAddonPage() {
  const [addon, setAddon] = useState<InvoicingAddon | null>(null)
  const [usage, setUsage] = useState<InvoicingUsagePeriod | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  // Gate solo de presentación: el backend habilita este endpoint por igual a ADMIN y OWNER — no
  // hay una distinción de rol real del lado del servidor para el costo del proveedor.
  const [isOwner, setIsOwner] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [addonRes, usageRes] = await Promise.all([
        fetchInvoicingAddon(),
        fetchInvoicingUsage(),
      ])
      setAddon(addonRes.addon)
      setUsage(usageRes.current)
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo cargar el complemento de facturación."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setIsOwner(getUserRoleFromCookie() === "OWNER")
    void loadData()
  }, [loadData])

  const handleToggle = async (enabled: boolean) => {
    setIsSaving(true)
    try {
      const { addon: updated } = await saveInvoicingAddon({ enabled })
      setAddon(updated)
      toast.success(enabled ? "Complemento activado." : "Complemento desactivado.")
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo actualizar el complemento."))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const currency = addon?.currency_code ?? "USD"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
          <Link href="/invoicing">
            <ArrowLeft className="size-4" />
            Volver a facturación
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Complemento de facturación</h1>
        <p className="text-muted-foreground">
          Es un producto independiente de tu suscripción de Gesty. Activarlo o desactivarlo no
          cambia tu plan ni tu precio mensual.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activación</CardTitle>
          <CardDescription>
            El complemento no cobra porcentajes sobre tus ventas ni por cada consulta técnica —
            solo, cuando se defina comercialmente, por comprobante autorizado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleField
            id="addonEnabled"
            label="Complemento de facturación electrónica"
            description={
              addon?.enabled
                ? "Activado."
                : "Desactivado: no se registran comprobantes mientras esté apagado."
            }
            checked={addon?.enabled ?? false}
            onCheckedChange={(checked) => void handleToggle(checked)}
            disabled={isSaving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consumo del período</CardTitle>
          <CardDescription>Período {usage?.period ?? "actual"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Comprobantes autorizados</span>
            <span className="text-2xl font-semibold">{usage?.vouchers_authorized ?? 0}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Límite mensual contratado</span>
            <span className="text-2xl font-semibold">
              {addon?.monthly_voucher_limit ?? "Sin límite configurado"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Consumo acumulado (estimado)</span>
            <span className="text-lg font-medium">
              {formatCommercialAmount(usage?.commercial_amount_total ?? null, currency)}
            </span>
          </div>
          {isOwner ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Costo del proveedor (estimado)</span>
              <span className="text-lg font-medium">
                {formatCommercialAmount(usage?.provider_cost_total ?? null, currency)}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Precio comercial</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Precio por comprobante</span>
            <span className="text-lg font-medium">
              {formatCommercialAmount(addon?.price_per_voucher ?? null, currency)}
            </span>
          </div>
          {!addon?.price_per_voucher ? (
            <Alert>
              <AlertTitle>Tarifa todavía sin definir</AlertTitle>
              <AlertDescription>
                Gesty todavía no fijó un precio comercial para este complemento. No se te va a
                cobrar nada hasta que exista una tarifa confirmada y un mecanismo de cobro
                habilitado.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
