"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SettingsSection } from "@/components/settings/settings-section"
import {
  BUSINESS_UNSAVED_MESSAGE,
  SettingsFormFooter,
} from "@/components/settings/settings-form-footer"
import { useUnsavedChangesToast } from "@/hooks/use-unsaved-changes-toast"
import { fetchAdminBusinessConfig } from "@/lib/requests/business-config"
import {
  fetchAdminBusinessProfile,
  patchAdminBusinessProfile,
  type AdminBusinessProfile,
  type AdminBusinessProfilePatch,
} from "@/lib/requests/business-profile"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

function normText(value: string | null | undefined): string {
  return (value ?? "").trim()
}

function parseOptionalCoord(raw: string): number | null | "invalid" {
  const t = raw.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : "invalid"
}

type FormState = {
  name: string
  slug: string
  description: string
  street_address: string
  address_notes: string
  latitudeStr: string
  longitudeStr: string
  timezone: string
}

function profileToForm(p: AdminBusinessProfile): FormState {
  return {
    name: p.name ?? "",
    slug: normText(p.slug),
    description: p.description ?? "",
    street_address: p.street_address ?? "",
    address_notes: p.address_notes ?? "",
    latitudeStr: p.latitude != null ? String(p.latitude) : "",
    longitudeStr: p.longitude != null ? String(p.longitude) : "",
    timezone: p.timezone ?? "",
  }
}

function buildPatch(
  form: FormState,
  initial: AdminBusinessProfile,
): { patch: AdminBusinessProfilePatch; clientError?: string } {
  const patch: AdminBusinessProfilePatch = {}

  if (normText(form.name) !== normText(initial.name)) {
    patch.name = normText(form.name)
  }

  if (normText(form.slug) !== normText(initial.slug)) {
    patch.slug = normText(form.slug)
  }

  const descForm = form.description.trim()
  const descInitial = normText(initial.description)
  if (descForm !== descInitial) {
    patch.description = descForm === "" ? null : descForm
  }

  const streetForm = form.street_address.trim()
  const streetInitial = normText(initial.street_address)
  if (streetForm !== streetInitial) {
    patch.street_address = streetForm === "" ? null : streetForm
  }

  const notesForm = form.address_notes.trim()
  const notesInitial = normText(initial.address_notes)
  if (notesForm !== notesInitial) {
    patch.address_notes = notesForm === "" ? null : notesForm
  }

  const lat = parseOptionalCoord(form.latitudeStr)
  const lng = parseOptionalCoord(form.longitudeStr)
  if (lat === "invalid" || lng === "invalid") {
    return { patch: {}, clientError: "Latitud y longitud deben ser números válidos o estar vacíos." }
  }
  if (lat !== initial.latitude) {
    patch.latitude = lat
  }
  if (lng !== initial.longitude) {
    patch.longitude = lng
  }

  if (normText(form.timezone) !== normText(initial.timezone)) {
    patch.timezone = normText(form.timezone)
  }

  return { patch }
}

