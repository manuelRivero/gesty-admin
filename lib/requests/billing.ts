import { api } from "@/lib/api"

export const ADMIN_BILLING_SUBSCRIPTION_PATH = "/admin/billing/subscription"
export const ADMIN_BILLING_PLANS_PATH = "/admin/billing/plans"
export const ADMIN_BILLING_CHECKOUT_PATH = "/admin/billing/checkout"
export const ADMIN_BILLING_PORTAL_PATH = "/admin/billing/portal"
export const ADMIN_BILLING_CANCEL_PATH = "/admin/billing/subscription/cancel"
export const ADMIN_BILLING_REACTIVATE_PATH =
  "/admin/billing/subscription/reactivate"
export const ADMIN_BILLING_CHANGE_PLAN_PATH =
  "/admin/billing/subscription/change-plan"
export const ADMIN_AI_QUOTA_PATH = "/admin/ai-quota"

export type BillingCta = "checkout" | "portal" | "none"

/**
 * Estado de ciclo de vida calculado por el backend
 * (`gesty-backend/src/services/billing/subscriptionLifecycle.service.ts`).
 * Única fuente de verdad para decidir qué mostrar — el frontend no vuelve
 * a clasificar `status`/`cancel_at_period_end` por su cuenta.
 */
export type BillingLifecycleState =
  | "none"
  | "active"
  | "active_canceling"
  | "past_due"
  | "expired"
  | "unknown"

/**
 * Qué puede hacer el admin AHORA, según el backend. Son una guía para la
 * UI — el backend sigue siendo quien valida cada operación al ejecutarla
 * (un botón habilitado puede igual recibir un 409 si el estado cambió
 * entre que se calcularon estos flags y que el usuario hizo click).
 *
 * `can_upgrade`/`can_downgrade` son flags GENERALES del estado de la
 * suscripción, no una clasificación por `plan_code`: no identifican qué
 * tarjeta de plan en particular es un upgrade o un downgrade. Ver
 * `components/billing/plan-card.tsx`.
 */
export interface BillingActionsDto {
  can_checkout: boolean
  /** @deprecated usar `can_upgrade`/`can_downgrade`. */
  can_change_plan: boolean
  can_cancel: boolean
  can_reactivate: boolean
  can_open_portal: boolean
  can_upgrade: boolean
  can_downgrade: boolean
}

/** Resultado de `changeBillingPlan`: nunca inferir "pagado" solo de un 200. */
export type BillingChangePlanOutcome =
  | "immediate_paid"
  | "immediate_payment_pending"
  | "scheduled"

export type PlanCode =
  | "trial"
  | "basic"
  | "pro"
  | "business"
  | "enterprise"
  | (string & {})

export interface BillingSubscription {
  status: string
  is_trial: boolean
  trial_end: string | null
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  plan_code: PlanCode | null
  plan_name: string
  stripe_customer_id: string | null
  has_stripe_subscription: boolean
}

export interface BillingQuota {
  tokens_used: number
  tokens_limit: number
  tokens_remaining: number
  ai_blocked: boolean
  has_quota: boolean
  reset_at: string
}

export interface BillingSubscriptionResponse {
  requires_subscription: true
  access_ok: boolean
  /** @deprecated usar `billing_state` + `actions`. Se conserva por compatibilidad. */
  cta: BillingCta
  billing_state: BillingLifecycleState
  actions: BillingActionsDto
  subscription: BillingSubscription | null
  quota: BillingQuota
}

/** Respuesta compartida de `cancel`/`reactivate`: estado + acciones + snapshot ya actualizado. */
export interface BillingSubscriptionActionResponse {
  billing_state: BillingLifecycleState
  actions: BillingActionsDto
  subscription: BillingSubscription
}

export interface BillingChangePlanResponse {
  billing_state: BillingLifecycleState
  actions: BillingActionsDto
  subscription: BillingSubscription
  billing: BillingChangePlanOutcome
}

export interface BillingPlan {
  code: PlanCode
  name: string
  monthly_price_usd: string | null
  token_limit: number
  description: string | null
  features: unknown
  has_stripe_price: boolean
  can_subscribe: boolean
}

