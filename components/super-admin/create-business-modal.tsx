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
import { Textarea } from "@/components/ui/textarea"
import type { CreateSuperAdminBusinessPayload } from "@/lib/requests/super-admin-businesses"

const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires"
const DEFAULT_CURRENCY = "ARS"
const DEFAULT_TRIAL_DAYS = "14"

interface CreateBusinessModalProps {
  open: boolean
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: CreateSuperAdminBusinessPayload) => Promise<void> | void
}

function emptyForm() {
  return {
    name: "",
    ownerEmail: "",
    ownerName: "",
    ownerPassword: "",
    timezone: DEFAULT_TIMEZONE,
    slug: "",
    currencyCode: DEFAULT_CURRENCY,
    streetAddress: "",
    description: "",
    trialDays: DEFAULT_TRIAL_DAYS,
  }
}

export function CreateBusinessModal({
  open,
  pending = false,
  onOpenChange,
  onConfirm,
}: CreateBusinessModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [showOptional, setShowOptional] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(emptyForm())
      setShowOptional(false)
      setLocalError(null)
    }
  }, [open])

  const setField = (key: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleConfirm = async () => {
    const name = form.name.trim()
    const ownerEmail = form.ownerEmail.trim()
    const ownerName = form.ownerName.trim()
    const ownerPassword = form.ownerPassword

    if (!name) {
      setLocalError("El nombre del negocio es obligatorio.")
      return
    }
    if (!ownerEmail) {
      setLocalError("El email del dueño es obligatorio.")
      return
    }
    if (!ownerName) {
      setLocalError("El nombre del dueño es obligatorio.")
      return
    }
    if (ownerPassword && ownerPassword.length < 8) {
      setLocalError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    const trialDays = Number(form.trialDays)
    if (
      form.trialDays.trim() &&
      (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90)
    ) {
      setLocalError("Los días de trial deben estar entre 1 y 90.")
      return
    }

    setLocalError(null)

    const payload: CreateSuperAdminBusinessPayload = {
      name,
      owner: {
        email: ownerEmail,
        name: ownerName,
        ...(ownerPassword ? { password: ownerPassword } : {}),
      },
    }

    const timezone = form.timezone.trim()
    if (timezone) payload.timezone = timezone

    const slug = form.slug.trim()
    if (slug) payload.slug = slug

    const currency = form.currencyCode.trim().toUpperCase()
    if (currency) payload.currency_code = currency

    const street = form.streetAddress.trim()
    if (street) payload.street_address = street

    const description = form.description.trim()
    if (description) payload.description = description

    if (form.trialDays.trim()) {
      payload.trial_days = trialDays
    }

    await onConfirm(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear negocio</DialogTitle>
          <DialogDescription>
            Alta del local con dueño OWNER y trial inicial. Horarios, menú y
            WhatsApp se configuran después desde el panel del local.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-name">Nombre del negocio *</Label>
            <Input
              id="create-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Pizzería Centro"
              disabled={pending}
            />
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-3 text-sm font-medium">Dueño (OWNER)</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-owner-email">Email *</Label>
                <Input
                  id="create-owner-email"
                  type="email"
                  autoComplete="off"
                  value={form.ownerEmail}
                  onChange={(e) => setField("ownerEmail", e.target.value)}
                  placeholder="dueno@local.com"
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-owner-name">Nombre *</Label>
                <Input
                  id="create-owner-name"
                  value={form.ownerName}
                  onChange={(e) => setField("ownerName", e.target.value)}
                  placeholder="Ana Pérez"
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-owner-password">Contraseña</Label>
                <Input
                  id="create-owner-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.ownerPassword}
                  onChange={(e) => setField("ownerPassword", e.target.value)}
                  placeholder="Mín. 8 caracteres"
                  disabled={pending}
                />
                <p className="text-xs text-muted-foreground">
                  Obligatoria si el email es nuevo. Si el usuario ya existe, se
                  adjunta como OWNER sin cambiar la contraseña.
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setShowOptional((v) => !v)}
            disabled={pending}
          >
            {showOptional ? "Ocultar opciones" : "Mostrar opciones"}
          </Button>

          {showOptional ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-timezone">Timezone</Label>
                <Input
                  id="create-timezone"
                  value={form.timezone}
                  onChange={(e) => setField("timezone", e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-slug">Slug</Label>
                <Input
                  id="create-slug"
                  value={form.slug}
                  onChange={(e) => setField("slug", e.target.value)}
                  placeholder="Se genera del nombre si lo dejás vacío"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="create-currency">Moneda</Label>
                  <Input
                    id="create-currency"
                    value={form.currencyCode}
                    onChange={(e) => setField("currencyCode", e.target.value)}
                    disabled={pending}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="create-trial">Días de trial</Label>
                  <Input
                    id="create-trial"
                    type="number"
                    min={1}
                    max={90}
                    value={form.trialDays}
                    onChange={(e) => setField("trialDays", e.target.value)}
                    disabled={pending}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-address">Dirección</Label>
                <Input
                  id="create-address"
                  value={form.streetAddress}
                  onChange={(e) => setField("streetAddress", e.target.value)}
                  placeholder="Av. Corrientes 1234"
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-description">Descripción</Label>
                <Textarea
                  id="create-description"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={3}
                  disabled={pending}
                />
              </div>
            </div>
          ) : null}

          {localError ? (
            <p className="text-sm text-destructive">{localError}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creando…
              </>
            ) : (
              "Crear negocio"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
