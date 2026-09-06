"use client"

import { useCallback, useEffect, useState } from "react"
import { isAxiosError } from "axios"
import { Plus, Pencil, Trash2, CreditCard, AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  type AdminPaymentMethodConfig,
  type CreatePaymentMethodConfigPayload,
  type UpdatePaymentMethodConfigPayload,
  createPaymentMethodConfig,
  deletePaymentMethodConfig,
  emptyToNull,
  fetchPaymentMethodConfigs,
  updatePaymentMethodConfig,
} from "@/lib/requests/payment-method-configs"
import {
  getPaymentMethodLabel,
  isValidPaymentMethodId,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethodId,
} from "@/lib/constants/paymentMethods"
import { OrdersSetupNextSteps } from "@/components/orders-setup/orders-setup-next-steps"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  fetchOrdersSetupPrerequisites,
  type OrdersSetupStatus,
} from "@/lib/orders-setup"
import { fetchAdminBusinessConfig } from "@/lib/requests/business-config"

const ALL_METHODS_CONFIGURED_MESSAGE = "Ya configuraste todos los métodos de pago"
const PAYMENT_METHOD_ALREADY_CONFIGURED_MESSAGE =
  "Este método de pago ya tiene un ajuste configurado"

interface FormState {
  paymentMethod: PaymentMethodId | ""
  label: string
  adjustmentType: "PERCENT" | "FIXED"
  adjustmentValue: string
  isSurcharge: boolean
  isActive: boolean
  instructions: string
  bankAlias: string
  bankCbu: string
  bankHolder: string
}

const emptyForm: FormState = {
  paymentMethod: "",
  label: "",
  adjustmentType: "PERCENT",
  adjustmentValue: "",
  isSurcharge: false,
  isActive: true,
  instructions: "",
  bankAlias: "",
  bankCbu: "",
  bankHolder: "",
}

function isTransferMethod(paymentMethod: string): boolean {
  return paymentMethod === "transfer"
}

interface FormErrors {
  paymentMethod?: string
  label?: string
  adjustmentValue?: string
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.paymentMethod) {
    errors.paymentMethod = "El método de pago es requerido"
  } else if (!isValidPaymentMethodId(form.paymentMethod)) {
    errors.paymentMethod = "Seleccioná un método de pago válido"
  }
  if (!form.label.trim()) {
    errors.label = "La etiqueta es requerida"
  }
  const val = Number(form.adjustmentValue.trim().replace(",", "."))
  if (!form.adjustmentValue.trim() || !Number.isFinite(val) || val <= 0) {
    errors.adjustmentValue = "Ingresa un valor válido mayor a cero"
  } else if (form.adjustmentType === "PERCENT" && val > 100) {
    errors.adjustmentValue = "El porcentaje no puede superar el 100%"
  }
  return errors
}

function formatAdjustment(config: AdminPaymentMethodConfig): string {
  const prefix = config.isSurcharge ? "+" : "−"
  if (config.adjustmentType === "PERCENT") {
    return `${prefix}${config.adjustmentValue}%`
  }
  return `${prefix}$${config.adjustmentValue}`
}

