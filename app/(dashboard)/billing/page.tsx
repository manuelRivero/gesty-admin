"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { isAxiosError } from "axios"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertCircle, ExternalLink, Loader2, Undo2, Wallet, XCircle } from "lucide-react"
import { toast } from "sonner"

import { CancelSubscriptionModal } from "@/components/billing/cancel-subscription-modal"
import { PlanCard } from "@/components/billing/plan-card"
import { QuotaSection } from "@/components/billing/quota-section"
import { SubscriptionStatusBadge } from "@/components/billing/subscription-status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  cancelBillingSubscription,
  changeBillingPlan,
  createBillingCheckout,
  createBillingPortal,
  fetchBillingPlans,
  fetchBillingSubscription,
  isCurrentBillingPlan,
  reactivateBillingSubscription,
  type BillingPlan,
  type BillingSubscriptionResponse,
} from "@/lib/requests/billing"

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return format(new Date(iso), "d MMM yyyy", { locale: es })
  } catch {
    return iso
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function refetchSubscriptionWithRetry(
  attempts = 3,
  delayMs = 1500,
): Promise<BillingSubscriptionResponse> {
  let last = await fetchBillingSubscription()
  for (let i = 1; i < attempts && !last.access_ok; i += 1) {
    await sleep(delayMs)
    last = await fetchBillingSubscription()
  }
  return last
}

function BillingLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingLoadingSkeleton />}>
      <BillingPageContent />
    </Suspense>
  )
}