export interface BillingPlansResponse {
  requires_subscription: true
  plans: BillingPlan[]
}

export interface BillingCheckoutResponse {
  url: string
}

export interface BillingPortalResponse {
  url: string
}

export interface AiQuotaResponse {
  tokens_used: number
  tokens_limit: number
  tokens_remaining: number
  ai_blocked: boolean
  has_quota: boolean
  reset_at: string
  requires_subscription: true
  access_ok: boolean
  subscription: {
    status: string
    is_trial: boolean
    current_period_start: string
    current_period_end: string
    plan_name: string
  } | null
}

/** Normaliza codes: backend usa `enterprise` para el plan Business. */
export function planCodesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false
  const norm = (code: string) => {
    const c = code.toLowerCase()
    if (c === "enterprise" || c === "business") return "business"
    return c
  }
  return norm(a) === norm(b)
}

/** Plan Trial del catálogo (gratis, sin Stripe price). */
export function isTrialPlan(plan: Pick<BillingPlan, "code" | "name">): boolean {
  return (
    plan.code.toLowerCase() === "trial" ||
    plan.name.trim().toLowerCase() === "trial"
  )
}

/**
 * Plan actual: match por plan_code, o Trial del catálogo cuando
 * la sub está en trial sin plan_code de pago.
 */
export function isCurrentBillingPlan(
  plan: BillingPlan,
  subscription: BillingSubscription | null,
): boolean {
  if (!subscription) return false
  if (planCodesMatch(subscription.plan_code, plan.code)) return true
  if (
    subscription.is_trial &&
    !subscription.plan_code &&
    isTrialPlan(plan)
  ) {
    return true
  }
  return false
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}k`
  return String(tokens)
}

export async function fetchBillingSubscription(): Promise<BillingSubscriptionResponse> {
  const { data } = await api.get<BillingSubscriptionResponse>(
    ADMIN_BILLING_SUBSCRIPTION_PATH,
  )
  return data
}

export async function fetchBillingPlans(): Promise<BillingPlansResponse> {
  const { data } = await api.get<BillingPlansResponse>(ADMIN_BILLING_PLANS_PATH)
  return data
}

export async function createBillingCheckout(
  planCode: string,
): Promise<BillingCheckoutResponse> {
  const { data } = await api.post<BillingCheckoutResponse>(
    ADMIN_BILLING_CHECKOUT_PATH,
    { plan_code: planCode },
  )
  return data
}

export async function createBillingPortal(): Promise<BillingPortalResponse> {
  const { data } = await api.post<BillingPortalResponse>(
    ADMIN_BILLING_PORTAL_PATH,
  )
  return data
}

/** Programa la cancelación al fin del período vigente (no inmediata). */
export async function cancelBillingSubscription(): Promise<BillingSubscriptionActionResponse> {
  const { data } = await api.post<BillingSubscriptionActionResponse>(
    ADMIN_BILLING_CANCEL_PATH,
  )
  return data
}

/** Revierte una cancelación programada mientras la suscripción siga vigente. */
export async function reactivateBillingSubscription(): Promise<BillingSubscriptionActionResponse> {
  const { data } = await api.post<BillingSubscriptionActionResponse>(
    ADMIN_BILLING_REACTIVATE_PATH,
  )
  return data
}

/**
 * Cambia de plan sobre la suscripción existente (nunca crea un Checkout
 * nuevo). El backend decide si es upgrade (inmediato) o downgrade
 * (programado) y devuelve `billing` para que la UI informe el resultado
 * real — un 200 por sí solo no confirma que se haya cobrado nada.
 */
export async function changeBillingPlan(
  planCode: string,
): Promise<BillingChangePlanResponse> {
  const { data } = await api.post<BillingChangePlanResponse>(
    ADMIN_BILLING_CHANGE_PLAN_PATH,
    { plan_code: planCode },
  )
  return data
}

export async function fetchAiQuota(): Promise<AiQuotaResponse> {
  const { data } = await api.get<AiQuotaResponse>(ADMIN_AI_QUOTA_PATH)
  return data
}
