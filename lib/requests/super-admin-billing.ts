import { isAxiosError } from "axios"

import { api } from "@/lib/api"
import { SUPER_ADMIN_BUSINESSES_PATH } from "@/lib/requests/super-admin-businesses"

export interface SuperAdminBillingSubscription {
  status: string
  is_trial: boolean
  trial_end: string | null
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  plan_code: string | null
  plan_name: string
  stripe_customer_id: string | null
  has_stripe_subscription: boolean
}

export interface SuperAdminBillingQuota {
  tokens_used: number
  tokens_limit: number
  tokens_remaining: number
  ai_blocked: boolean
  has_quota: boolean
  reset_at: string
}

export interface SuperAdminBilling {
  business_id: string
  business_name: string
  access_ok: boolean
  has_subscription_row: boolean
  ai_plan: string
  ai_monthly_token_limit: number
  ai_monthly_tokens_used: number
  ai_blocked: boolean
  subscription: SuperAdminBillingSubscription | null
  quota: SuperAdminBillingQuota
}

export interface PatchSuperAdminBillingPayload {
  ai_plan?: string
  ai_monthly_token_limit?: number
  ai_blocked?: boolean
}

export interface GrantTrialPayload {
  days?: number
  token_limit?: number
}

export interface TrialDefaults {
  days: number
  token_limit: number
  plan_code: string
  max_days: number
}

const FALLBACK_TRIAL_DEFAULTS: TrialDefaults = {
  days: 7,
  token_limit: 10000,
  plan_code: "trial",
  max_days: 90,
}

export const SUPER_ADMIN_TRIAL_DEFAULTS_PATH =
  "/super-admin/billing/trial-defaults"

function billingPath(businessId: string, suffix = ""): string {
  return `${SUPER_ADMIN_BUSINESSES_PATH}/${encodeURIComponent(businessId)}/billing${suffix}`
}

export function superAdminBillingErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (!isAxiosError(err)) return fallback
  const data = err.response?.data as { message?: string; error?: string } | undefined
  return data?.message ?? data?.error ?? err.message ?? fallback
}

export async function fetchTrialDefaults(): Promise<TrialDefaults> {
  try {
    const { data } = await api.get<Partial<TrialDefaults>>(
      SUPER_ADMIN_TRIAL_DEFAULTS_PATH,
    )
    const days =
      typeof data.days === "number" && data.days > 0
        ? data.days
        : FALLBACK_TRIAL_DEFAULTS.days
    const tokenLimit =
      typeof data.token_limit === "number" && data.token_limit > 0
        ? data.token_limit
        : FALLBACK_TRIAL_DEFAULTS.token_limit
    const maxDays =
      typeof data.max_days === "number" && data.max_days > 0
        ? data.max_days
        : FALLBACK_TRIAL_DEFAULTS.max_days
    return {
      days,
      token_limit: tokenLimit,
      plan_code:
        typeof data.plan_code === "string" && data.plan_code
          ? data.plan_code
          : FALLBACK_TRIAL_DEFAULTS.plan_code,
      max_days: maxDays,
    }
  } catch {
    return FALLBACK_TRIAL_DEFAULTS
  }
}

export async function fetchSuperAdminBilling(
  businessId: string,
): Promise<SuperAdminBilling> {
  const { data } = await api.get<SuperAdminBilling>(billingPath(businessId))
  return data
}

export async function patchSuperAdminBilling(
  businessId: string,
  payload: PatchSuperAdminBillingPayload,
): Promise<SuperAdminBilling> {
  const { data } = await api.patch<SuperAdminBilling>(
    billingPath(businessId),
    payload,
  )
  return data
}

export async function grantSuperAdminTrial(
  businessId: string,
  payload: GrantTrialPayload = {},
): Promise<SuperAdminBilling> {
  const { data } = await api.post<SuperAdminBilling>(
    billingPath(businessId, "/grant-trial"),
    payload,
  )
  return data
}

export async function syncSuperAdminStripe(
  businessId: string,
): Promise<SuperAdminBilling> {
  const { data } = await api.post<SuperAdminBilling>(
    billingPath(businessId, "/sync-stripe"),
  )
  return data
}

export async function cancelSuperAdminBilling(
  businessId: string,
): Promise<SuperAdminBilling> {
  const { data } = await api.post<SuperAdminBilling>(
    billingPath(businessId, "/cancel"),
  )
  return data
}
