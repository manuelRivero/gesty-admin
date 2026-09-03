import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle } from "lucide-react"

import { UsageProgress } from "@/components/super-admin/usage-progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  formatTokenCount,
  type BillingQuota,
} from "@/lib/requests/billing"

interface QuotaSectionProps {
  quota: BillingQuota
}

export function QuotaSection({ quota }: QuotaSectionProps) {
  const usedPercent =
    quota.tokens_limit > 0
      ? Math.round((quota.tokens_used / quota.tokens_limit) * 100)
      : 0
  const remainingPercent = Math.max(0, 100 - usedPercent)

  let resetLabel = "—"
  try {
    resetLabel = format(new Date(quota.reset_at), "d MMM yyyy, HH:mm", {
      locale: es,
    })
  } catch {
    resetLabel = quota.reset_at
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Uso de tokens</CardTitle>
        <CardDescription>
          Se reinicia el {resetLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {quota.ai_blocked ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>IA bloqueada</AlertTitle>
            <AlertDescription>
              El asistente no puede usar tokens hasta que se reactive el acceso.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {formatTokenCount(quota.tokens_used)} /{" "}
              {formatTokenCount(quota.tokens_limit)}
            </span>
            <span className="text-muted-foreground">
              {remainingPercent}% restante
            </span>
          </div>
          <UsageProgress value={usedPercent} />
        </div>
      </CardContent>
    </Card>
  )
}