export default function PaymentMethodConfigsPage() {
  const [configs, setConfigs] = useState<AdminPaymentMethodConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AdminPaymentMethodConfig | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminPaymentMethodConfig | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [setupStatus, setSetupStatus] = useState<OrdersSetupStatus | null>(null)
  const [showSetupCta, setShowSetupCta] = useState(false)

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

  const loadConfigs = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchPaymentMethodConfigs()
      setConfigs(data)
      void refreshSetupStatus()
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string; error?: string })?.message ??
          (e.response?.data as { message?: string; error?: string })?.error ??
          e.message
        : "No se pudo cargar la configuración"
      toast.error(typeof msg === "string" && msg ? msg : "No se pudo cargar la configuración")
    } finally {
      setIsLoading(false)
    }
  }, [refreshSetupStatus])

  useEffect(() => {
    void loadConfigs()
  }, [loadConfigs])

  const isEditMode = editingConfig != null
  const usedPaymentMethods = new Set(configs.map((c) => c.paymentMethod))
  const availablePaymentMethodOptions = PAYMENT_METHOD_OPTIONS.filter(
    (opt) => !usedPaymentMethods.has(opt.value),
  )
  const canCreateMore = availablePaymentMethodOptions.length > 0
  const paymentMethodSelectOptions = isEditMode
    ? PAYMENT_METHOD_OPTIONS.filter((opt) => opt.value === form.paymentMethod)
    : availablePaymentMethodOptions
  const hasActiveMethod = configs.some((c) => c.isActive)
  const onlineActiveWithoutOffer =
    configs.some((c) => c.paymentMethod === "online" && c.isActive) &&
    setupStatus != null &&
    !setupStatus.hasOfferablePayment

  const openCreate = () => {
    if (!canCreateMore) return
    setEditingConfig(null)
    setForm({
      ...emptyForm,
      paymentMethod: availablePaymentMethodOptions[0]?.value ?? "",
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEdit = (config: AdminPaymentMethodConfig) => {
    setEditingConfig(config)
    setForm({
      paymentMethod: isValidPaymentMethodId(config.paymentMethod)
        ? config.paymentMethod
        : "",
      label: config.label,
      adjustmentType: config.adjustmentType,
      adjustmentValue: String(config.adjustmentValue),
      isSurcharge: config.isSurcharge,
      isActive: config.isActive,
      instructions: config.instructions ?? "",
      bankAlias: config.bankAlias ?? "",
      bankCbu: config.bankCbu ?? "",
      bankHolder: config.bankHolder ?? "",
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  const updateFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFormErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSave = async () => {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error("Por favor corrige los errores del formulario")
      return
    }

    setIsSaving(true)
    try {
      const adjustmentValue = Number(form.adjustmentValue.trim().replace(",", "."))
      const paymentMethod = form.paymentMethod
      const transfer = isTransferMethod(paymentMethod)
      const bankFields = {
        bankAlias: transfer ? emptyToNull(form.bankAlias) : null,
        bankCbu: transfer ? emptyToNull(form.bankCbu) : null,
        bankHolder: transfer ? emptyToNull(form.bankHolder) : null,
      }
      if (editingConfig) {
        const payload: UpdatePaymentMethodConfigPayload = {
          paymentMethod,
          label: form.label.trim(),
          adjustmentType: form.adjustmentType,
          adjustmentValue,
          isSurcharge: form.isSurcharge,
          isActive: form.isActive,
          instructions: emptyToNull(form.instructions),
          ...bankFields,
        }
        const updated = await updatePaymentMethodConfig(editingConfig.id, payload)
        setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        toast.success("Configuración actualizada")
        if (updated.isActive) {
          setShowSetupCta(true)
          void refreshSetupStatus()
        }
      } else {
        const payload: CreatePaymentMethodConfigPayload = {
          paymentMethod,
          label: form.label.trim(),
          adjustmentType: form.adjustmentType,
          adjustmentValue,
          isSurcharge: form.isSurcharge,
          isActive: form.isActive,
          instructions: emptyToNull(form.instructions),
          ...(transfer ? bankFields : {}),
        }
        const created = await createPaymentMethodConfig(payload)
        setConfigs((prev) => [...prev, created])
        toast.success("Configuración creada")
        if (created.isActive) {
          setShowSetupCta(true)
          void refreshSetupStatus()
        }
      }
      setDialogOpen(false)
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409 && !editingConfig) {
        const errData = e.response.data as { message?: string; error?: string }
        const msg =
          errData?.message ??
          (typeof errData?.error === "string" ? errData.error : null) ??
          PAYMENT_METHOD_ALREADY_CONFIGURED_MESSAGE
        setFormErrors((prev) => ({
          ...prev,
          paymentMethod: PAYMENT_METHOD_ALREADY_CONFIGURED_MESSAGE,
        }))
        toast.error(msg)
        void loadConfigs()
        return
      }

      const errData = isAxiosError(e)
        ? (e.response?.data as { error?: string | { fieldErrors?: Record<string, string[]> }; message?: string })
        : null
      if (errData?.error && typeof errData.error === "object" && errData.error.fieldErrors) {
        const fe = errData.error.fieldErrors
        const newErrors: FormErrors = {}
        if (fe.adjustmentValue?.length) newErrors.adjustmentValue = fe.adjustmentValue[0]
        if (fe.paymentMethod?.length) newErrors.paymentMethod = fe.paymentMethod[0]
        if (fe.label?.length) newErrors.label = fe.label[0]
        setFormErrors(newErrors)
        toast.error("Corrige los errores del formulario")
      } else {
        const msg = errData?.message ?? (typeof errData?.error === "string" ? errData.error : null) ?? "Error al guardar"
        toast.error(msg)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deletePaymentMethodConfig(deleteTarget.id)
      setConfigs((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      toast.success("Configuración eliminada")
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string })?.message ?? e.message
        : "Error al eliminar"
      toast.error(typeof msg === "string" ? msg : "Error al eliminar")
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleToggleActive = async (config: AdminPaymentMethodConfig) => {
    setTogglingId(config.id)
    try {
      const updated = await updatePaymentMethodConfig(config.id, {
        isActive: !config.isActive,
      })
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      if (updated.isActive) {
        setShowSetupCta(true)
        void refreshSetupStatus()
        toast.success("Método activado. Los pedidos no se habilitan solos.")
      }
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string })?.message ?? e.message
        : "Error al actualizar"
      toast.error(typeof msg === "string" ? msg : "Error al actualizar")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ajustes por método de pago
          </h1>
          <p className="text-muted-foreground">
            Configura descuentos o recargos según el método de pago elegido por el cliente.
          </p>
        </div>
        {canCreateMore ? (
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 size-4" />
            Agregar ajuste
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button disabled>
                  <Plus className="mr-1.5 size-4" />
                  Agregar ajuste
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{ALL_METHODS_CONFIGURED_MESSAGE}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {isLoading ? (
        <PaymentMethodConfigsSkeleton />
      ) : (
        <>
          <div className="flex flex-col gap-4">
          {!hasActiveMethod ? (
            <Alert className="border-amber-500/40 bg-amber-500/5">
              <AlertCircle className="text-amber-600" />
              <AlertTitle>Ningún método activo</AlertTitle>
              <AlertDescription>
                Activá al menos uno antes de vender. Pago online sin Mercado Pago
                no cuenta como ofrecible. Activar un método no habilita pedidos.
              </AlertDescription>
            </Alert>
          ) : null}

          {(showSetupCta || hasActiveMethod) &&
          setupStatus &&
          !setupStatus.isReadyToSell ? (
            <OrdersSetupNextSteps
              status={setupStatus}
              onlineNeedsProvider={onlineActiveWithoutOffer}
            />
          ) : null}

          {configs.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CreditCard />
                </EmptyMedia>
                <EmptyTitle>Sin ajustes configurados</EmptyTitle>
                <EmptyDescription>
                  Agrega un ajuste para aplicar descuentos o recargos según el
                  método de pago.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {configs.map((config) => (
                <Card
                  key={config.id}
                  className={config.isActive ? "" : "opacity-60"}
                >
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 pb-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {getPaymentMethodLabel(config.paymentMethod)}
                        </Badge>
                        <Badge
                          variant={
                            config.isSurcharge ? "destructive" : "secondary"
                          }
                          className={
                            config.isSurcharge
                              ? ""
                              : "text-green-700 dark:text-green-400"
                          }
                        >
                          {config.isSurcharge ? "Recargo" : "Descuento"}
                        </Badge>
                        {!config.isActive && (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {config.adjustmentType === "PERCENT"
                          ? "Porcentaje"
                          : "Monto fijo"}{" "}
                        ·{" "}
                        <span className="font-medium tabular-nums">
                          {formatAdjustment(config)}
                        </span>
                      </p>
                      {isTransferMethod(config.paymentMethod) &&
                        (config.bankAlias ||
                          config.bankCbu ||
                          config.bankHolder) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[
                              config.bankAlias
                                ? `Alias: ${config.bankAlias}`
                                : null,
                              config.bankCbu ? `CBU: ${config.bankCbu}` : null,
                              config.bankHolder ? config.bankHolder : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      {config.instructions && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {config.instructions}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={config.isActive}
                        onCheckedChange={() => void handleToggleActive(config)}
                        disabled={togglingId === config.id}
                        aria-label={config.isActive ? "Desactivar" : "Activar"}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(config)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(config)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </div>
        </>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Editar ajuste" : "Nuevo ajuste de pago"}
            </DialogTitle>
            <DialogDescription>
              {editingConfig
                ? "Modifica la configuración de ajuste por método de pago."
                : "Configura un descuento o recargo para un método de pago específico."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* paymentMethod */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="paymentMethod"
                className={formErrors.paymentMethod ? "text-destructive" : ""}
              >
                Método de pago
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Select
                value={form.paymentMethod || undefined}
                onValueChange={(v) =>
                  updateFormField("paymentMethod", v as PaymentMethodId)
                }
                disabled={isSaving || isEditMode || paymentMethodSelectOptions.length === 0}
              >
                <SelectTrigger
                  id="paymentMethod"
                  aria-invalid={!!formErrors.paymentMethod}
                  className={formErrors.paymentMethod ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Seleccioná un método de pago" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodSelectOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.paymentMethod && (
                <p className="text-sm text-destructive">{formErrors.paymentMethod}</p>
              )}
            </div>

            {/* label */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="configLabel"
                className={formErrors.label ? "text-destructive" : ""}
              >
                Etiqueta visible
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="configLabel"
                placeholder="Ej: Descuento pago en efectivo"
                value={form.label}
                onChange={(e) => updateFormField("label", e.target.value)}
                disabled={isSaving}
                aria-invalid={!!formErrors.label}
                className={formErrors.label ? "border-destructive" : ""}
              />
              {formErrors.label && (
                <p className="text-sm text-destructive">{formErrors.label}</p>
              )}
            </div>

            {/* adjustmentType + adjustmentValue */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="adjustmentType">Tipo</Label>
                <Select
                  value={form.adjustmentType}
                  onValueChange={(v) =>
                    updateFormField("adjustmentType", v as "PERCENT" | "FIXED")
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger id="adjustmentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Porcentaje (%)</SelectItem>
                    <SelectItem value="FIXED">Monto fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="adjustmentValue"
                  className={formErrors.adjustmentValue ? "text-destructive" : ""}
                >
                  Valor
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="adjustmentValue"
                  type="number"
                  min={0}
                  max={form.adjustmentType === "PERCENT" ? 100 : undefined}
                  step="any"
                  placeholder={form.adjustmentType === "PERCENT" ? "Ej: 5" : "Ej: 200"}
                  value={form.adjustmentValue}
                  onChange={(e) => updateFormField("adjustmentValue", e.target.value)}
                  disabled={isSaving}
                  aria-invalid={!!formErrors.adjustmentValue}
                  className={formErrors.adjustmentValue ? "border-destructive" : ""}
                />
              </div>
            </div>
            {formErrors.adjustmentValue && (
              <p className="text-sm text-destructive -mt-2">{formErrors.adjustmentValue}</p>
            )}

            {/* instructions */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="instructions">Instrucciones para el cliente</Label>
              <Textarea
                id="instructions"
                placeholder="Ej: Transferí al alias LOCAL.COMIDA y mandame el comprobante por este chat."
                value={form.instructions}
                onChange={(e) => updateFormField("instructions", e.target.value)}
                disabled={isSaving}
                maxLength={2000}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Texto libre que ve el cliente al elegir este método. Vacío lo limpia.
              </p>
            </div>

            {/* Datos bancarios — solo transferencia */}
            {isTransferMethod(form.paymentMethod) && (
              <>
                <Separator />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Datos bancarios</p>
                  <p className="text-xs text-muted-foreground">
                    Se usan para validar el comprobante (alias y CBU/CVU). El titular es solo informativo.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bankAlias">Alias</Label>
                  <Input
                    id="bankAlias"
                    placeholder="Ej: local.comida"
                    value={form.bankAlias}
                    onChange={(e) => updateFormField("bankAlias", e.target.value)}
                    disabled={isSaving}
                    maxLength={255}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bankCbu">CBU / CVU</Label>
                  <Input
                    id="bankCbu"
                    placeholder="Ej: 0000003100010000000001"
                    value={form.bankCbu}
                    onChange={(e) => updateFormField("bankCbu", e.target.value)}
                    disabled={isSaving}
                    maxLength={50}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bankHolder">Titular de la cuenta</Label>
                  <Input
                    id="bankHolder"
                    placeholder="Ej: Mi Local SRL"
                    value={form.bankHolder}
                    onChange={(e) => updateFormField("bankHolder", e.target.value)}
                    disabled={isSaving}
                    maxLength={255}
                  />
                </div>
              </>
            )}

            <Separator />

            {/* isSurcharge */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="isSurcharge" className="cursor-pointer">
                  ¿Es un recargo?
                </Label>
                <p className="text-sm text-muted-foreground">
                  Activado = recargo adicional · Desactivado = descuento
                </p>
              </div>
              <Switch
                id="isSurcharge"
                checked={form.isSurcharge}
                onCheckedChange={(v) => updateFormField("isSurcharge", v)}
                disabled={isSaving}
              />
            </div>

            {/* isActive */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="isActive" className="cursor-pointer">
                  Activo
                </Label>
                <p className="text-sm text-muted-foreground">
                  Si está desactivado, no se aplicará a los pedidos
                </p>
              </div>
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => updateFormField("isActive", v)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={isSaving || (!isEditMode && !canCreateMore)}
              >
                {isSaving
                  ? "Guardando…"
                  : editingConfig
                    ? "Guardar cambios"
                    : "Crear ajuste"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ajuste?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la configuración{" "}
              <strong>{deleteTarget?.label}</strong> (
              {deleteTarget ? getPaymentMethodLabel(deleteTarget.paymentMethod) : ""}
              ).
              No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PaymentMethodConfigsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center justify-between pt-4 pb-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
