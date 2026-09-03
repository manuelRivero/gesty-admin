"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

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
  fetchTrialDefaults,
  type GrantTrialPayload,
  type TrialDefaults,
} from "@/lib/requests/super-admin-billing"

interface GrantTrialModalProps {
  businessName: string | null
  open: boolean
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: GrantTrialPayload) => Promise<void> | void
}

export function GrantTrialModal({
  businessName,
  open,
  pending = false,
  onOpenChange,
  onConfirm,
}: GrantTrialModalProps) {
  const [defaults, setDefaults] = useState<TrialDefaults | null>(null)
  const [loadingDefaults, setLoadingDefaults] = useState(false)
  const [days, setDays] = useState("7")
  const [tokenLimit, setTokenLimit] = useState("10000")

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoadingDefaults(true)

    void (async () => {
      const data = await fetchTrialDefaults()
      if (cancelled) return
      setDefaults(data)
      setDays(String(data.days))
      setTokenLimit(String(data.token_limit))
      setLoadingDefaults(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  const maxDays = defaults?.max_days ?? 90
  const daysNumber = Number(days)
  const daysValid =
    Number.isInteger(daysNumber) && daysNumber >= 1 && daysNumber <= maxDays

  const tokenLimitTrimmed = tokenLimit.trim()
  const tokenLimitNumber = Number(tokenLimitTrimmed)
  const tokenLimitValid =
    !tokenLimitTrimmed ||
    (Number.isFinite(tokenLimitNumber) && tokenLimitNumber > 0)

  const handleConfirm = async () => {
    if (!daysValid || !tokenLimitValid) return
    await onConfirm({
      days: daysNumber,
      token_limit: tokenLimitTrimmed
        ? tokenLimitNumber
        : (defaults?.token_limit ?? 10000),
    })
  }

  const defaultDaysLabel = defaults?.days ?? 7
  const defaultTokensLabel = (defaults?.token_limit ?? 10000).toLocaleString("es-AR")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Otorgar trial</DialogTitle>
          <DialogDescription>
            Concede o extiende la prueba
            {businessName ? ` de ${businessName}` : ""}. Default:{" "}
            {defaultDaysLabel} días, {defaultTokensLabel} tokens (no es un plan
            pago).
          </DialogDescription>
        </DialogHeader>
        {loadingDefaults ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando defaults…
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="trial-days">Días</Label>
              <Input
                id="trial-days"
                type="number"
                min={1}
                max={maxDays}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                disabled={pending}
              />
              {!daysValid ? (
                <p className="text-xs text-destructive">
                  Entre 1 y {maxDays} días.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="trial-tokens">Límite de tokens (opcional)</Label>
              <Input
                id="trial-tokens"
                type="number"
                min={1}
                value={tokenLimit}
                onChange={(e) => setTokenLimit(e.target.value)}
                disabled={pending}
              />
              {!tokenLimitValid ? (
                <p className="text-xs text-destructive">
                  Ingresá un límite mayor a 0 o dejá el default.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Default: {defaultTokensLabel} tokens.
                </p>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={
              loadingDefaults || !daysValid || !tokenLimitValid || pending
            }
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Otorgar trial"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
