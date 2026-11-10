"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatOrderMoney } from "@/lib/data"
import {
  getRecordPaymentApiErrorMessage,
  recordTabPayment,
  TAB_PAYMENT_METHOD_LABELS_ES,
  type RecordTabPaymentResult,
  type TabPaymentMethod,
} from "@/lib/requests/table-tabs"

type DraftLine = { id: string; method: TabPaymentMethod; amountTendered: string }

let draftLineSeq = 0
function newDraftLine(method: TabPaymentMethod, amountTendered = ""): DraftLine {
  draftLineSeq += 1
  return { id: `line-${draftLineSeq}`, method, amountTendered }
}

/**
 * Cobro de una cuenta — exclusivo de ADMIN/OWNER (caja/encargado). El mozo
 * solo lleva el dinero/tarjeta hasta aquí; no ve saldos ni calcula vuelto
 * (decisión del negocio, ver POS_TECHNICAL_DESIGN.md §4.F). Permite partir
 * el cobro entre varios medios en una sola confirmación (ampliación de §4.D)
 * — el vuelto, por convención del backend, cae en la última línea con
 * capacidad sobrante, así que conviene poner "Efectivo" al final si se
 * espera dar vuelto en efectivo.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  tableTabId,
  balance,
  currencyCode,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableTabId: string
  /** Saldo pendiente actual, como string decimal (ej. "450.00"). */
  balance: string
  currencyCode: string
  onSuccess: () => void
}) {
  const [lines, setLines] = useState<DraftLine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<RecordTabPaymentResult | null>(null)

  // Solo al ABRIR el diálogo — nunca mientras está abierto. `balance` cambia
  // en el padre apenas se confirma el cobro (refresco post-éxito), y si
  // estuviera en las dependencias este efecto se disparaba de nuevo con
  // `open` todavía en `true`, pisando el `result` recién seteado y
  // devolviendo el formulario en blanco — exactamente el bug reportado
  // ("el modal no muestra el resultado y parece no haber pasado nada").
  useEffect(() => {
    if (open) {
      setLines([newDraftLine("cash", balance)])
      setResult(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const total = lines.reduce((sum, l) => sum + (Number(l.amountTendered) || 0), 0)

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, newDraftLine("cash")])
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))
  }

  async function handleSubmit() {
    const payload = lines
      .map((l) => ({ method: l.method, amountTendered: l.amountTendered.trim() }))
      .filter((l) => Number(l.amountTendered) > 0)

    if (payload.length === 0) {
      toast.error("Ingresá al menos un monto válido.")
      return
    }

    setSubmitting(true)
    try {
      const res = await recordTabPayment(tableTabId, payload)
      setResult(res)
      toast.success("Pago registrado.")
      onSuccess()
    } catch (err) {
      toast.error(getRecordPaymentApiErrorMessage(err, "No se pudo registrar el pago."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cobrar cuenta</DialogTitle>
          <DialogDescription>
            Saldo pendiente:{" "}
            <span className="font-medium">{formatOrderMoney(Number(balance), currencyCode)}</span>
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            {result.payments.map((p) => (
              <div key={p.tabPaymentId} className="space-y-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{TAB_PAYMENT_METHOD_LABELS_ES[p.method]}</p>
                <p>Recibido: {formatOrderMoney(Number(p.amountTendered), currencyCode)}</p>
                <p>Aplicado: {formatOrderMoney(Number(p.amountApplied), currencyCode)}</p>
                {Number(p.change) > 0 ? (
                  <p className="font-semibold text-emerald-600">
                    Vuelto: {formatOrderMoney(Number(p.change), currencyCode)}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>Vuelto total</span>
              <span className="text-emerald-600">
                {formatOrderMoney(Number(result.totalChange), currencyCode)}
              </span>
            </div>
            {Number(balance) - Number(result.totalAmountApplied) <= 0.0001 ? (
              <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Saldo en $0. Cerrá la cuenta desde el panel cuando quieras liberar la mesa — hasta
                entonces va a quedar marcada como pendiente de cierre.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-2">
                <Select
                  value={line.method}
                  onValueChange={(v) => updateLine(line.id, { method: v as TabPaymentMethod })}
                  disabled={submitting}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAB_PAYMENT_METHOD_LABELS_ES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.amountTendered}
                  onChange={(e) => updateLine(line.id, { amountTendered: e.target.value })}
                  disabled={submitting}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  disabled={lines.length === 1 || submitting}
                  onClick={() => removeLine(line.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={submitting}>
              <Plus className="mr-2 size-4" />
              Agregar medio de pago
            </Button>

            <div className="flex items-center justify-between border-t pt-2 text-sm">
              <Label>Total recibido</Label>
              <span className="font-medium">{formatOrderMoney(total, currencyCode)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Listo
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {submitting ? "Registrando…" : "Confirmar cobro"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
