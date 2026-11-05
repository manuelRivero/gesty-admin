"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { isAxiosError } from "axios"
import {
  ArrowRight,
  FileText,
  Receipt,
  Settings2,
} from "lucide-react"
import { toast } from "sonner"

import { EmissionDisabledNotice } from "@/components/invoicing/emission-disabled-notice"
import { BillingReadinessBadge } from "@/components/invoicing/invoicing-status-badges"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  deriveBillingReadiness,
  fetchFiscalConfiguration,
  fetchInvoicingAddon,
  fetchInvoicingUsage,
  type FiscalConfiguration,
  type InvoicingAddon,
  type InvoicingUsagePeriod,
} from "@/lib/requests/invoicing"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

function OverviewLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  )
}

export default function InvoicingOverviewPage() {
  return (
    <Suspense fallback={<OverviewLoadingSkeleton />}>
      <InvoicingOverviewContent />
    </Suspense>
  )
}

/** Exportado (además del default) para poder testear sin mockear `Suspense`. */
export function InvoicingOverviewContent() {
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfiguration | null>(null)
  const [addon, setAddon] = useState<InvoicingAddon | null>(null)
  const [usage, setUsage] = useState<InvoicingUsagePeriod | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const [configRes, addonRes, usageRes] = await Promise.all([
        fetchFiscalConfiguration(),
        fetchInvoicingAddon(),
        fetchInvoicingUsage(),
      ])
      setFiscalConfig(configRes.fiscalConfiguration)
      setAddon(addonRes.addon)
      setUsage(usageRes.current)
    } catch (err) {
      setLoadError(true)
      toast.error(errorMessage(err, "No se pudo cargar la facturación electrónica."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (isLoading) {
    return <OverviewLoadingSkeleton />
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Receipt className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          No se pudo cargar la información de facturación electrónica.
        </p>
        <Button variant="outline" onClick={() => void loadData()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const billingReadiness = deriveBillingReadiness(fiscalConfig)
  const period = usage?.period ?? "este período"
  const vouchersAuthorized = usage?.vouchers_authorized ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Facturación electrónica</h1>
        <p className="text-muted-foreground">
          Complemento opcional, independiente de tu suscripción de Gesty. Proveedor: Sistemas 360.
        </p>
      </div>

      <EmissionDisabledNotice />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-4" />
              Configuración fiscal
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <BillingReadinessBadge state={billingReadiness} />
            <p className="text-sm text-muted-foreground">
              {fiscalConfig?.cuit
                ? `CUIT ${fiscalConfig.cuit} · Punto de venta administrado por Sistemas 360`
                : "Todavía no completaste los datos fiscales del negocio."}
            </p>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/invoicing/settings">
                Ir a configuración <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" />
              Complemento
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Badge
              className={
                addon?.enabled
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300"
              }
            >
              {addon?.enabled ? "Activado" : "Desactivado"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Independiente de tu suscripción de Gesty: podés activarlo o desactivarlo sin afectar
              tu plan.
            </p>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/invoicing/addon">
                Ver complemento <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" />
              Comprobantes autorizados
            </CardTitle>
            <CardDescription>Período {period}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-semibold tracking-tight">{vouchersAuthorized}</p>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/invoicing/history">
                Ver historial <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {billingReadiness === "pending_data" ? (
        <Alert>
          <AlertTitle>Todavía no configuraste la facturación electrónica</AlertTitle>
          <AlertDescription>
            Completá los datos fiscales del negocio desde{" "}
            <Link href="/invoicing/settings" className="underline">Configuración</Link>. Gesty se
            encarga del resto.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
