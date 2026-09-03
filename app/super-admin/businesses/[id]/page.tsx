"use client"

import { useState, useEffect, use, useCallback } from "react"
import { useRouter } from "next/navigation"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Cpu,
  Settings,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { UsageProgress } from "@/components/super-admin/usage-progress"
import { BillingStatusBadges } from "@/components/super-admin/billing-status-badges"
import { GrantTrialModal } from "@/components/super-admin/grant-trial-modal"
import { BillingOverrideModal } from "@/components/super-admin/billing-override-modal"
import { BlockModal } from "@/components/super-admin/block-modal"
import { CancelBillingModal } from "@/components/super-admin/cancel-billing-modal"
import {
  formatIsoDate,
  formatTokens,
  getBillingListBadges,
  tokenUsagePercent,
  type BillingListBadge,
} from "@/components/super-admin/types"
import {
  cancelSuperAdminBilling,
  fetchSuperAdminBilling,
  grantSuperAdminTrial,
  patchSuperAdminBilling,
  superAdminBillingErrorMessage,
  syncSuperAdminStripe,
  type GrantTrialPayload,
  type PatchSuperAdminBillingPayload,
  type SuperAdminBilling,
} from "@/lib/requests/super-admin-billing"

function etiquetaEstado(status: string): string {
  const s = status.toLowerCase()
  if (s === "active") return "active"
  if (s === "trialing") return "trialing"
  if (s === "canceled" || s === "cancelled") return "canceled"
  if (s === "past_due") return "past_due"
  return status
}

function truncateId(id: string | null): string {
  if (!id) return "—"
  if (id.length <= 16) return id
  return `${id.slice(0, 10)}…${id.slice(-4)}`
}

function badgesFromBilling(billing: SuperAdminBilling): BillingListBadge[] {
  return getBillingListBadges({
    id: billing.business_id,
    name: billing.business_name,
    ai_blocked: billing.ai_blocked,
    ai_monthly_tokens_used: billing.ai_monthly_tokens_used,
    ai_monthly_token_limit: billing.ai_monthly_token_limit,
    created_at: "",
    has_subscription_row: billing.has_subscription_row,
    access_ok: billing.access_ok,
    is_trial: billing.subscription?.is_trial ?? false,
    trial_end: billing.subscription?.trial_end ?? null,
    subscription: {
      plan_name: billing.subscription?.plan_name ?? "Trial",
      current_period_start: billing.subscription?.current_period_start ?? "",
      current_period_end: billing.subscription?.current_period_end ?? "",
      status: (billing.subscription?.status ?? "canceled") as
        | "active"
        | "past_due"
        | "canceled",
    },
  })
}

interface BusinessDetailPageProps {
  params: Promise<{ id: string }>
}

