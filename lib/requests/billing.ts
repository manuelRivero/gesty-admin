import { api } from "@/lib/api"

export const ADMIN_BILLING_SUBSCRIPTION_PATH = "/admin/billing/subscription"
export const ADMIN_BILLING_PLANS_PATH = "/admin/billing/plans"
export const ADMIN_BILLING_CHECKOUT_PATH = "/admin/billing/checkout"
export const ADMIN_BILLING_PORTAL_PATH = "/admin/billing/portal"
export const ADMIN_AI_QUOTA_PATH = "/admin/ai-quota"

export type BillingCta = "checkout" | "portal" | "none"

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
  cta: BillingCta
  subscription: BillingSubscription | null
  quota: BillingQuota
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

export async function fetchAiQuota(): Promise<AiQuotaResponse> {
  const { data } = await api.get<AiQuotaResponse>(ADMIN_AI_QUOTA_PATH)
  return data
}
