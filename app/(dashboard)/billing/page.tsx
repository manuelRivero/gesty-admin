"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { isAxiosError } from "axios"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertCircle, ExternalLink, Loader2, Wallet } from "lucide-react"
import { toast } from "sonner"

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
  createBillingCheckout,
  createBillingPortal,
  fetchBillingPlans,
  fetchBillingSubscription,
  isCurrentBillingPlan,
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

function BillingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bootstrapped = useRef(false)

  const [billing, setBilling] = useState<BillingSubscriptionResponse | null>(
    null,
  )
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutPlanCode, setCheckoutPlanCode] = useState<string | null>(null)
  const [isPortalLoading, setIsPortalLoading] = useState(false)

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

  const { subscription, quota, access_ok: accessOk, cta } = billing

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Facturación</h1>
          <SubscriptionStatusBadge
            subscription={subscription}
            accessOk={accessOk}
          />
        </div>
        <p className="text-muted-foreground">
          Estado del plan del local y gestión de la suscripción vía Stripe.
        </p>
      </div>

      {!accessOk ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Tu plan no está activo</AlertTitle>
          <AlertDescription>
            El asistente está pausado. Suscribite o regularizá el pago para
            volver a operar.
          </AlertDescription>
        </Alert>
      ) : null}

      {subscription?.cancel_at_period_end ? (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="text-amber-600" />
          <AlertTitle>Cancelación programada</AlertTitle>
          <AlertDescription>
            La suscripción se cancela al fin del período (
            {formatDateLabel(subscription.current_period_end)}).
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
          {cta === "portal" ? (
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

          {cta === "checkout" && subscription?.is_trial ? (
            <p className="text-sm text-muted-foreground">
              Estás en prueba
              {subscription.trial_end
                ? ` hasta ${formatDateLabel(subscription.trial_end)}`
                : ""}
              . Podés suscribirte cuando quieras; el pago se completa en Stripe
              Checkout.
            </p>
          ) : null}

          {cta === "checkout" && !subscription?.is_trial ? (
            <p className="text-sm text-muted-foreground">
              Elegí un plan para continuar. El pago se completa en Stripe
              Checkout.
            </p>
          ) : null}

          {cta === "none" ? (
            <p className="text-sm text-muted-foreground">
              {subscription?.is_trial
                ? "Estás en período de prueba. No hace falta pagar hasta que venza."
                : "No hay acción de facturación pendiente."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <QuotaSection quota={quota} />

      {cta === "checkout" ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Planes</h2>
            <p className="text-sm text-muted-foreground">
              {subscription?.is_trial
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
                  isCheckoutPending={checkoutPlanCode === plan.code}
                  checkoutBusy={checkoutPlanCode !== null}
                  onSubscribe={handleSubscribe}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
