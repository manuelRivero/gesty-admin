"use client"

import { Badge } from "@/components/ui/badge"
import type { BillingListBadge } from "./types"
import { cn } from "@/lib/utils"

const LABELS: Record<BillingListBadge, string> = {
  trial: "Trial",
  active: "Active",
  past_due: "Past due",
  no_access: "Sin acceso",
}

const STYLES: Record<BillingListBadge, string> = {
  trial:
    "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  active:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  past_due:
    "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  no_access:
    "border-destructive/40 bg-destructive/10 text-destructive",
}

interface BillingStatusBadgesProps {
  badges: BillingListBadge[]
}

export function BillingStatusBadges({ badges }: BillingStatusBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <Badge
          key={badge}
          variant="outline"
          className={cn("font-medium", STYLES[badge])}
        >
          {LABELS[badge]}
        </Badge>
      ))}
    </div>
  )
}
