"use client"

import { Check, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  formatTokenCount,
  isTrialPlan,
  type BillingPlan,
} from "@/lib/requests/billing"
import { cn } from "@/lib/utils"

function featureLines(features: unknown): string[] {
  if (!features) return []
  if (Array.isArray(features)) {
    return features
      .map((item) => (typeof item === "string" ? item : null))
      .filter((item): item is string => Boolean(item))
  }
  if (typeof features === "object") {
    return Object.entries(features as Record<string, unknown>).map(
      ([key, value]) => {
        if (typeof value === "boolean") {
          return value ? key : `${key}: no`
        }
        return `${key}: ${String(value)}`
      },
    )
  }
  return []
}

function isFreePrice(price: string | null): boolean {
  if (price == null || price === "") return false
  const n = Number(price)
  return Number.isFinite(n) && n === 0
}

interface PlanCardProps {
  plan: BillingPlan
  isCurrent?: boolean
  isCheckoutPending?: boolean
  checkoutBusy?: boolean
  onSubscribe: (planCode: string) => void
}

export function PlanCard({
  plan,
  isCurrent = false,
  isCheckoutPending = false,
  checkoutBusy = false,
  onSubscribe,
}: PlanCardProps) {
  const lines = featureLines(plan.features)
  const trial = isTrialPlan(plan)
  const free = trial || isFreePrice(plan.monthly_price_usd)
  const price =
    !free && plan.monthly_price_usd != null && plan.monthly_price_usd !== ""
      ? `USD ${plan.monthly_price_usd}`
      : null

  return (
    <Card
      className={cn(
        "flex flex-col",
        isCurrent && "border-primary ring-1 ring-primary/30",
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          <div className="flex flex-wrap justify-end gap-1">
            {isCurrent ? (
              <Badge variant="secondary">Plan actual</Badge>
            ) : trial ? (
              <Badge
                variant="outline"
                className="border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200"
              >
                Gratis
              </Badge>
            ) : !plan.can_subscribe ? (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200"
              >
                {plan.has_stripe_price ? "No disponible" : "Configurando"}
              </Badge>
            ) : null}
          </div>
        </div>
        {free ? (
          <p className="text-2xl font-semibold tracking-tight">Gratis</p>
        ) : price ? (
          <p className="text-2xl font-semibold tracking-tight">
            {price}
            <span className="text-sm font-normal text-muted-foreground">
              /mes
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Precio no publicado</p>
        )}
        {plan.description ? (
          <CardDescription>{plan.description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="text-sm">
          <span className="font-medium">
            {formatTokenCount(plan.token_limit)}
          </span>{" "}
          <span className="text-muted-foreground">tokens / mes</span>
        </p>
        {lines.length > 0 ? (
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {lines.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>

      <CardFooter className="border-t bg-muted/20 pt-4">
        <Button
          className="w-full"
          disabled={
            isCurrent || trial || !plan.can_subscribe || checkoutBusy
          }
          onClick={() => onSubscribe(plan.code)}
        >
          {isCheckoutPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Redirigiendo…
            </>
          ) : isCurrent ? (
            "Plan actual"
          ) : trial ? (
            "Incluido en prueba"
          ) : (
            `Elegir ${plan.name}`
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
