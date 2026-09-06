"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { isAxiosError } from "axios"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  ProviderBrand,
  getProviderDisplayName,
} from "@/components/online-payments/provider-brand"
import { SecretInputField } from "@/components/online-payments/secret-input-field"
import { OrdersSetupNextSteps } from "@/components/orders-setup/orders-setup-next-steps"
import { SettingsSection } from "@/components/settings/settings-section"
import { ToggleField } from "@/components/settings/toggle-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchAdminBusinessConfig } from "@/lib/requests/business-config"
import {
  createAdminPaymentProvider,
  fetchAdminPaymentProviders,
  updateAdminPaymentProvider,
  type AdminPaymentProvider,
  type PaymentProviderId,
} from "@/lib/requests/payment-providers"
import {
  fetchOrdersSetupPrerequisites,
  type OrdersSetupStatus,
} from "@/lib/orders-setup"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

interface FormState {
  accessToken: string
  publicKey: string
  webhookSecret: string
  isSandbox: boolean
  isActive: boolean
}

const EMPTY_FORM: FormState = {
  accessToken: "",
  publicKey: "",
  webhookSecret: "",
  isSandbox: false,
  isActive: true,
}

export default function ConfigurePaymentProviderPage() {
  const params = useParams<{ provider: string }>()
  const router = useRouter()
  const providerId = params.provider as PaymentProviderId

  const [configured, setConfigured] = useState<AdminPaymentProvider | null>(null)
  const [providerName, setProviderName] = useState<string | null>(null)
  const [providerImage, setProviderImage] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [setupStatus, setSetupStatus] = useState<OrdersSetupStatus | null>(null)
  const [showSetupCta, setShowSetupCta] = useState(false)

  const displayName = useMemo(
    () => getProviderDisplayName(providerId, providerName ?? undefined),
    [providerId, providerName],
  )

  const isEditing = Boolean(configured)

  const refreshSetupStatus = useCallback(async () => {
    try {
      const config = await fetchAdminBusinessConfig()
      const status = await fetchOrdersSetupPrerequisites({
        orders_enabled: config.orders_enabled,
        delivery_enabled: config.delivery_enabled,
        takeaway_enabled: config.takeaway_enabled,
        external_delivery_enabled: config.external_delivery_enabled,
      })
      setSetupStatus(status)
    } catch {
      setSetupStatus(null)
    }
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setNotFound(false)
    try {
      const data = await fetchAdminPaymentProviders()
      const available = data.availableProviders.find((item) => item.id === providerId)
      if (!available && data.items.every((item) => item.provider !== providerId)) {
        setNotFound(true)
        return
      }

      setProviderName(available?.name ?? null)
      setProviderImage(available?.image ?? null)
      const existing = data.items.find((item) => item.provider === providerId) ?? null
      setConfigured(existing)
      setForm({
        accessToken: "",
        publicKey: existing?.publicKey ?? "",
        webhookSecret: "",
        isSandbox: existing?.isSandbox ?? false,
        isActive: existing?.isActive ?? true,
      })
    } catch (err) {
      toast.error(
        errorMessage(err, "No se pudo cargar la configuración del proveedor."),
      )
    } finally {
      setIsLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setSaveSuccess(false)
  }

  const validate = (): boolean => {
    if (!isEditing && !form.accessToken.trim()) {
      toast.error("El access token es obligatorio para la primera configuración.")
      return false
    }

    if (providerId === "mercado_pago" && form.accessToken.trim()) {
      const token = form.accessToken.trim()
      if (!token.startsWith("APP_USR-") && !token.startsWith("TEST-")) {
        toast.error(
          "El access token de Mercado Pago debe comenzar con APP_USR- o TEST-.",
        )
        return false
      }
    }

    if (
      providerId === "mercado_pago" &&
      form.publicKey.trim() &&
      !form.publicKey.trim().startsWith("APP_USR-") &&
      !form.publicKey.trim().startsWith("TEST-")
    ) {
      toast.error(
        "La public key de Mercado Pago debe comenzar con APP_USR- o TEST-.",
      )
      return false
    }

    return true
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      if (configured) {
        const payload: Record<string, unknown> = {
          isSandbox: form.isSandbox,
          isActive: form.isActive,
        }

        if (form.accessToken.trim()) payload.accessToken = form.accessToken.trim()
        if (form.publicKey.trim()) payload.publicKey = form.publicKey.trim()
        if (form.webhookSecret.trim()) payload.webhookSecret = form.webhookSecret.trim()

        const updated = await updateAdminPaymentProvider(configured.id, payload)
        setConfigured(updated)
        setForm((current) => ({
          ...current,
          accessToken: "",
          webhookSecret: "",
          publicKey: updated.publicKey ?? current.publicKey,
        }))
      } else {
        const created = await createAdminPaymentProvider({
          provider: providerId,
          accessToken: form.accessToken.trim(),
          publicKey: form.publicKey.trim() || null,
          webhookSecret: form.webhookSecret.trim() || null,
          isSandbox: form.isSandbox,
          isActive: form.isActive,
        })
        setConfigured(created)
        setForm((current) => ({
          ...current,
          accessToken: "",
          webhookSecret: "",
          publicKey: created.publicKey ?? current.publicKey,
        }))
      }

      setSaveSuccess(true)
      toast.success("Configuración guardada correctamente")
      if (form.isActive) {
        setShowSetupCta(true)
        void refreshSetupStatus()
        toast.message("Los pedidos no se habilitan solos", {
          description: "Completá el setup en Configuración cuando estés listo.",
        })
      }
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar la configuración."))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-6">
        <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
          <Link href="/online-payments">
            <ArrowLeft className="size-4" />
            Volver a pagos online
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            El proveedor solicitado no está disponible para configurar.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
          <Link href="/online-payments">
            <ArrowLeft className="size-4" />
            Volver a pagos online
          </Link>
        </Button>

        <div className="flex items-center gap-3">
          <ProviderBrand
            providerId={providerId}
            name={providerName}
            image={providerImage}
            className="size-14 rounded-2xl text-base"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
            <p className="text-muted-foreground">
              {isEditing
                ? "Actualizá credenciales y estado del proveedor."
                : "Completá las credenciales para habilitar cobros online."}
            </p>
          </div>
        </div>

        {showSetupCta ? <OrdersSetupNextSteps status={setupStatus} /> : null}
      </div>

      {saveSuccess ? (
        <Alert className="border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="text-emerald-600" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-200">
            Los cambios se guardaron. Si activaste el proveedor, ya podés recibir
            pagos online.
          </AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-6">
        <SettingsSection
          title="Credenciales"
          description="Los valores sensibles se almacenan cifrados. Nunca se muestran en texto plano después de guardar."
        >
          <SecretInputField
            id="accessToken"
            label="Access token"
            description="Token privado del proveedor. Requerido en la primera configuración."
            value={form.accessToken}
            onChange={(value) => updateField("accessToken", value)}
            placeholder={
              configured?.accessTokenConfigured
                ? "Dejá vacío para mantener el actual"
                : "APP_USR-… o TEST-…"
            }
            disabled={isSaving}
            configured={configured?.accessTokenConfigured}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="publicKey">Public key</Label>
            <p className="text-sm text-muted-foreground">
              Clave pública para el checkout del cliente (opcional según integración).
            </p>
            <Input
              id="publicKey"
              value={form.publicKey}
              onChange={(event) => updateField("publicKey", event.target.value)}
              placeholder="APP_USR-…"
              disabled={isSaving}
              className="font-mono text-sm"
              autoComplete="off"
            />
          </div>

          <SecretInputField
            id="webhookSecret"
            label="Webhook secret"
            description="Secreto para validar notificaciones de pago entrantes."
            value={form.webhookSecret}
            onChange={(value) => updateField("webhookSecret", value)}
            placeholder={
              configured?.webhookSecretConfigured
                ? "Dejá vacío para mantener el actual"
                : "Tu secreto de webhook"
            }
            disabled={isSaving}
            configured={configured?.webhookSecretConfigured}
          />
        </SettingsSection>

        <SettingsSection
          title="Estado"
          description="Controlá si el proveedor está en modo prueba y si acepta pagos."
        >
          <ToggleField
            id="isSandbox"
            label="Modo sandbox"
            description="Usá credenciales de prueba sin cobrar pagos reales."
            checked={form.isSandbox}
            onCheckedChange={(checked) => updateField("isSandbox", checked)}
            disabled={isSaving}
          />
          <ToggleField
            id="isActive"
            label="Proveedor activo"
            description="Solo los proveedores activos pueden procesar pagos."
            checked={form.isActive}
            onCheckedChange={(checked) => updateField("isActive", checked)}
            disabled={isSaving}
          />
        </SettingsSection>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando…
              </>
            ) : isEditing ? (
              "Guardar cambios"
            ) : (
              "Crear configuración"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => router.push("/online-payments")}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
