"use client"

import { useCallback, useEffect, useState } from "react"
import { isAxiosError } from "axios"
import { RefreshCw } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchSuperAdminInvoicingBusinesses,
  fetchSuperAdminInvoicingIssues,
  fetchSuperAdminInvoicingUsage,
  type SuperAdminInvoicingBusiness,
  type SuperAdminInvoicingIssue,
  type SuperAdminInvoicingUsageRow,
} from "@/lib/requests/invoicing"

function getErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback
  const data = error.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? error.message ?? fallback
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-AR")
}

function formatMoney(value: string, currency: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${value} ${currency}`
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

function providerLabel(provider: string): string {
  return provider === "sistemas360" ? "Sistemas 360" : "Proveedor no reconocido"
}

function issueStatus(issue: SuperAdminInvoicingIssue) {
  switch (issue.status) {
    case "requires_review":
      return <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300">Requiere revisión</Badge>
    case "rejected":
      return <Badge variant="destructive">Rechazado</Badge>
    case "failed":
      return <Badge variant="outline" className="border-slate-400 text-slate-700 dark:text-slate-300">Fallido</Badge>
  }
}

function voucherLabel(issue: SuperAdminInvoicingIssue): string {
  const kind = issue.kind === "credit_note" ? "Nota de crédito" : "Factura"
  return issue.voucher_type ? `${kind} ${issue.voucher_type}` : kind
}

function voucherIdentifier(issue: SuperAdminInvoicingIssue): string {
  if (issue.punto_venta != null && issue.comprobante_numero != null) {
    return `${String(issue.punto_venta).padStart(5, "0")}-${String(issue.comprobante_numero).padStart(8, "0")}`
  }
  return issue.id
}

function environmentLabel(environment: string | null): string {
  if (environment === "sandbox") return "Sandbox"
  if (environment === "production") return "Producción"
  return "No informado"
}

function IssuesTable({ issues }: { issues: SuperAdminInvoicingIssue[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Restaurante</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Importe</TableHead>
            <TableHead>Proveedor / entorno</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Intentos</TableHead>
            <TableHead>Actualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.id}>
              <TableCell className="min-w-40">
                <div className="font-medium">{issue.business.name}</div>
                <div className="text-xs text-muted-foreground">{issue.business.id}</div>
              </TableCell>
              <TableCell className="font-mono text-xs">{voucherIdentifier(issue)}</TableCell>
              <TableCell>{voucherLabel(issue)}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(issue.issued_at ?? issue.created_at)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatMoney(issue.amount, issue.currency_code)}
              </TableCell>
              <TableCell className="min-w-36">
                <div>{providerLabel(issue.provider)}</div>
                <div className="text-xs text-muted-foreground">{environmentLabel(issue.provider_environment)}</div>
              </TableCell>
              <TableCell>{issueStatus(issue)}</TableCell>
              <TableCell className="min-w-52 whitespace-normal">
                {issue.error_message ?? "Sin detalle informado"}
              </TableCell>
              <TableCell className="text-center tabular-nums">{issue.retry_count}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(issue.updated_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function SuperAdminInvoicingIssuesSection() {
  const [issues, setIssues] = useState<SuperAdminInvoicingIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadIssues = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { invoices } = await fetchSuperAdminInvoicingIssues()
      setIssues(invoices)
    } catch (loadError) {
      setError(getErrorMessage(loadError, "No se pudieron cargar las incidencias."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadIssues()
  }, [loadIssues])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Incidencias de facturación</CardTitle>
          <CardDescription>
            Comprobantes rechazados, fallidos o que requieren revisión. El endpoint entrega hasta
            100 registros recientes y no ofrece paginación.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadIssues()}
          disabled={isLoading}
          aria-label="Actualizar incidencias de facturación"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error al cargar incidencias</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando incidencias…</p>
        ) : issues.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay incidencias de facturación para mostrar.
          </p>
        ) : (
          <IssuesTable issues={issues} />
        )}
      </CardContent>
    </Card>
  )
}

function UsageTable({ rows }: { rows: SuperAdminInvoicingUsageRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Restaurante</TableHead>
            <TableHead className="text-right">Requests técnicos registrados</TableHead>
            <TableHead className="text-right">Comprobantes autorizados</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-medium">{row.business.name}</div>
                <div className="text-xs text-muted-foreground">{row.business.id}</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.provider_requests}</TableCell>
              <TableCell className="text-right tabular-nums">{row.vouchers_authorized}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function SuperAdminInvoicingUsageSection() {
  const [usage, setUsage] = useState<{ period: string; rows: SuperAdminInvoicingUsageRow[] } | null>(null)
  const [period, setPeriod] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUsage = useCallback(async (requestedPeriod?: string) => {
    setIsLoading(true)
    setError(null)
    setUsage(null)
    try {
      const result = await fetchSuperAdminInvoicingUsage(requestedPeriod)
      setUsage(result)
      setPeriod(result.period)
    } catch (loadError) {
      setError(getErrorMessage(loadError, "No se pudo cargar el consumo de facturación."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsage()
  }, [loadUsage])

  const technicalRequests = usage
    ? usage.rows.reduce((total, row) => total + row.provider_requests, 0)
    : null
  const authorizedVouchers = usage
    ? usage.rows.reduce((total, row) => total + row.vouchers_authorized, 0)
    : null

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Consumo global de facturación</CardTitle>
          <CardDescription>
            Período informado por backend: {usage?.period ?? "—"}. Los requests registrados por
            negocio no incluyen el proveedor; no se atribuyen exclusivamente a Sistemas 360. Los
            comprobantes autorizados se muestran por separado.
          </CardDescription>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="invoicing-usage-period" className="text-xs">Período</Label>
            <Input
              id="invoicing-usage-period"
              type="month"
              value={period}
              onChange={(event) => {
                const nextPeriod = event.target.value
                setPeriod(nextPeriod)
                if (nextPeriod) void loadUsage(nextPeriod)
              }}
              disabled={isLoading}
              className="w-40"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadUsage(period || undefined)}
            disabled={isLoading}
            aria-label="Actualizar consumo global de facturación"
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error al cargar consumo</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Requests técnicos registrados por negocio</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {technicalRequests == null ? (isLoading ? "…" : "—") : technicalRequests}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Conteo del período por negocio; no identifica proveedor y no equivale al total
              histórico de requests de Sistemas 360 mostrado arriba.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Comprobantes autorizados</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {authorizedVouchers == null ? (isLoading ? "…" : "—") : authorizedVouchers}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Conteo comercial separado de los requests técnicos.
            </CardContent>
          </Card>
        </div>
        {isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando consumo…</p>
        ) : usage?.rows.length ? (
          <UsageTable rows={usage.rows} />
        ) : error ? null : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No hay datos de consumo para el período informado.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function BusinessesTable({ businesses }: { businesses: SuperAdminInvoicingBusiness[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Restaurante</TableHead>
            <TableHead>Identificador</TableHead>
            <TableHead>Complemento</TableHead>
            <TableHead>Activado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.business.name}</TableCell>
              <TableCell className="font-mono text-xs">{item.business.id}</TableCell>
              <TableCell>
                <Badge variant={item.enabled ? "default" : "outline"}>
                  {item.enabled ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(item.activated_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function SuperAdminInvoicingBusinessesSection() {
  const [businesses, setBusinesses] = useState<SuperAdminInvoicingBusiness[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBusinesses = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { businesses: result } = await fetchSuperAdminInvoicingBusinesses()
      setBusinesses(result)
    } catch (loadError) {
      setError(getErrorMessage(loadError, "No se pudieron cargar los restaurantes adheridos."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBusinesses()
  }, [loadBusinesses])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Restaurantes adheridos</CardTitle>
          <CardDescription>
            El endpoint lista negocios con el complemento activo; no incluye proveedor ni estado
            de configuración fiscal.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadBusinesses()}
          disabled={isLoading}
          aria-label="Actualizar restaurantes adheridos"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error al cargar restaurantes</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando restaurantes…</p>
        ) : businesses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay restaurantes adheridos para mostrar.
          </p>
        ) : (
          <BusinessesTable businesses={businesses} />
        )}
      </CardContent>
    </Card>
  )
}
