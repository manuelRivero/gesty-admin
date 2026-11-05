"use client"

import { useCallback, useEffect, useState } from "react"
import { isAxiosError } from "axios"
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import {
  SuperAdminInvoicingBusinessesSection,
  SuperAdminInvoicingIssuesSection,
  SuperAdminInvoicingUsageSection,
} from "@/components/super-admin/invoicing-operations"
import {
  fetchArcaHealth,
  fetchCentralProviderConfig,
  saveCentralProviderEnvironment,
  saveCentralProviderToken,
  setCentralProviderActive,
  validateCentralProviderConnectivity,
  type CentralProviderConfig,
  type CentralBillingProvider,
  type CentralProviderEnvironment,
} from "@/lib/requests/invoicing"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

const PROVIDER: CentralBillingProvider = "sistemas360"

export default function SuperAdminInvoicingPage() {
  const [config, setConfig] = useState<CentralProviderConfig | null>(null)
  const [arcaHealth, setArcaHealth] = useState<{ ok: boolean; status: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sandboxToken, setSandboxToken] = useState("")
  const [productionToken, setProductionToken] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [{ config: current }, health] = await Promise.all([
        fetchCentralProviderConfig(PROVIDER),
        fetchArcaHealth(PROVIDER),
      ])
      setConfig(current)
      setArcaHealth(health)
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo cargar la configuración del proveedor."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSaveToken = async (environment: CentralProviderEnvironment) => {
    const token = environment === "sandbox" ? sandboxToken : productionToken
    if (!token.trim()) {
      toast.error("Ingresá un token antes de guardar.")
      return
    }
    setIsSaving(true)
    try {
      const { config: updated } = await saveCentralProviderToken(PROVIDER, environment, token.trim())
      setConfig(updated)
      if (environment === "sandbox") setSandboxToken("")
      else setProductionToken("")
      toast.success(`Token de ${environment === "sandbox" ? "sandbox" : "producción"} guardado.`)
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar el token."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetEnvironment = async (environment: CentralProviderEnvironment) => {
    setIsSaving(true)
    try {
      const { config: updated } = await saveCentralProviderEnvironment(PROVIDER, environment)
      setConfig(updated)
      toast.success(`Entorno activo: ${environment === "sandbox" ? "sandbox" : "producción"}.`)
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo cambiar el entorno."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (isActive: boolean) => {
    setIsSaving(true)
    try {
      const { config: updated } = await setCentralProviderActive(PROVIDER, isActive)
      setConfig(updated)
      toast.success(isActive ? "Sistemas 360 activado como proveedor." : "Sistemas 360 desactivado.")
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo cambiar la activación."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      const { config: updated } = await validateCentralProviderConnectivity(PROVIDER)
      setConfig(updated)
      toast.success("Conectividad verificada.")
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo validar la conectividad."))
    } finally {
      setIsValidating(false)
    }
  }

  const activeEnvironment = config?.activeEnvironment
  const activeTokenConfigured =
    activeEnvironment === "sandbox"
      ? config?.hasSandboxToken === true
      : activeEnvironment === "production"
        ? config?.hasProductionToken === true
        : false
  const validationMatchesActiveToken =
    activeTokenConfigured &&
    config?.status === "validated" &&
    config.lastValidatedEnvironment === activeEnvironment
  const validationLabel =
    config?.status === "rejected"
      ? "Rechazado"
      : validationMatchesActiveToken
        ? "Token validado para el entorno activo"
        : config?.status === "validated"
          ? activeTokenConfigured
            ? config.lastValidatedEnvironment
              ? "Validación de otro entorno"
              : "Entorno de validación no informado"
            : "Token del entorno no configurado"
          : config?.status === "pending_validation"
            ? "Validación pendiente"
            : "Sin validar"

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
        <h1 className="text-2xl font-semibold tracking-tight">Facturación electrónica — cuenta central</h1>
        <p className="text-muted-foreground">
          Sistemas 360 opera con una cuenta central de Gesty (token de cuenta, múltiples
          emisores). Usá un token de cuenta, no un token vinculado a un emisor. Ningún restaurante
          ve ni administra estas credenciales.
        </p>
      </div>

      <Alert className="border-amber-500/40 bg-amber-500/5">
        <ShieldAlert className="text-amber-600" />
        <AlertTitle>Sandbox es el entorno inicial</AlertTitle>
        <AlertDescription>
          Activar producción es una decisión explícita y separada de guardar un token. No se
          activa sola ni por default.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tokens de cuenta</CardTitle>
          <CardDescription>
            Se almacenan cifrados. Nunca se muestran en texto plano después de guardarlos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sandboxToken">Token sandbox</Label>
            {config?.hasSandboxToken ? (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" /> Ya configurado
              </p>
            ) : null}
            <div className="flex gap-2">
              <Input
                id="sandboxToken"
                type="password"
                value={sandboxToken}
                onChange={(event) => setSandboxToken(event.target.value)}
                placeholder="Dejá vacío si no querés cambiarlo"
                disabled={isSaving}
                className="font-mono text-sm"
                autoComplete="off"
              />
              <Button onClick={() => void handleSaveToken("sandbox")} disabled={isSaving}>
                Guardar
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="productionToken">Token producción</Label>
            {config?.hasProductionToken ? (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" /> Ya configurado
              </p>
            ) : null}
            <div className="flex gap-2">
              <Input
                id="productionToken"
                type="password"
                value={productionToken}
                onChange={(event) => setProductionToken(event.target.value)}
                placeholder="Dejá vacío si no querés cambiarlo"
                disabled={isSaving}
                className="font-mono text-sm"
                autoComplete="off"
              />
              <Button onClick={() => void handleSaveToken("production")} disabled={isSaving}>
                Guardar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entorno y activación</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant={config?.activeEnvironment === "sandbox" ? "default" : "outline"}
            onClick={() => void handleSetEnvironment("sandbox")}
            disabled={isSaving}
          >
            Usar sandbox
          </Button>
          <Button
            variant={config?.activeEnvironment === "production" ? "destructive" : "outline"}
            onClick={() => void handleSetEnvironment("production")}
            disabled={isSaving}
          >
            Usar producción
          </Button>
          <div className="w-full border-t pt-3">
            <Button
              variant={config?.isActive ? "outline" : "default"}
              onClick={() => void handleToggleActive(!config?.isActive)}
              disabled={isSaving}
            >
              {config?.isActive ? "Desactivar Sistemas 360" : "Activar Sistemas 360 como proveedor"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estado</CardTitle>
          <CardDescription>
            Estado de Sistemas 360 en la cuenta central de Gesty
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Configuración</p>
            <p className="text-sm">Proveedor: Sistemas 360</p>
            <Badge variant={config?.isActive ? "default" : "outline"} className="w-fit">
              {config?.isActive ? "Proveedor activado" : "Proveedor desactivado"}
            </Badge>
            <p className="text-sm">
              Entorno activo:{" "}
              {activeEnvironment === "production"
                ? "Producción"
                : activeEnvironment === "sandbox"
                  ? "Sandbox"
                  : "No configurado"}
            </p>
            <Badge variant={activeTokenConfigured ? "default" : "outline"} className="w-fit">
              Token del entorno activo: {activeTokenConfigured ? "configurado" : "no configurado"}
            </Badge>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Validación del token</p>
            <Badge
              variant={
                validationMatchesActiveToken
                  ? "default"
                  : config?.status === "rejected"
                    ? "destructive"
                    : "outline"
              }
            >
              {validationLabel}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Última validación registrada:{" "}
              {config?.lastValidatedAt
                ? new Date(config.lastValidatedAt).toLocaleString("es-AR")
                : "sin fecha"}
            </p>
            <p className="text-sm text-muted-foreground">
              Entorno de la última validación:{" "}
              {config?.lastValidatedEnvironment === "production"
                ? "Producción"
                : config?.lastValidatedEnvironment === "sandbox"
                  ? "Sandbox"
                  : "no informado"}
            </p>
            {config?.lastValidationDetail ? (
              <p className="text-sm text-muted-foreground">{config.lastValidationDetail}</p>
            ) : null}
            <Button
              variant="outline"
              className="mt-1"
              onClick={() => void handleValidate()}
              disabled={isValidating}
            >
              {isValidating ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Validando…
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" /> Validar conectividad con Sistemas 360
                </>
              )}
            </Button>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Conectividad con ARCA</p>
            <Badge
              variant={
                arcaHealth === null ? "outline" : arcaHealth.ok ? "default" : "destructive"
              }
            >
              {arcaHealth === null
                ? "Estado desconocido"
                : arcaHealth.ok
                  ? "Operativo"
                  : "No disponible"}
            </Badge>
            {arcaHealth ? (
              <p className="text-sm text-muted-foreground">
                Estado reportado: {arcaHealth.status}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consumo técnico de la cuenta central</CardTitle>
          <CardDescription>
            Acumulado histórico de requests contabilizados contra Sistemas 360. Incluye llamadas
            técnicas de todos los negocios y no representa consumo mensual ni comprobantes
            autorizados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums">
            {config ? config.totalRequestsCount.toLocaleString("es-AR") : "—"}
          </p>
          <p className="text-sm text-muted-foreground">Requests técnicos acumulados</p>
        </CardContent>
      </Card>

      <SuperAdminInvoicingUsageSection />
      <SuperAdminInvoicingIssuesSection />
      <SuperAdminInvoicingBusinessesSection />
    </div>
  )
}
