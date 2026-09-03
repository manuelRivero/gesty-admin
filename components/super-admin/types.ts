export interface Business {
  id: string
  name: string
  ai_blocked: boolean
  ai_monthly_tokens_used: number
  ai_monthly_token_limit: number
  created_at: string
}

export type ListPlanName = "Basic" | "Pro" | "Business" | "Trial" | (string & {})

export type ListSubscriptionStatus = "active" | "past_due" | "canceled" | (string & {})

export interface Subscription {
  plan_name: ListPlanName
  current_period_start: string
  current_period_end: string
  status: ListSubscriptionStatus
}

export interface BusinessWithSubscription extends Business {
  has_subscription_row: boolean
  access_ok: boolean
  is_trial: boolean
  trial_end: string | null
  subscription: Subscription
}

export type BillingListBadge = "trial" | "active" | "past_due" | "no_access"

/** @deprecated Usar BillingListBadge */
export type BusinessStatus = "Active" | "Blocked" | "Expired"

export function getBillingListBadges(
  business: BusinessWithSubscription,
): BillingListBadge[] {
  const badges: BillingListBadge[] = []
  if (business.is_trial) badges.push("trial")
  if (business.subscription.status.toLowerCase() === "past_due") {
    badges.push("past_due")
  }
  if (!business.access_ok) badges.push("no_access")
  if (badges.length === 0) badges.push("active")
  return badges
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}k`
  }
  return tokens.toString()
}

export function tokenUsagePercent(used: number, limit: number): number {
  if (!limit || limit <= 0) return 0
  return Math.round((used / limit) * 100)
}

export function isTrialExpiringSoon(
  trialEnd: string | null,
  withinDays = 7,
): boolean {
  if (!trialEnd) return false
  const end = new Date(trialEnd).getTime()
  if (!Number.isFinite(end)) return false
  const now = Date.now()
  const max = now + withinDays * 24 * 60 * 60 * 1000
  return end >= now && end <= max
}

export type BusinessListFilter =
  | "all"
  | "no_sub"
  | "trial_expiring"
  | "past_due"
  | "blocked"

export function matchesBusinessListFilter(
  business: BusinessWithSubscription,
  filter: BusinessListFilter,
): boolean {
  if (filter === "all") return true
  if (filter === "no_sub") return !business.has_subscription_row
  if (filter === "trial_expiring") {
    return business.is_trial && isTrialExpiringSoon(business.trial_end)
  }
  if (filter === "past_due") {
    return business.subscription.status.toLowerCase() === "past_due"
  }
  if (filter === "blocked") return business.ai_blocked
  return true
}

export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
