"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { isAxiosError } from "axios"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { InvoiceStatusBadge } from "@/components/invoicing/invoicing-status-badges"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatOrderMoney, formatShortOrderId } from "@/lib/data"
import {
  fetchInvoicePdfDataUrl,
  fetchInvoicingInvoices,
  invoiceEmissionReasonMessage,
  retryInvoiceEmission,
  INVOICE_KIND_LABEL,
  type FiscalInvoice,
  type FiscalInvoiceStatus,
} from "@/lib/requests/invoicing"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

/**
 * Solo `failed` (falló ANTES de contactar al proveedor, ver `markFailedBeforeSend` del backend)
 * ofrece un botón de reintento manual. `requires_review` ya se reconcilia solo de forma segura
 * (ver el mensaje de esa fila más abajo) — un botón ahí sugeriría una acción que no hace falta y
 * que, para ese estado, el backend trata como reconciliación, no como reemisión.
 */
const RETRYABLE_STATUSES: FiscalInvoiceStatus[] = ["failed"]

function formatDateLabel(iso: string | null): string {
  if (!iso) return "—"
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es })
  } catch {
    return iso
  }
}

const STATUS_FILTER_OPTIONS: { value: "all" | FiscalInvoiceStatus; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "authorized", label: "Autorizado" },
  { value: "pending", label: "Pendiente" },
  { value: "processing", label: "En proceso" },
  { value: "requires_review", label: "Requiere revisión" },
  { value: "rejected", label: "Rechazado" },
  { value: "failed", label: "Error" },
  { value: "cancelled", label: "Cancelado" },
  { value: "simulated", label: "Simulado (sin validez fiscal)" },
]

const PAGE_SIZE = 25

/**
 * No todo proveedor persiste una URL pública de PDF (Sistemas 360 requiere el Bearer de la
 * cuenta): si `pdf_url` viene vacío pero el comprobante está autorizado/simulado, se pide a
 * demanda vía `GET /admin/invoicing/orders/:orderId/invoices/:invoiceId/pdf`.
 */
function InvoicePdfCell({ invoice }: { invoice: FiscalInvoice }) {
  const [isLoading, setIsLoading] = useState(false)

  if (invoice.pdf_url) {
    return (
      <Button asChild variant="ghost" size="sm">
        <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
          Ver PDF <ExternalLink className="size-3.5" />
        </a>
      </Button>
    )
  }

  if (invoice.status !== "authorized" && invoice.status !== "simulated") {
    return <>—</>
  }

  const handleOpen = async () => {
    setIsLoading(true)
    try {
      const dataUrl = await fetchInvoicePdfDataUrl(invoice.order_id, invoice.id)
      window.open(dataUrl, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo obtener el PDF."))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => void handleOpen()} disabled={isLoading}>
      {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
      Ver PDF
    </Button>
  )
}

/**
 * Reintento manual (`POST /admin/invoicing/orders/:orderId/emit`). Idempotente en el backend
 * (advisory lock + `@@unique` por pedido): deshabilitar el botón mientras está en curso evita
 * disparos duplicados desde la UI, pero no es la única protección — un doble clic que pase el
 * disable de todos modos resuelve seguro del lado del servidor.
 */
function RetryInvoiceButton({
  invoice,
  onResolved,
}: {
  invoice: FiscalInvoice
  onResolved: (updated: FiscalInvoice) => void
}) {
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      const outcome = await retryInvoiceEmission(invoice.order_id)
      if (outcome.invoice) onResolved(outcome.invoice)
      if (outcome.emitted) {
        toast.success("Comprobante autorizado.")
      } else {
        toast.error(invoiceEmissionReasonMessage(outcome.reason))
      }
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo reintentar la emisión."))
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => void handleRetry()} disabled={isRetrying}>
      {isRetrying ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RefreshCw className="size-3.5" />
      )}
      Reintentar
    </Button>
  )
}

