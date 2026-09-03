"use client"

import { TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { UsageProgress } from "./usage-progress"
import { BillingStatusBadges } from "./billing-status-badges"
import { BusinessActionsDropdown } from "./business-actions-dropdown"
import type { BusinessWithSubscription } from "./types"
import {
  formatIsoDate,
  formatTokens,
  getBillingListBadges,
  tokenUsagePercent,
} from "./types"

interface BusinessRowProps {
  business: BusinessWithSubscription
  onViewDetails: () => void
  onOverride: () => void
  onGrantTrial: () => void
  onSyncStripe: () => void
  onCancelBilling: () => void
  onToggleBlock: () => void
}

export function BusinessRow({
  business,
  onViewDetails,
  onOverride,
  onGrantTrial,
  onSyncStripe,
  onCancelBilling,
  onToggleBlock,
}: BusinessRowProps) {
  const usagePercent = tokenUsagePercent(
    business.ai_monthly_tokens_used,
    business.ai_monthly_token_limit,
  )
  const hasStripeSubscription =
    business.has_subscription_row && !business.is_trial

  return (
    <TableRow>
      <TableCell className="font-medium">{business.name}</TableCell>
      <TableCell>
        {business.access_ok ? (
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          >
            OK
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-destructive/40 bg-destructive/10 text-destructive"
          >
            No
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <BillingStatusBadges badges={getBillingListBadges(business)} />
      </TableCell>
      <TableCell>
        {business.is_trial ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">Trial</span>
            <span className="text-xs text-muted-foreground">
              {formatIsoDate(business.trial_end)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            {formatTokens(business.ai_monthly_tokens_used)} /{" "}
            {formatTokens(business.ai_monthly_token_limit)}
          </span>
          <div className="flex items-center gap-2">
            <UsageProgress value={usagePercent} className="w-20" />
            <span className="w-8 text-xs text-muted-foreground">
              {usagePercent}%
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {business.ai_blocked ? (
          <Badge
            variant="outline"
            className="border-destructive/40 bg-destructive/10 text-destructive"
          >
            Bloqueado
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">No</span>
        )}
      </TableCell>
      <TableCell>
        <BusinessActionsDropdown
          aiBlocked={business.ai_blocked}
          hasStripeSubscription={hasStripeSubscription}
          onViewDetails={onViewDetails}
          onOverride={onOverride}
          onGrantTrial={onGrantTrial}
          onSyncStripe={onSyncStripe}
          onCancelBilling={onCancelBilling}
          onToggleBlock={onToggleBlock}
        />
      </TableCell>
    </TableRow>
  )
}
