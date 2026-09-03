import type { BusinessWithSubscription } from "./types"

function item(
  partial: Omit<
    BusinessWithSubscription,
    "has_subscription_row" | "access_ok" | "is_trial" | "trial_end"
  > &
    Partial<
      Pick<
        BusinessWithSubscription,
        "has_subscription_row" | "access_ok" | "is_trial" | "trial_end"
      >
    >,
): BusinessWithSubscription {
  const status = partial.subscription.status.toLowerCase()
  const isTrial = partial.is_trial ?? partial.subscription.plan_name === "Trial"
  return {
    has_subscription_row: partial.has_subscription_row ?? true,
    access_ok: partial.access_ok ?? (!partial.ai_blocked && status !== "canceled"),
    is_trial: isTrial,
    trial_end: partial.trial_end ?? null,
    ...partial,
  }
}

export const mockBusinesses: BusinessWithSubscription[] = [
  item({
    id: "bus_001",
    name: "Acme Restaurant",
    ai_blocked: false,
    ai_monthly_tokens_used: 45000,
    ai_monthly_token_limit: 100000,
    created_at: "2024-01-15T10:30:00Z",
    subscription: {
      plan_name: "Pro",
      current_period_start: "2026-03-01T00:00:00Z",
      current_period_end: "2026-04-01T00:00:00Z",
      status: "active",
    },
  }),
  item({
    id: "bus_002",
    name: "Golden Dragon Bistro",
    ai_blocked: true,
    ai_monthly_tokens_used: 85000,
    ai_monthly_token_limit: 100000,
    created_at: "2024-02-20T14:15:00Z",
    access_ok: false,
    subscription: {
      plan_name: "Pro",
      current_period_start: "2026-03-01T00:00:00Z",
      current_period_end: "2026-04-01T00:00:00Z",
      status: "active",
    },
  }),
  item({
    id: "bus_003",
    name: "Sunset Cafe",
    ai_blocked: false,
    ai_monthly_tokens_used: 12000,
    ai_monthly_token_limit: 50000,
    created_at: "2024-03-10T09:00:00Z",
    access_ok: false,
    subscription: {
      plan_name: "Basic",
      current_period_start: "2026-01-15T00:00:00Z",
      current_period_end: "2026-02-15T00:00:00Z",
      status: "past_due",
    },
  }),
]