export default function BusinessDetailPage({ params }: BusinessDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [billing, setBilling] = useState<SuperAdminBilling | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound" | "error">(
    "loading",
  )
  const [pending, setPending] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [grantTrialOpen, setGrantTrialOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const loadBilling = useCallback(async () => {
    setLoadState("loading")
    setBilling(null)
    try {
      const data = await fetchSuperAdminBilling(id)
      setBilling(data)
      setLoadState("ready")
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 404) {
        setLoadState("notfound")
        return
      }
      toast.error(superAdminBillingErrorMessage(e, "No se pudo cargar el billing."))
      setLoadState("error")
    }
  }, [id])

  useEffect(() => {
    void loadBilling()
  }, [loadBilling])

  const applyBilling = (data: SuperAdminBilling) => {
    setBilling(data)
    setLoadState("ready")
  }

  const runMutation = async (
    action: () => Promise<SuperAdminBilling>,
    successMessage: string,
  ) => {
    setPending(true)
    try {
      const data = await action()
      applyBilling(data)
      toast.success(successMessage)
      setGrantTrialOpen(false)
      setOverrideOpen(false)
      setBlockOpen(false)
      setCancelOpen(false)
    } catch (err) {
      toast.error(superAdminBillingErrorMessage(err, "No se pudo completar la acción."))
    } finally {
      setPending(false)
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-32" />
      </div>
    )
  }

  if (loadState === "notfound" || (loadState === "error" && !billing)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <h2 className="text-lg font-medium">
          {loadState === "notfound" ? "Negocio no encontrado" : "No se pudo cargar"}
        </h2>
        <p className="text-muted-foreground">
          {loadState === "notfound"
            ? "No existe un negocio con ese identificador."
            : "Reintentá o volvé al listado."}
        </p>
        <Button
          variant="outline"
          onClick={() => router.push("/super-admin/businesses")}
        >
          <ArrowLeft className="size-4" />
          Volver a negocios
        </Button>
      </div>
    )
  }

  if (!billing) return null

  const sub = billing.subscription
  const quota = billing.quota
  const usagePercent = tokenUsagePercent(quota.tokens_used, quota.tokens_limit)
  const hasStripe = Boolean(sub?.has_stripe_subscription)
  const badges = badgesFromBilling(billing)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/super-admin/businesses")}
        >
          <ArrowLeft className="size-4" />
          <span className="sr-only">Volver a negocios</span>
        </Button>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {billing.business_name}
            </h1>
            <BillingStatusBadges badges={badges} />
            {billing.ai_blocked ? (
              <Badge
                variant="outline"
                className="border-destructive/40 bg-destructive/10 text-destructive"
              >
                IA bloqueada
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">ID: {billing.business_id}</p>
        </div>
      </div>

      {!billing.access_ok ? (
        <Alert variant="destructive">
          <AlertTitle>Sin acceso</AlertTitle>
          <AlertDescription>
            El bot no puede operar en este local. Otorgá un trial o regularizá la
            suscripción.
          </AlertDescription>
        </Alert>
      ) : null}

      {sub?.cancel_at_period_end ? (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertTitle>Cancelación programada</AlertTitle>
          <AlertDescription>
            Se cancela al fin del período ({formatIsoDate(sub.current_period_end)}).
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Building2 className="size-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Negocio</CardTitle>
              <CardDescription>Identidad y plan interno</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between gap-3">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <span className="text-sm font-medium">{billing.business_name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-sm text-muted-foreground">ai_plan</span>
              <span className="font-mono text-sm">{billing.ai_plan}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-sm text-muted-foreground">Fila sub</span>
              <span className="text-sm">
                {billing.has_subscription_row ? "Sí" : "No"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <CreditCard className="size-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Suscripción</CardTitle>
              <CardDescription>Snapshot billing</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sub ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="text-sm font-medium">{sub.plan_name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sm text-muted-foreground">plan_code</span>
                  <span className="font-mono text-sm">{sub.plan_code ?? "null"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm">{etiquetaEstado(sub.status)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Trial hasta</span>
                  <span className="text-sm">{formatIsoDate(sub.trial_end)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Período</span>
                  <span className="text-right text-sm">
                    {formatIsoDate(sub.current_period_start)} –{" "}
                    {formatIsoDate(sub.current_period_end)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Customer</span>
                  <span className="font-mono text-xs">
                    {truncateId(sub.stripe_customer_id)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Stripe sub</span>
                  <span className="text-sm">
                    {sub.has_stripe_subscription ? "Sí" : "No"}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin fila de suscripción.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Cpu className="size-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Cuota de IA</CardTitle>
              <CardDescription>
                Reset {formatIsoDate(quota.reset_at)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {quota.ai_blocked ? (
              <p className="text-sm text-destructive">IA bloqueada</p>
            ) : null}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tokens</span>
              <span className="text-sm font-medium">
                {formatTokens(quota.tokens_used)} / {formatTokens(quota.tokens_limit)}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uso</span>
                <span className="font-medium">{usagePercent}%</span>
              </div>
              <UsageProgress value={usagePercent} />
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Restantes</span>
              <span className="text-sm">
                {formatTokens(quota.tokens_remaining)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Settings className="size-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">Acciones</CardTitle>
            <CardDescription>
              Trial, override de cupo y Stripe. No hay modo custom/exento.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setGrantTrialOpen(true)}>
              Otorgar trial
            </Button>
            <Button variant="outline" onClick={() => setOverrideOpen(true)}>
              Override cupo
            </Button>
            <Button
              variant="outline"
              disabled={!hasStripe || syncing}
              onClick={() => {
                void (async () => {
                  setSyncing(true)
                  try {
                    const data = await syncSuperAdminStripe(id)
                    applyBilling(data)
                    toast.success("Stripe sincronizado")
                  } catch (err) {
                    toast.error(
                      superAdminBillingErrorMessage(
                        err,
                        "No se pudo sincronizar Stripe.",
                      ),
                    )
                  } finally {
                    setSyncing(false)
                  }
                })()
              }}
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sync Stripe
            </Button>
            <Button
              variant="outline"
              disabled={!hasStripe}
              onClick={() => setCancelOpen(true)}
            >
              Cancelar al fin del período
            </Button>
            <Button
              variant={billing.ai_blocked ? "default" : "outline"}
              onClick={() => setBlockOpen(true)}
            >
              {billing.ai_blocked ? "Desbloquear IA" : "Bloquear IA"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <GrantTrialModal
        businessName={billing.business_name}
        open={grantTrialOpen}
        pending={pending}
        onOpenChange={setGrantTrialOpen}
        onConfirm={(payload: GrantTrialPayload) =>
          runMutation(
            () => grantSuperAdminTrial(id, payload),
            "Trial otorgado",
          )
        }
      />
      <BillingOverrideModal
        businessName={billing.business_name}
        open={overrideOpen}
        pending={pending}
        initialPlan={billing.ai_plan}
        initialTokenLimit={billing.ai_monthly_token_limit}
        initialBlocked={billing.ai_blocked}
        onOpenChange={setOverrideOpen}
        onConfirm={(payload: PatchSuperAdminBillingPayload) =>
          runMutation(
            () => patchSuperAdminBilling(id, payload),
            "Override guardado",
          )
        }
      />
      <BlockModal
        businessName={billing.business_name}
        isBlocked={billing.ai_blocked}
        open={blockOpen}
        pending={pending}
        onOpenChange={setBlockOpen}
        onConfirm={() =>
          runMutation(
            () =>
              patchSuperAdminBilling(id, { ai_blocked: !billing.ai_blocked }),
            billing.ai_blocked ? "IA desbloqueada" : "IA bloqueada",
          )
        }
      />
      <CancelBillingModal
        businessName={billing.business_name}
        open={cancelOpen}
        pending={pending}
        onOpenChange={setCancelOpen}
        onConfirm={() =>
          runMutation(
            () => cancelSuperAdminBilling(id),
            "Cancelación programada",
          )
        }
      />
    </div>
  )
}
