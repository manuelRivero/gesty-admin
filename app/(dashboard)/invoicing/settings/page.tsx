"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { isAxiosError } from "axios"
import { ArrowLeft, CheckCircle2, Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { BillingReadinessBadge } from "@/components/invoicing/invoicing-status-badges"
import { SettingsSection } from "@/components/settings/settings-section"
import { ToggleField } from "@/components/settings/toggle-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { isValidCuit, normalizeCuit } from "@/lib/cuit"
import {
  cuitLookupErrorMessage,
  deriveBillingReadiness,
  fetchCuitLookup,
  fetchFiscalConfiguration,
  saveFiscalConfiguration,
  type CuitLookupResult,
  type FiscalConfiguration,
  type FiscalProvisioningSummary,
} from "@/lib/requests/invoicing"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as
    | { message?: string; error?: string; details?: string[] }
    | undefined
  if (data?.details?.length) return data.details.join(" ")
  return data?.message ?? data?.error ?? err.message ?? fallback
}

/**
 * Condiciones de IVA soportadas hoy por el resolutor de tipo de comprobante del backend
 * (`src/services/invoicing/voucherTypeResolver.ts`): RI → Factura B, MONOTRIBUTO/EXENTO →
 * Factura C (siempre contra Consumidor Final, ver limitación documentada ahí). No se ofrecen
 * otros valores porque hoy no producirían ningún tipo de comprobante determinable.
 */
const CONDICION_IVA_OPTIONS = [
  { value: "RI", label: "Responsable Inscripto" },
  { value: "MONOTRIBUTO", label: "Monotributo" },
  { value: "EXENTO", label: "Exento" },
]

const MAPPABLE_CONDICION_IVA = new Set(CONDICION_IVA_OPTIONS.map((option) => option.value))

interface FiscalFormState {
  cuit: string
  razonSocial: string
  condicionIva: string
  domicilioFiscal: string
  autoIssueOnline: boolean
  autoIssueCash: boolean
}

type CuitLookupStatus = "idle" | "loading" | "success" | "error"

interface CuitLookupState {
  status: CuitLookupStatus
  /** CUIT (normalizado) al que corresponde `result`/`errorMessage` — permite invalidar el
   * resultado si el usuario sigue editando el campo CUIT después de consultar (ver sección
   * "Protección de datos existentes": nunca confirmar accidentalmente una consulta anterior). */
  queriedCuit: string | null
  result: CuitLookupResult | null
  errorMessage: string | null
}

const INITIAL_CUIT_LOOKUP_STATE: CuitLookupState = {
  status: "idle",
  queriedCuit: null,
  result: null,
  errorMessage: null,
}

interface PrefilledFromPadron {
  razonSocial: boolean
  condicionIva: boolean
  domicilioFiscal: boolean
}

const NOTHING_PREFILLED: PrefilledFromPadron = {
  razonSocial: false,
  condicionIva: false,
  domicilioFiscal: false,
}

function toFormState(config: FiscalConfiguration | null): FiscalFormState {
  return {
    cuit: config?.cuit ?? "",
    razonSocial: config?.razon_social ?? "",
    condicionIva: config?.condicion_iva ?? "",
    domicilioFiscal: config?.domicilio_fiscal ?? "",
    autoIssueOnline: config?.auto_issue_online ?? true,
    autoIssueCash: config?.auto_issue_cash ?? false,
  }
}