export default function InvoicingHistoryPage() {
  const [invoices, setInvoices] = useState<FiscalInvoice[]>([])
  const [statusFilter, setStatusFilter] = useState<"all" | FiscalInvoiceStatus>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const loadPage = useCallback(
    async (nextSkip: number, replace: boolean) => {
      if (replace) setIsLoading(true)
      else setIsLoadingMore(true)
      try {
        const { invoices: page } = await fetchInvoicingInvoices({
          status: statusFilter === "all" ? undefined : statusFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          take: PAGE_SIZE,
          skip: nextSkip,
        })
        setInvoices((current) => (replace ? page : [...current, ...page]))
        setHasMore(page.length === PAGE_SIZE)
        setSkip(nextSkip + page.length)
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo cargar el historial de comprobantes."))
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [statusFilter, dateFrom, dateTo],
  )

  useEffect(() => {
    void loadPage(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateFrom, dateTo])

  const handleInvoiceResolved = useCallback((updated: FiscalInvoice) => {
    setInvoices((current) =>
      current.map((invoice) => (invoice.id === updated.id ? updated : invoice)),
    )
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
          <Link href="/invoicing">
            <ArrowLeft className="size-4" />
            Volver a facturación
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Historial de comprobantes</h1>
        <p className="text-muted-foreground">
          Un comprobante autorizado nunca se elimina ni se edita desde aquí: representa una
          operación fiscal real.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="invoices-status">Estado</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | FiscalInvoiceStatus)}
          >
            <SelectTrigger id="invoices-status" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invoices-from">Desde</Label>
          <Input
            id="invoices-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[11rem]"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invoices-to">Hasta</Label>
          <Input
            id="invoices-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[11rem]"
          />
        </div>
        {dateFrom || dateTo ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => {
              setDateFrom("")
              setDateTo("")
            }}
          >
            Limpiar período
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : invoices.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ExternalLink className="size-5" />
            </EmptyMedia>
            <EmptyTitle>Sin comprobantes todavía</EmptyTitle>
            <EmptyDescription>
              Cuando se autorice un comprobante, va a aparecer en esta tabla.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Importe</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>CAE</TableHead>
                <TableHead>Vence CAE</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateLabel(invoice.created_at)}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{formatShortOrderId(invoice.order_id)}</code>
                  </TableCell>
                  <TableCell>{INVOICE_KIND_LABEL[invoice.kind]}</TableCell>
                  <TableCell>
                    {invoice.voucher_type && invoice.comprobante_numero
                      ? `${invoice.voucher_type} · ${invoice.comprobante_numero}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {formatOrderMoney(Number(invoice.amount), invoice.currency_code)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <InvoiceStatusBadge status={invoice.status} />
                      {invoice.status === "requires_review" ? (
                        <p className="max-w-48 text-xs text-muted-foreground">
                          Resultado no confirmado todavía. Se reintenta solo de forma segura; no
                          hace falta ninguna acción.
                        </p>
                      ) : null}
                      {invoice.status === "simulated" ? (
                        <p className="max-w-48 text-xs text-muted-foreground">
                          Emitido contra el entorno de pruebas del proveedor: tiene CAE de prueba,
                          SIN validez fiscal real.
                        </p>
                      ) : null}
                      {invoice.status === "pending" || invoice.status === "processing" ? (
                        <p className="max-w-48 text-xs text-muted-foreground">
                          Todavía no se confirmó con el proveedor.
                        </p>
                      ) : null}
                      {(invoice.status === "rejected" || invoice.status === "failed") &&
                      invoice.error_message ? (
                        <p className="max-w-48 text-xs text-muted-foreground">
                          {invoice.error_message}
                        </p>
                      ) : null}
                      {RETRYABLE_STATUSES.includes(invoice.status) ? (
                        <RetryInvoiceButton invoice={invoice} onResolved={handleInvoiceResolved} />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{invoice.cae ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateLabel(invoice.cae_vencimiento)}
                  </TableCell>
                  <TableCell>
                    <InvoicePdfCell invoice={invoice} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMore ? (
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => void loadPage(skip, false)}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </>
          ) : (
            "Cargar más"
          )}
        </Button>
      ) : null}
    </div>
  )
}
