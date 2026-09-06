"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BotPersonalitySelector } from "@/components/settings/bot-personality-selector"
import { OrdersSetupChecklist } from "@/components/settings/orders-setup-checklist"
import { SettingsFormFooter, SETTINGS_UNSAVED_MESSAGE } from "@/components/settings/settings-form-footer"
import { SettingsSection } from "@/components/settings/settings-section"
import { ToggleField } from "@/components/settings/toggle-field"
import { NumberInputField } from "@/components/settings/number-input-field"
import {
  fetchOrdersSetupPrerequisites,
  hasFulfillmentCapability,
  type OrdersSetupStatus,
} from "@/lib/orders-setup"
import {
  fetchAdminBusinessConfig,
  getBusinessConfigApiErrorMessage,
  patchAdminBusinessConfig,
  resetAdminBusinessConfig,
  type AdminBusinessConfig,
  type AdminBusinessConfigPatch,
} from "@/lib/requests/business-config"
import { useUnsavedChangesToast } from "@/hooks/use-unsaved-changes-toast"

type SettingsData = AdminBusinessConfig

/** `checkout_enabled` sigue a `orders_enabled` en backend; no se edita en UI. */
const PATCH_EXCLUDED_KEYS = new Set<keyof SettingsData>([
  "bot_personality",
  "checkout_enabled",
])

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [initialSettings, setInitialSettings] = useState<SettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [setupStatus, setSetupStatus] = useState<OrdersSetupStatus | null>(null)
  const [isSetupLoading, setIsSetupLoading] = useState(true)

  const refreshSetupStatus = useCallback(async (config: SettingsData) => {
    setIsSetupLoading(true)
    try {
      const status = await fetchOrdersSetupPrerequisites({
        orders_enabled: config.orders_enabled,
        delivery_enabled: config.delivery_enabled,
        takeaway_enabled: config.takeaway_enabled,
        external_delivery_enabled: config.external_delivery_enabled,
      })
      setSetupStatus(status)
    } catch {
      setSetupStatus(null)
    } finally {
      setIsSetupLoading(false)
    }
  }, [])

  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchAdminBusinessConfig()
      setSettings(data)
      setInitialSettings(data)
      void refreshSetupStatus(data)
    } catch (e) {
      toast.error(
        getBusinessConfigApiErrorMessage(e, "No se pudo cargar la configuración."),
      )
    } finally {
      setIsLoading(false)
    }
  }, [refreshSetupStatus])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash.replace("#", "")
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [settings])

  const updateSetting = <K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const patchPayload = useMemo<AdminBusinessConfigPatch>(() => {
    if (!settings || !initialSettings) return {}
    const entries = Object.entries(settings).filter(([key, value]) => {
      const typedKey = key as keyof SettingsData
      if (PATCH_EXCLUDED_KEYS.has(typedKey)) return false
      return value !== initialSettings[typedKey]
    })
    return Object.fromEntries(entries) as AdminBusinessConfigPatch
  }, [settings, initialSettings])

  const isDirty = Object.keys(patchPayload).length > 0

  const checklistStatus = useMemo<OrdersSetupStatus | null>(() => {
    if (!settings || !setupStatus) return setupStatus
    const hasFulfillment = hasFulfillmentCapability(settings)
    const canEnableOrders =
      setupStatus.hasActiveMenu &&
      hasFulfillment &&
      setupStatus.hasOfferablePayment
    return {
      ...setupStatus,
      hasFulfillment,
      ordersEnabled: settings.orders_enabled,
      canEnableOrders,
      isReadyToSell: canEnableOrders && settings.orders_enabled,
      steps: setupStatus.steps.map((step) => {
        if (step.id === "fulfillment") return { ...step, done: hasFulfillment }
        if (step.id === "orders") {
          return { ...step, done: settings.orders_enabled }
        }
        return step
      }),
    }
  }, [settings, setupStatus])

  useUnsavedChangesToast(isDirty, SETTINGS_UNSAVED_MESSAGE)

  const validate = (): boolean => {
    if (!settings) return false

    const requiredPositive: Array<keyof SettingsData> = [
      "idle_reminder_minutes",
      "idle_close_minutes",
      "draft_order_reminder_minutes",
      "draft_order_expire_minutes",
      "reservation_max_days_ahead",
      "reservation_default_duration_minutes",
    ]
    for (const key of requiredPositive) {
      const value = settings[key]
      if (typeof value !== "number" || value <= 0) {
        toast.error("Hay campos numéricos inválidos. Revisa valores mayores a 0.")
        return false
      }
    }

    if (
      settings.human_handoff_auto_timeout_minutes != null &&
      settings.human_handoff_auto_timeout_minutes <= 0
    ) {
      toast.error("El timeout de handoff humano debe ser mayor a 0 o vacío.")
      return false
    }

    if (
      typeof settings.reservation_min_lead_minutes !== "number" ||
      settings.reservation_min_lead_minutes < 0
    ) {
      toast.error("El tiempo mínimo de anticipación debe ser mayor o igual a 0.")
      return false
    }

    if (settings.delivery_enabled && settings.external_delivery_enabled) {
      toast.error(
        "Envío propio y delivery externo son excluyentes: dejá solo uno activo.",
      )
      return false
    }

    // Fulfillment solo obligatorio al habilitar pedidos (I1 / I3).
    if (
      settings.orders_enabled &&
      !hasFulfillmentCapability(settings)
    ) {
      toast.error(
        "Para habilitar pedidos necesitás al menos un modo de entrega: envío propio, delivery externo o retiro en local.",
      )
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!settings) return
    if (!isDirty) {
      toast.info("No hay cambios para guardar")
      return
    }
    if (!validate()) return

    setIsSaving(true)
    try {
      const updated = await patchAdminBusinessConfig(patchPayload)
      setSettings(updated)
      setInitialSettings(updated)
      void refreshSetupStatus(updated)
      toast.success("Configuración guardada correctamente")
    } catch (e) {
      toast.error(getBusinessConfigApiErrorMessage(e))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (!initialSettings) return
    setSettings(initialSettings)
    toast.info("Cambios descartados")
  }

  const handleResetDefaults = async () => {
    setIsResetting(true)
    try {
      await resetAdminBusinessConfig()
      const refreshed = await fetchAdminBusinessConfig()
      setSettings(refreshed)
      setInitialSettings(refreshed)
      void refreshSetupStatus(refreshed)
      toast.success("Configuración restaurada a valores por defecto")
    } catch (e) {
      toast.error(
        getBusinessConfigApiErrorMessage(
          e,
          "No se pudo restaurar la configuración por defecto.",
        ),
      )
    } finally {
      setIsResetting(false)
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Configura el comportamiento del negocio, automatización, entrega y reservas
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Bot & Automation */}
        <SettingsSection
          title="Bot y Automatización"
          description="Configura las respuestas automáticas del bot"
        >
          <ToggleField
            id="bot-enabled"
            label="Habilitar Bot"
            description="Activar respuestas automáticas para los clientes"
            checked={settings.bot_enabled}
            onCheckedChange={(checked) => updateSetting("bot_enabled", checked)}
          />
          <ToggleField
            id="humanize-messages"
            label="Humanizar mensajes"
            description="Humaniza mensajes determinísticos con la personalidad elegida"
            checked={settings.humanize_messages}
            onCheckedChange={(checked) =>
              updateSetting("humanize_messages", checked)
            }
            disabled={!settings.bot_enabled}
          />
          {settings.humanize_messages ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Personalidad del asistente</p>
                <p className="text-sm text-muted-foreground">
                  Elegí el tono de voz del asistente de WhatsApp. Compará los ejemplos
                  y guardá la configuración para aplicar los cambios.
                </p>
              </div>
              <BotPersonalitySelector
                selectedPersonalityId={settings.bot_personality_id}
                onPersonalitySelect={(personalityId) =>
                  updateSetting("bot_personality_id", personalityId)
                }
              />
            </div>
          ) : null}
        </SettingsSection>

        {/* Human Handoff */}
        <SettingsSection
          title="Transferencia a Humano"
          description="Permite que las conversaciones sean atendidas por un agente"
        >
          <ToggleField
            id="allow-human-handoff"
            label="Permitir Soporte Humano"
            description="Permitir transferir conversaciones a un agente humano"
            checked={settings.allow_human_handoff}
            onCheckedChange={(checked) =>
              updateSetting("allow_human_handoff", checked)
            }
          />
          <NumberInputField
            id="auto-timeout"
            label="Volver al Bot Después de (minutos)"
            description="Tiempo antes de regresar automáticamente al bot"
            value={settings.human_handoff_auto_timeout_minutes}
            onChange={(value) => updateSetting("human_handoff_auto_timeout_minutes", value)}
            disabled={!settings.allow_human_handoff}
            placeholder="Dejar vacío para desactivar"
            min={1}
          />
        </SettingsSection>

        {/* Idle & Reminders */}
        <SettingsSection
          title="Inactividad y Recordatorios"
          description="Configura los recordatorios por inactividad"
        >
          <ToggleField
            id="send-idle-reminders"
            label="Enviar Recordatorios de Inactividad"
            description="Notificar al cliente cuando está inactivo"
            checked={settings.send_idle_reminders}
            onCheckedChange={(checked) =>
              updateSetting("send_idle_reminders", checked)
            }
          />
          <NumberInputField
            id="idle-reminder-delay"
            label="Recordatorio Después de (minutos)"
            description="Tiempo de inactividad antes de enviar recordatorio"
            value={settings.idle_reminder_minutes}
            onChange={(value) =>
              updateSetting("idle_reminder_minutes", value ?? 1)
            }
            disabled={!settings.send_idle_reminders}
            min={1}
          />
          <NumberInputField
            id="auto-close-conversation"
            label="Cerrar Conversación Después de (minutos)"
            description="Tiempo de inactividad antes de cerrar la conversación"
            value={settings.idle_close_minutes}
            onChange={(value) =>
              updateSetting("idle_close_minutes", value ?? 1)
            }
            min={1}
          />
        </SettingsSection>

        {/* Order Reminders */}
        <SettingsSection
          title="Recordatorios de Pedidos"
          description="Configura los recordatorios para pedidos pendientes"
        >
          <ToggleField
            id="send-order-reminders"
            label="Enviar Recordatorios de Pedidos"
            description="Notificar sobre pedidos pendientes de completar"
            checked={settings.send_order_reminders}
            onCheckedChange={(checked) =>
              updateSetting("send_order_reminders", checked)
            }
          />
          <NumberInputField
            id="draft-order-reminder-delay"
            label="Recordatorio para Pedidos Pendientes (minutos)"
            description="Tiempo antes de recordar sobre un pedido en borrador"
            value={settings.draft_order_reminder_minutes}
            onChange={(value) =>
              updateSetting("draft_order_reminder_minutes", value ?? 1)
            }
            disabled={!settings.send_order_reminders}
            min={1}
          />
          <NumberInputField
            id="draft-order-expiration"
            label="Expirar Pedidos Pendientes Después de (minutos)"
            description="Tiempo antes de expirar automáticamente un pedido en borrador"
            value={settings.draft_order_expire_minutes}
            onChange={(value) =>
              updateSetting("draft_order_expire_minutes", value ?? 1)
            }
            disabled={!settings.send_order_reminders}
            min={1}
          />
        </SettingsSection>

        {/* Pedidos: un solo control visual (orders_enabled). checkout_enabled sigue al backend. */}
        <SettingsSection
          id="pedidos"
          title="Pedidos"
          description="El bot no toma pedidos hasta que habilites esta opción. Completá el checklist antes."
        >
          <OrdersSetupChecklist
            status={checklistStatus}
            isLoading={isSetupLoading}
          />
          <ToggleField
            id="orders-enabled"
            label="Habilitar pedidos"
            description={
              checklistStatus &&
              !checklistStatus.hasActiveMenu &&
              !settings.orders_enabled
                ? "Falta menú con al menos un producto disponible"
                : checklistStatus &&
                    !checklistStatus.hasOfferablePayment &&
                    !settings.orders_enabled
                  ? "Falta al menos un método de pago ofrecible"
                  : !hasFulfillmentCapability(settings) &&
                      !settings.orders_enabled
                    ? "Elegí delivery y/o retiro en local en la sección de abajo"
                    : "Permitir que los clientes realicen pedidos por el bot"
            }
            checked={settings.orders_enabled}
            onCheckedChange={(checked) =>
              updateSetting("orders_enabled", checked)
            }
          />
        </SettingsSection>

        <SettingsSection
          id="entrega"
          title="Entrega y retiro"
          description="Elegí al menos una opción antes de vender. Envío propio y delivery externo son excluyentes. Podés dejar todo apagado mientras configurás el local."
        >
          {!hasFulfillmentCapability(settings) ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
              Todavía no hay fulfillment activo. Activá envío propio, delivery
              externo o retiro en local para poder habilitar pedidos.
            </p>
          ) : null}
          <ToggleField
            id="delivery-enabled"
            label="Envío a domicilio (propio)"
            description="Delivery con flota o logística propia del local"
            checked={settings.delivery_enabled}
            onCheckedChange={(checked) => {
              updateSetting("delivery_enabled", checked)
              if (checked && settings.external_delivery_enabled) {
                updateSetting("external_delivery_enabled", false)
              }
            }}
          />
          <ToggleField
            id="external-delivery-enabled"
            label="Delivery externo (PedidosYa)"
            description="Usá flota externa. Desactiva el envío propio y habilita la calibración de tarifas en Zonas de envío."
            checked={settings.external_delivery_enabled}
            onCheckedChange={(checked) => {
              updateSetting("external_delivery_enabled", checked)
              if (checked && settings.delivery_enabled) {
                updateSetting("delivery_enabled", false)
              }
            }}
          />
          <ToggleField
            id="takeaway-enabled"
            label="Retiro en local"
            description="Permitir que el cliente retire el pedido en el local"
            checked={settings.takeaway_enabled}
            onCheckedChange={(checked) =>
              updateSetting("takeaway_enabled", checked)
            }
          />
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="pickup-instructions"
              className={!settings.takeaway_enabled ? "text-muted-foreground" : ""}
            >
              Instrucciones de retiro (opcional)
            </Label>
            <p className="text-sm text-muted-foreground">
              Texto que verá el cliente al elegir retiro (por ejemplo, acceso o mostrador).
            </p>
            <Textarea
              id="pickup-instructions"
              rows={3}
              placeholder="Ej.: Retirar por el mostrador de la calle lateral."
              value={settings.pickup_instructions ?? ""}
              onChange={(e) => {
                const v = e.target.value
                updateSetting(
                  "pickup_instructions",
                  v.trim() === "" ? null : v,
                )
              }}
              disabled={!settings.takeaway_enabled}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Fuera de horario"
          description="Comportamiento del bot y pedidos cuando el local está cerrado"
        >
          <ToggleField
            id="operate-when-closed"
            label="Operar fuera de horario"
            description="Permitir que el bot atienda conversaciones aunque el local esté cerrado"
            checked={settings.operate_when_closed}
            onCheckedChange={(checked) => {
              updateSetting("operate_when_closed", checked)
              if (!checked && settings.orders_when_closed) {
                updateSetting("orders_when_closed", false)
              }
            }}
            disabled={!settings.bot_enabled}
          />
          <ToggleField
            id="orders-when-closed"
            label="Aceptar pedidos fuera de horario"
            description="Permitir crear pedidos aunque el local esté cerrado"
            checked={settings.orders_when_closed}
            onCheckedChange={(checked) =>
              updateSetting("orders_when_closed", checked)
            }
            disabled={!settings.operate_when_closed}
          />
        </SettingsSection>

        {/* Reservations */}
        <SettingsSection
          title="Reservaciones"
          description="Independiente de pedidos: podés tomar reservas sin vender online."
        >
          <ToggleField
            id="reservations-enabled"
            label="Habilitar Reservaciones"
            description="Permitir que los clientes hagan reservaciones"
            checked={settings.reservations_enabled}
            onCheckedChange={(checked) =>
              updateSetting("reservations_enabled", checked)
            }
          />
          <NumberInputField
            id="min-advance-time"
            label="Tiempo Mínimo de Anticipación (minutos)"
            description="Tiempo mínimo antes de la reservación"
            value={settings.reservation_min_lead_minutes}
            onChange={(value) =>
              updateSetting("reservation_min_lead_minutes", value ?? 0)
            }
            disabled={!settings.reservations_enabled}
            min={0}
          />
          <NumberInputField
            id="max-days-ahead"
            label="Días Máximos de Anticipación"
            description="Máximo de días de anticipación para reservar"
            value={settings.reservation_max_days_ahead}
            onChange={(value) => updateSetting("reservation_max_days_ahead", value ?? 1)}
            disabled={!settings.reservations_enabled}
            min={1}
          />
          <NumberInputField
            id="default-duration"
            label="Duración Predeterminada (minutos)"
            description="Duración por defecto de cada reservación"
            value={settings.reservation_default_duration_minutes}
            onChange={(value) =>
              updateSetting("reservation_default_duration_minutes", value ?? 1)
            }
            disabled={!settings.reservations_enabled}
            min={1}
          />
          <ToggleField
            id="require-confirmation"
            label="Requerir Confirmación"
            description="Las reservaciones requieren confirmación manual"
            checked={settings.reservation_require_confirmation}
            onCheckedChange={(checked) =>
              updateSetting("reservation_require_confirmation", checked)
            }
            disabled={!settings.reservations_enabled}
          />
          <ToggleField
            id="allow-same-day"
            label="Permitir Reservaciones del Mismo Día"
            description="Permitir reservar para el día actual"
            checked={settings.reservation_allow_same_day}
            onCheckedChange={(checked) =>
              updateSetting("reservation_allow_same_day", checked)
            }
            disabled={!settings.reservations_enabled}
          />
        </SettingsSection>
      </div>

      <SettingsFormFooter
        isDirty={isDirty}
        isSaving={isSaving}
        isResetting={isResetting}
        onSave={() => void handleSave()}
        onCancel={handleCancel}
        onResetDefaults={() => void handleResetDefaults()}
      />
    </div>
  )
}
