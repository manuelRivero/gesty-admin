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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { PatchSuperAdminBillingPayload } from "@/lib/requests/super-admin-billing"

interface BillingOverrideModalProps {
  businessName: string | null
  open: boolean
  pending?: boolean
  initialPlan?: string
  initialTokenLimit?: number
  initialBlocked?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: PatchSuperAdminBillingPayload) => Promise<void> | void
}

function normalizePlan(plan: string | undefined): string {
  const value = (plan ?? "basic").toLowerCase()
  if (value === "business") return "enterprise"
  if (value === "trial") return "basic"
  return value || "basic"
}

export function BillingOverrideModal({
  businessName,
  open,
  pending = false,
  initialPlan,
  initialTokenLimit,
  initialBlocked = false,
  onOpenChange,
  onConfirm,
}: BillingOverrideModalProps) {
  const [aiPlan, setAiPlan] = useState(normalizePlan(initialPlan))
  const [tokenLimit, setTokenLimit] = useState(String(initialTokenLimit ?? 50000))
  const [blocked, setBlocked] = useState(initialBlocked)

  useEffect(() => {
    if (open) {
      setAiPlan(normalizePlan(initialPlan))
      setTokenLimit(String(initialTokenLimit ?? 50000))
      setBlocked(initialBlocked)
    }
  }, [open, initialPlan, initialTokenLimit, initialBlocked])

  const limitNumber = Number(tokenLimit)
  const limitValid = Number.isFinite(limitNumber) && limitNumber >= 0

  const handleConfirm = async () => {
    if (!limitValid) return
    await onConfirm({
      ai_plan: aiPlan,
      ai_monthly_token_limit: limitNumber,
      ai_blocked: blocked,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override de cupo</DialogTitle>
          <DialogDescription>
            Ajustá plan, límite de tokens y bloqueo de IA de{" "}
            {businessName ?? "este negocio"}. No hay modo exento.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="override-plan">Plan (ai_plan)</Label>
            <Select value={aiPlan} onValueChange={setAiPlan}>
              <SelectTrigger id="override-plan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">basic</SelectItem>
                <SelectItem value="pro">pro</SelectItem>
                <SelectItem value="enterprise">enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="override-limit">Límite mensual de tokens</Label>
            <Input
              id="override-limit"
              type="number"
              min={0}
              value={tokenLimit}
              onChange={(e) => setTokenLimit(e.target.value)}
            />
            {!limitValid ? (
              <p className="text-xs text-destructive">Ingresá un número válido.</p>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div>
              <Label htmlFor="override-blocked">IA bloqueada</Label>
              <p className="text-xs text-muted-foreground">
                Si está activo, el asistente no opera.
              </p>
            </div>
            <Switch
              id="override-blocked"
              checked={blocked}
              onCheckedChange={setBlocked}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!limitValid || pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
