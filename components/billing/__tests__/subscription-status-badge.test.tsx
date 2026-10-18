import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { SubscriptionStatusBadge } from "../subscription-status-badge"
import type { BillingLifecycleState } from "@/lib/requests/billing"

const ALL_STATES: BillingLifecycleState[] = [
  "none",
  "active",
  "active_canceling",
  "past_due",
  "expired",
  "unknown",
]

const EXPECTED_LABEL: Record<BillingLifecycleState, string> = {
  none: "Sin plan",
  active: "Activo",
  active_canceling: "Cancelación programada",
  past_due: "Pago pendiente",
  expired: "Vencido",
  unknown: "Estado sin verificar",
}

describe("SubscriptionStatusBadge", () => {
  it.each(ALL_STATES)(
    'representa explícitamente el estado "%s" con su propia etiqueta',
    (state) => {
      render(<SubscriptionStatusBadge billingState={state} />)
      expect(screen.getByText(EXPECTED_LABEL[state])).toBeInTheDocument()
    },
  )

  it('"active" con is_trial=true muestra "Prueba", no "Activo" (ajuste ortogonal, no reclasifica el estado)', () => {
    render(<SubscriptionStatusBadge billingState="active" isTrial />)
    expect(screen.getByText("Prueba")).toBeInTheDocument()
    expect(screen.queryByText("Activo")).not.toBeInTheDocument()
  })

  it('"unknown" nunca se estiliza igual que "active" — no debe leerse como "todo bien"', () => {
    render(<SubscriptionStatusBadge billingState="unknown" />)
    const badge = screen.getByText(EXPECTED_LABEL.unknown)
    expect(badge.className).not.toContain("emerald")
  })

  it('"past_due" y "unknown" no se representan como activos', () => {
    const { unmount } = render(<SubscriptionStatusBadge billingState="past_due" />)
    expect(screen.queryByText("Activo")).not.toBeInTheDocument()
    unmount()

    render(<SubscriptionStatusBadge billingState="unknown" />)
    expect(screen.queryByText("Activo")).not.toBeInTheDocument()
  })
})