export default function InvoicingSettingsPage() {
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfiguration | null>(null)
  const [form, setForm] = useState<FiscalFormState>(toFormState(null))
  const [provisioning, setProvisioning] = useState<FiscalProvisioningSummary | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSavingFiscal, setIsSavingFiscal] = useState(false)

  const [cuitLookup, setCuitLookup] = useState<CuitLookupState>(INITIAL_CUIT_LOOKUP_STATE)
  const [prefilledFromPadron, setPrefilledFromPadron] = useState<PrefilledFromPadron>(NOTHING_PREFILLED)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { fiscalConfiguration } = await fetchFiscalConfiguration()
      setFiscalConfig(fiscalConfiguration)
      setForm(toFormState(fiscalConfiguration))
      setCuitLookup(INITIAL_CUIT_LOOKUP_STATE)
      setPrefilledFromPadron(NOTHING_PREFILLED)
      // El GET no trae `provisioning` (es transitorio, solo viene en la respuesta del PUT) —
      // al recargar no hay señal de un intento reciente, se vuelve al estado derivado solo de
      // `fiscalConfiguration`.
      setProvisioning(null)
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo cargar la configuración fiscal."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  /**
   * Guarda y, en la misma respuesta, recibe el resultado del aprovisionamiento automático que
   * dispara el backend como segunda operación — nunca hay que pedirle al restaurante que asocie
   * un emisor a mano. Reutilizada por el botón "Reintentar" (mismos datos, sin pedir que se
   * vuelvan a ingresar).
   */
  const submitFiscalConfiguration = async () => {
    setIsSavingFiscal(true)
    try {
      const { fiscalConfiguration, provisioning: provisioningResult } = await saveFiscalConfiguration({
        cuit: form.cuit.trim(),
        razonSocial: form.razonSocial.trim(),
        condicionIva: form.condicionIva,
        domicilioFiscal: form.domicilioFiscal.trim(),
        autoIssueOnline: form.autoIssueOnline,
        autoIssueCash: form.autoIssueCash,
      })
      setFiscalConfig(fiscalConfiguration)
      setForm(toFormState(fiscalConfiguration))
      setProvisioning(provisioningResult ?? null)
      if (provisioningResult?.outcome === "requires_attention") {
        toast.error(provisioningResult.detail ?? "Los datos se guardaron, pero la facturación necesita atención.")
      } else {
        toast.success("Datos fiscales guardados.")
      }
    } catch (err) {
      toast.error(errorMessage(err, "No se pudieron guardar los datos fiscales."))
    } finally {
      setIsSavingFiscal(false)
    }
  }

  const handleSaveFiscal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.cuit.trim() || !form.razonSocial.trim() || !form.condicionIva) {
      toast.error("Completá CUIT, razón social y condición fiscal.")
      return
    }
    await submitFiscalConfiguration()
  }

  /**
   * El campo CUIT es el único input que puede invalidar una consulta ya hecha: si el usuario
   * sigue editándolo después de un resultado (éxito o error), ese resultado deja de corresponder
   * al valor actual y no debe seguir mostrándose como "del padrón" ni poder confirmarse como tal.
   */
  const handleCuitChange = (value: string) => {
    setForm((c) => ({ ...c, cuit: value }))
    if (cuitLookup.status !== "idle" && normalizeCuit(value) !== cuitLookup.queriedCuit) {
      setCuitLookup(INITIAL_CUIT_LOOKUP_STATE)
      setPrefilledFromPadron(NOTHING_PREFILLED)
    }
  }

  /**
   * Consulta de solo lectura al padrón (`GET .../cuit-lookup/:cuit`) — nunca persiste nada por sí
   * misma. Valida localmente antes de gastar la consulta (sección "Paso A"): un CUIT con formato
   * o dígito verificador inválido ni siquiera llega a pedirse al backend.
   */
  const handleLookupCuit = async () => {
    if (cuitLookup.status === "loading") return
    const normalized = normalizeCuit(form.cuit)
    if (!isValidCuit(normalized)) {
      setCuitLookup({
        status: "error",
        queriedCuit: normalized,
        result: null,
        errorMessage: "El CUIT ingresado no es válido. Verificá los 11 dígitos.",
      })
      return
    }

    setCuitLookup({ status: "loading", queriedCuit: normalized, result: null, errorMessage: null })
    try {
      const { cuitLookup: result } = await fetchCuitLookup(normalized)
      setCuitLookup({ status: "success", queriedCuit: normalized, result, errorMessage: null })
      const condicionIvaMapped = MAPPABLE_CONDICION_IVA.has(result.condicionIva)
      setForm((c) => ({
        ...c,
        razonSocial: result.razonSocial ?? c.razonSocial,
        // Nunca se infiere una condición fiscal que el formulario no pueda representar con
        // seguridad: si el padrón devuelve algo fuera de RI/MONOTRIBUTO/EXENTO, se deja en blanco
        // para que el usuario la seleccione explícitamente (ver `condicionIvaRaw` en el panel).
        condicionIva: condicionIvaMapped ? result.condicionIva : "",
        domicilioFiscal: result.domicilioFiscal ?? c.domicilioFiscal,
      }))
      setPrefilledFromPadron({
        razonSocial: Boolean(result.razonSocial),
        condicionIva: condicionIvaMapped,
        domicilioFiscal: Boolean(result.domicilioFiscal),
      })
    } catch (err) {
      setCuitLookup({
        status: "error",
        queriedCuit: normalized,
        result: null,
        errorMessage: cuitLookupErrorMessage(err),
      })
    }
  }

  const billingReadiness = deriveBillingReadiness(fiscalConfig, provisioning)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
          <Link href="/invoicing">
            <ArrowLeft className="size-4" />
            Volver a facturación
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Configuración fiscal</h1>
          <BillingReadinessBadge state={billingReadiness} />
        </div>
        <p className="text-muted-foreground">
          Datos fiscales del negocio y automatización de emisión. Gesty se encarga del resto.
        </p>
      </div>

      <form onSubmit={(event) => void handleSaveFiscal(event)} className="flex flex-col gap-6">
        <SettingsSection
          title="Datos fiscales"
          description="Identifican al negocio como emisor de comprobantes. La configuración acá no modifica tus obligaciones fiscales."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="cuit">CUIT</Label>
              <div className="flex gap-2">
                <Input
                  id="cuit"
                  value={form.cuit}
                  onChange={(event) => handleCuitChange(event.target.value)}
                  placeholder="20-12345678-6"
                  disabled={isSavingFiscal}
                  autoComplete="off"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleLookupCuit()}
                  disabled={isSavingFiscal || cuitLookup.status === "loading" || !form.cuit.trim()}
                >
                  {cuitLookup.status === "loading" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Consultando…
                    </>
                  ) : (
                    <>
                      <Search className="size-4" />
                      Consultar CUIT
                    </>
                  )}
                </Button>
              </div>
              {cuitLookup.status === "error" ? (
                <p className="text-sm text-destructive">{cuitLookup.errorMessage}</p>
              ) : null}
              {cuitLookup.status === "success" && cuitLookup.result ? (
                <Alert className="border-emerald-500/40 bg-emerald-500/5">
                  <CheckCircle2 className="text-emerald-600" />
                  <AlertTitle className="text-emerald-800 dark:text-emerald-200">
                    Datos obtenidos del padrón
                  </AlertTitle>
                  <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                    Se completaron razón social, condición de IVA (cuando se pudo determinar) y
                    domicilio fiscal más abajo. Revisalos y corregilos si hace falta antes de
                    guardar.
                    {!MAPPABLE_CONDICION_IVA.has(cuitLookup.result.condicionIva) ? (
                      <>
                        {" "}
                        El padrón informa la condición de IVA como &quot;
                        {cuitLookup.result.condicionIvaRaw ?? cuitLookup.result.condicionIva}
                        &quot;; seleccioná manualmente la que corresponda abajo.
                      </>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="razonSocial">
                Razón social
                {prefilledFromPadron.razonSocial ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Dato del padrón
                  </span>
                ) : null}
              </Label>
              <Input
                id="razonSocial"
                value={form.razonSocial}
                onChange={(event) => {
                  setForm((c) => ({ ...c, razonSocial: event.target.value }))
                  setPrefilledFromPadron((p) => ({ ...p, razonSocial: false }))
                }}
                disabled={isSavingFiscal}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="condicionIva">
                Condición frente al IVA
                {prefilledFromPadron.condicionIva ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Dato del padrón
                  </span>
                ) : null}
              </Label>
              <Select
                value={form.condicionIva}
                onValueChange={(value) => {
                  setForm((c) => ({ ...c, condicionIva: value }))
                  setPrefilledFromPadron((p) => ({ ...p, condicionIva: false }))
                }}
                disabled={isSavingFiscal}
              >
                <SelectTrigger id="condicionIva">
                  <SelectValue placeholder="Seleccioná una condición" />
                </SelectTrigger>
                <SelectContent>
                  {CONDICION_IVA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="domicilioFiscal">
                Domicilio fiscal
                {prefilledFromPadron.domicilioFiscal ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Dato del padrón
                  </span>
                ) : null}
              </Label>
              <Input
                id="domicilioFiscal"
                value={form.domicilioFiscal}
                onChange={(event) => {
                  setForm((c) => ({ ...c, domicilioFiscal: event.target.value }))
                  setPrefilledFromPadron((p) => ({ ...p, domicilioFiscal: false }))
                }}
                disabled={isSavingFiscal}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Proveedor</Label>
              <Input
                value="Sistemas 360 (cuenta central de Gesty)"
                disabled
                readOnly
                className="text-muted-foreground"
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Automatización de emisión"
          description="La emisión automática solo se intenta cuando el pedido está cobrado. Esta preferencia no reemplaza tus obligaciones fiscales."
        >
          <ToggleField
            id="autoIssueOnline"
            label="Emisión automática — pago online confirmado"
            description="Se activa cuando Mercado Pago confirma el pago; no al iniciar el checkout."
            checked={form.autoIssueOnline}
            onCheckedChange={(checked) => setForm((c) => ({ ...c, autoIssueOnline: checked }))}
            disabled={isSavingFiscal}
          />
          <ToggleField
            id="autoIssueCash"
            label="Emisión automática — cobros manuales o en efectivo"
            description="Incluye efectivo y comprobantes de pago aprobados por un administrador. Enviar un comprobante, sin aprobarlo, no dispara la emisión."
            checked={form.autoIssueCash}
            onCheckedChange={(checked) => setForm((c) => ({ ...c, autoIssueCash: checked }))}
            disabled={isSavingFiscal}
          />
        </SettingsSection>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSavingFiscal}>
            {isSavingFiscal ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar datos fiscales"
            )}
          </Button>
        </div>
      </form>

      <SettingsSection
        title="Facturación electrónica"
        description="Gesty administra la cuenta y el token de Sistemas 360. Nunca vas a ingresar credenciales ni elegir un punto de venta."
      >
        <BillingReadinessBadge state={billingReadiness} />
        <p className="text-sm text-muted-foreground">
          {billingReadiness === "pending_data"
            ? "Completá y guardá el CUIT, la razón social y la condición de IVA para activar la facturación electrónica."
            : billingReadiness === "ready"
              ? "Tu negocio ya puede emitir comprobantes electrónicos."
              : billingReadiness === "requires_attention"
                ? "Hubo un problema al configurar la facturación electrónica."
                : "Gesty está terminando de configurar la facturación electrónica para tu negocio. No necesitás hacer nada más."}
        </p>
        {billingReadiness === "requires_attention" && provisioning?.detail ? (
          <Alert variant="destructive">
            <AlertDescription>{provisioning.detail}</AlertDescription>
          </Alert>
        ) : null}
        {billingReadiness === "provisioning" || billingReadiness === "requires_attention" ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => void submitFiscalConfiguration()}
            disabled={isSavingFiscal}
          >
            {isSavingFiscal ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Reintentando…
              </>
            ) : (
              "Reintentar"
            )}
          </Button>
        ) : null}
      </SettingsSection>
    </div>
  )
}