export default function MyBusinessPage() {
  const [profile, setProfile] = useState<AdminBusinessProfile | null>(null)
  const [initialProfile, setInitialProfile] = useState<AdminBusinessProfile | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [takeawayEnabled, setTakeawayEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [business, config] = await Promise.all([
        fetchAdminBusinessProfile(),
        fetchAdminBusinessConfig(),
      ])
      setProfile(business)
      setInitialProfile(business)
      setForm(profileToForm(business))
      setTakeawayEnabled(Boolean(config.takeaway_enabled))
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo cargar la información del negocio."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const isDirty = useMemo(() => {
    if (!form || !initialProfile) return false
    const { patch } = buildPatch(form, initialProfile)
    return Object.keys(patch).length > 0
  }, [form, initialProfile])

  useUnsavedChangesToast(isDirty, BUSINESS_UNSAVED_MESSAGE)

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = async () => {
    if (!form || !initialProfile) return
    if (!isDirty) {
      toast.info("No hay cambios para guardar")
      return
    }

    if (takeawayEnabled && normText(form.street_address) === "") {
      toast.error(
        "Con retiro en local activo no podés dejar la dirección vacía. Desactivá el retiro en configuración o indicá una calle válida.",
      )
      return
    }

    const { patch, clientError } = buildPatch(form, initialProfile)
    if (clientError) {
      toast.error(clientError)
      return
    }
    if (Object.keys(patch).length === 0) {
      toast.info("No hay cambios para guardar")
      return
    }

    setSaving(true)
    try {
      const updated = await patchAdminBusinessProfile(patch)
      setProfile(updated)
      setInitialProfile(updated)
      setForm(profileToForm(updated))
      toast.success("Negocio actualizado correctamente")
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar los cambios."))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (!initialProfile) return
    setForm(profileToForm(initialProfile))
    toast.info("Cambios descartados")
  }

  if (loading || !profile || !form) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi negocio</h1>
        <p className="text-muted-foreground">
          Datos públicos y de contacto del local. Solo el propietario puede editarlos.
        </p>
      </div>

      <SettingsSection
        title="Estado y moneda"
        description="Valores definidos por la plataforma; no se editan desde aquí."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">ID</span>
            <code className="rounded-md border bg-muted/50 px-2 py-1.5 text-xs break-all">
              {profile.id}
            </code>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Moneda</span>
            <span className="text-sm font-medium">{profile.currency_code}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Estado</span>
            <div>
              {profile.is_active ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Activo</Badge>
              ) : (
                <Badge variant="secondary">Inactivo</Badge>
              )}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Identidad"
        description="Nombre, URL amigable y descripción que ven tus clientes."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="biz-name">Nombre</Label>
          <Input
            id="biz-name"
            value={form.name}
            onChange={(e) => updateForm("name", e.target.value)}
            autoComplete="organization"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="biz-slug">Slug (URL)</Label>
          <Input
            id="biz-slug"
            value={form.slug}
            onChange={(e) => updateForm("slug", e.target.value)}
            placeholder="mi-restaurante"
          />
          <p className="text-sm text-muted-foreground">
            Identificador en la URL pública{" "}
            <code className="text-xs">/shopping/tu-slug</code>. Usá minúsculas,
            guiones y sin espacios. Necesario para la tienda web en{" "}
            <Link
              href="/settings#storefront"
              className="font-medium underline underline-offset-2"
            >
              Configuración
            </Link>
            .
          </p>
          {form.slug.trim() ? (
            <p className="text-sm text-muted-foreground">
              Vista previa:{" "}
              <Link
                href={`/shopping/${encodeURIComponent(form.slug.trim())}`}
                className="font-mono text-xs underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                /shopping/{form.slug.trim()}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="biz-desc">Descripción</Label>
          <Textarea
            id="biz-desc"
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            rows={4}
            placeholder="Breve texto sobre tu negocio"
            className="min-h-[100px] resize-y"
          />
          <p className="text-sm text-muted-foreground">
            Si guardás el campo vacío, se borra la descripción en el servidor.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Ubicación"
        description="Dirección del local y coordenadas para mapas y entregas."
      >
        {takeawayEnabled ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            El retiro en local está activo: tenés que mantener una dirección de calle válida. No se
            puede enviar vacío ni borrarla hasta desactivar esa opción en{" "}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              Configuración
            </Link>
            .
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="biz-street">Calle y número</Label>
          <Input
            id="biz-street"
            value={form.street_address}
            onChange={(e) => updateForm("street_address", e.target.value)}
            autoComplete="street-address"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="biz-notes">Indicaciones / piso / acceso</Label>
          <Textarea
            id="biz-notes"
            value={form.address_notes}
            onChange={(e) => updateForm("address_notes", e.target.value)}
            rows={2}
            className="resize-y"
            placeholder="Opcional"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="biz-lat">Latitud</Label>
            <Input
              id="biz-lat"
              inputMode="decimal"
              value={form.latitudeStr}
              onChange={(e) => updateForm("latitudeStr", e.target.value)}
              placeholder="-34.6037"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="biz-lng">Longitud</Label>
            <Input
              id="biz-lng"
              inputMode="decimal"
              value={form.longitudeStr}
              onChange={(e) => updateForm("longitudeStr", e.target.value)}
              placeholder="-58.3816"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Zona horaria"
        description="Usá un identificador IANA reconocido por el sistema."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="biz-tz">Timezone</Label>
          <Input
            id="biz-tz"
            value={form.timezone}
            onChange={(e) => updateForm("timezone", e.target.value)}
            placeholder="America/Argentina/Buenos_Aires"
            disabled
          />
        </div>
      </SettingsSection>

      <SettingsFormFooter
        isDirty={isDirty}
        isSaving={saving}
        dirtyMessage={BUSINESS_UNSAVED_MESSAGE}
        onSave={() => void handleSave()}
        onCancel={handleCancel}
      />
    </div>
  )
}