/** Exportado (además del default) para poder testear sin mockear `Suspense`. */
export function BillingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bootstrapped = useRef(false)

  const [billing, setBilling] = useState<BillingSubscriptionResponse | null>(
    null,
  )
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutPlanCode, setCheckoutPlanCode] = useState<string | null>(null)
  const [changePlanCode, setChangePlanCode] = useState<string | null>(null)
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const [isCancelPending, setIsCancelPending] = useState(false)
  const [isReactivatePending, setIsReactivatePending] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const applyPayload = useCallback(
    (
      subscriptionData: BillingSubscriptionResponse,
      plansData: { plans: BillingPlan[] },
    ) => {
      setBilling(subscriptionData)
      setPlans(plansData.plans ?? [])
    },
    [],
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [subscriptionData, plansData] = await Promise.all([
        fetchBillingSubscription(),
        fetchBillingPlans(),
      ])
      applyPayload(subscriptionData, plansData)
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo cargar la facturación."))
    } finally {
      setIsLoading(false)
    }
  }, [applyPayload])

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    const checkout = searchParams.get("checkout")
    if (checkout) {
      router.replace("/billing", { scroll: false })
    }

    void (async () => {
      setIsLoading(true)
      try {
        if (checkout === "success") {
          toast.success("Pago recibido. Actualizando tu plan…")
          const [subscriptionData, plansData] = await Promise.all([
            refetchSubscriptionWithRetry(),
            fetchBillingPlans(),
          ])
          applyPayload(subscriptionData, plansData)
          if (subscriptionData.access_ok) {
            toast.success("Suscripción activa.")
          } else {
            toast.info(
              "El pago se registró; la activación puede tardar unos segundos. Recargá si no ves el cambio.",
            )
          }
          return
        }

        if (checkout === "cancel") {
          toast.message("Cancelaste el pago")
        }

        const [subscriptionData, plansData] = await Promise.all([
          fetchBillingSubscription(),
          fetchBillingPlans(),
        ])
        applyPayload(subscriptionData, plansData)
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo cargar la facturación."))
      } finally {
        setIsLoading(false)
      }
    })()
  }, [applyPayload, router, searchParams])

  const handleSubscribe = async (planCode: string) => {
    setCheckoutPlanCode(planCode)
    try {
      const { url } = await createBillingCheckout(planCode)
      if (!url) {
        toast.error("Stripe no devolvió una URL de checkout.")
        return
      }
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo iniciar el checkout."))
    } finally {
      setCheckoutPlanCode(null)
    }
  }

  const handlePortal = async () => {
    setIsPortalLoading(true)
    try {
      const { url } = await createBillingPortal()
      if (!url) {
        toast.error("Stripe no devolvió una URL del portal.")
        return
      }
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(
        errorMessage(err, "No se pudo abrir el portal de facturación."),
      )
    } finally {
      setIsPortalLoading(false)
    }
  }

  const handleConfirmCancel = async () => {
    setIsCancelPending(true)
    try {
      const result = await cancelBillingSubscription()
      setBilling((prev) =>
        prev
          ? {
              ...prev,
              billing_state: result.billing_state,
              actions: result.actions,
              subscription: result.subscription,
            }
          : prev,
      )
      setCancelModalOpen(false)
      toast.success(
        `Cancelación programada para el ${formatDateLabel(result.subscription.current_period_end)}. El acceso sigue activo hasta esa fecha.`,
      )
    } catch (err) {
      // No se cierra el modal ni se toca `billing` — el estado anterior,
      // confirmado, sigue siendo el que se muestra.
      toast.error(errorMessage(err, "No se pudo programar la cancelación."))
    } finally {
      setIsCancelPending(false)
    }
  }

  const handleReactivate = async () => {
    setIsReactivatePending(true)
    try {
      const result = await reactivateBillingSubscription()
      setBilling((prev) =>
        prev
          ? {
              ...prev,
              billing_state: result.billing_state,
              actions: result.actions,
              subscription: result.subscription,
            }
          : prev,
      )
      toast.success("Se revirtió la cancelación. Tu suscripción sigue activa.")
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo reactivar la suscripción."))
    } finally {
      setIsReactivatePending(false)
    }
  }

  const handleChangePlan = async (planCode: string) => {
    setChangePlanCode(planCode)
    try {
      const result = await changeBillingPlan(planCode)
      // La cuota (`quota`) puede cambiar con un upgrade inmediato y la
      // respuesta de change-plan no la incluye — se vuelve a consultar el
      // estado completo en vez de fusionar parcialmente. El backend ya
      // sincronizó `subscription` de forma síncrona antes de responder,
      // así que esta consulta ya refleja el cambio, sin necesidad de
      // reintentos (a diferencia del Checkout, que depende del webhook).
      const subscriptionData = await fetchBillingSubscription()
      setBilling(subscriptionData)

      if (result.billing === "immediate_paid") {
        toast.success("Cambio de plan aplicado y pago confirmado.")
      } else if (result.billing === "immediate_payment_pending") {
        toast.warning(
          "El plan cambió, pero el pago de la diferencia todavía no se confirmó. Revisá el estado desde \"Gestionar facturación\".",
        )
      } else {
        toast.success(
          `Cambio de plan programado para el ${formatDateLabel(result.subscription.current_period_end)}. Tu plan actual sigue vigente hasta entonces.`,
        )
      }
    } catch (err) {
      // No se actualiza `billing` — un 409 (ej. orden ambiguo entre planes,
      // o estado incompatible) no debe simular un cambio que no ocurrió.
      toast.error(errorMessage(err, "No se pudo cambiar de plan."))
    } finally {
      setChangePlanCode(null)
    }
  }

  if (isLoading) {
    return <BillingLoadingSkeleton />
  }

  if (!billing) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Wallet className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          No se pudo cargar la información de facturación.
        </p>
        <Button variant="outline" onClick={() => void loadData()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const { subscription, quota, access_ok: accessOk, billing_state: billingState, actions } = billing

  const showPlansGrid = actions.can_checkout || actions.can_upgrade || actions.can_downgrade
  const gridMode: "subscribe" | "change-plan" =
    billingState === "active" || billingState === "active_canceling"
      ? "change-plan"
      : "subscribe"
  const changeBusy = changePlanCode !== null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Facturación</h1>
          <SubscriptionStatusBadge
            billingState={billingState}
            isTrial={subscription?.is_trial}
          />
        </div>
        <p className="text-muted-foreground">
          Estado del plan del local y gestión de la suscripción vía Stripe.
        </p>
      </div>

      {billingState === "unknown" ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>No pudimos verificar el estado de tu suscripción</AlertTitle>
          <AlertDescription>
            El backend devolvió un estado que todavía no reconocemos. Si
            necesitás suscribirte o gestionar el pago, probá las acciones
            disponibles abajo; si el problema persiste, contactá a soporte.
          </AlertDescription>
        </Alert>
      ) : null}

      {billingState === "past_due" ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Pago pendiente o fallido</AlertTitle>
          <AlertDescription>
            El asistente está pausado hasta regularizar el pago. Usá
            &quot;Gestionar facturación&quot; para actualizar el método de
            pago.
          </AlertDescription>
        </Alert>
      ) : !accessOk ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Tu plan no está activo</AlertTitle>
          <AlertDescription>
            El asistente está pausado. Suscribite o regularizá el pago para
            volver a operar.
          </AlertDescription>
        </Alert>
      ) : null}

      {billingState === "active_canceling" && subscription ? (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="text-amber-600" />
          <AlertTitle>Cancelación programada</AlertTitle>
          <AlertDescription>
            La suscripción se cancela al fin del período (
            {formatDateLabel(subscription.current_period_end)}). El acceso
            sigue activo hasta esa fecha.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {subscription?.plan_name ?? "Sin plan"}
          </CardTitle>
          <CardDescription>
            {subscription?.is_trial && subscription.trial_end
              ? `Prueba hasta ${formatDateLabel(subscription.trial_end)}`
              : subscription
                ? `Período: ${formatDateLabel(subscription.current_period_start)} – ${formatDateLabel(subscription.current_period_end)}`
                : "Todavía no hay una suscripción asociada a este local."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {actions.can_open_portal ? (
            <Button onClick={() => void handlePortal()} disabled={isPortalLoading}>
              {isPortalLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Abriendo…
                </>
              ) : (
                <>
                  <ExternalLink className="size-4" />
                  Gestionar facturación
                </>
              )}
            </Button>
          ) : null}

          {actions.can_reactivate ? (
            <Button
              variant="outline"
              onClick={() => void handleReactivate()}
              disabled={isReactivatePending}
            >
              {isReactivatePending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Reactivando…
                </>
              ) : (
                <>
                  <Undo2 className="size-4" />
                  Revertir cancelación
                </>
              )}
            </Button>
          ) : null}

          {actions.can_cancel ? (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelModalOpen(true)}
              disabled={isCancelPending}
            >
              <XCircle className="size-4" />
              Cancelar suscripción
            </Button>
          ) : null}

          {billingState === "none" ? (
            <p className="text-sm text-muted-foreground">
              {subscription?.is_trial
                ? "Estás en período de prueba. No hace falta pagar hasta que venza."
                : "Elegí un plan para continuar. El pago se completa en Stripe Checkout."}
            </p>
          ) : null}

          {billingState === "expired" ? (
            <p className="text-sm text-muted-foreground">
              Tu suscripción anterior ya terminó. Elegí un plan para
              continuar — se abre un Checkout nuevo.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <QuotaSection quota={quota} />

      {showPlansGrid ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Planes</h2>
            <p className="text-sm text-muted-foreground">
              {gridMode === "change-plan"
                ? "Cambiá de plan cuando quieras. El resultado (inmediato o programado para el fin del período) lo decide Stripe según el plan elegido."
                : subscription?.is_trial
                  ? "Tu plan actual es Trial (gratis). Elegí un plan pago cuando quieras continuar."
                  : "Suscripción mensual por local. Serás redirigido a Stripe para pagar."}
            </p>
          </div>
          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              No hay planes disponibles por el momento.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  isCurrent={isCurrentBillingPlan(plan, subscription)}
                  mode={gridMode}
                  isCheckoutPending={
                    gridMode === "change-plan"
                      ? changePlanCode === plan.code
                      : checkoutPlanCode === plan.code
                  }
                  checkoutBusy={
                    gridMode === "change-plan"
                      ? changeBusy
                      : checkoutPlanCode !== null
                  }
                  onSubscribe={handleSubscribe}
                  onChangePlan={(code) => void handleChangePlan(code)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      <CancelSubscriptionModal
        open={cancelModalOpen}
        pending={isCancelPending}
        periodEndLabel={formatDateLabel(subscription?.current_period_end)}
        onOpenChange={setCancelModalOpen}
        onConfirm={handleConfirmCancel}
      />
    </div>
  )
}
