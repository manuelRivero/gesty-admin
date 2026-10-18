import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import { fireEvent } from "@testing-library/react"
import type { Mock } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock("@/lib/requests/billing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/requests/billing")>(
    "@/lib/requests/billing",
  )
  return {
    ...actual,
    fetchBillingSubscription: vi.fn(),
    fetchBillingPlans: vi.fn(),
    createBillingCheckout: vi.fn(),
    createBillingPortal: vi.fn(),
    cancelBillingSubscription: vi.fn(),
    reactivateBillingSubscription: vi.fn(),
    changeBillingPlan: vi.fn(),
  }
})

import { toast } from "sonner"
import * as billingApi from "@/lib/requests/billing"
import type {
  BillingActionsDto,
  BillingLifecycleState,
  BillingPlan,
  BillingSubscription,
  BillingSubscriptionResponse,
} from "@/lib/requests/billing"
import { BillingPageContent } from "../page"

const mockedFetchSubscription = billingApi.fetchBillingSubscription as Mock
const mockedFetchPlans = billingApi.fetchBillingPlans as Mock
const mockedCheckout = billingApi.createBillingCheckout as Mock
const mockedPortal = billingApi.createBillingPortal as Mock
const mockedCancel = billingApi.cancelBillingSubscription as Mock
const mockedReactivate = billingApi.reactivateBillingSubscription as Mock
const mockedChangePlan = billingApi.changeBillingPlan as Mock

const QUOTA = {
  tokens_used: 100,
  tokens_limit: 1000,
  tokens_remaining: 900,
  ai_blocked: false,
  has_quota: true,
  reset_at: "2026-11-01T00:00:00.000Z",
}

const PLAN_BASIC: BillingPlan = {
  code: "basic",
  name: "Basic",
  monthly_price_usd: "45.00",
  token_limit: 2500,
  description: null,
  features: {},
  has_stripe_price: true,
  can_subscribe: true,
}

const PLAN_PRO: BillingPlan = {
  code: "pro",
  name: "Pro",
  monthly_price_usd: "95.00",
  token_limit: 7000,
  description: null,
  features: {},
  has_stripe_price: true,
  can_subscribe: true,
}

function subscriptionFixture(
  overrides: Partial<BillingSubscription> = {},
): BillingSubscription {
  return {
    status: "active",
    is_trial: false,
    trial_end: null,
    current_period_start: "2026-10-01T00:00:00.000Z",
    current_period_end: "2026-11-01T00:00:00.000Z",
    cancel_at_period_end: false,
    plan_code: "basic",
    plan_name: "Basic",
    stripe_customer_id: "cus_1",
    has_stripe_subscription: true,
    ...overrides,
  }
}

const ACTIONS_BY_STATE: Record<BillingLifecycleState, BillingActionsDto> = {
  none: {
    can_checkout: true,
    can_change_plan: false,
    can_cancel: false,
    can_reactivate: false,
    can_open_portal: false,
    can_upgrade: false,
    can_downgrade: false,
  },
  active: {
    can_checkout: false,
    can_change_plan: true,
    can_cancel: true,
    can_reactivate: false,
    can_open_portal: true,
    can_upgrade: true,
    can_downgrade: true,
  },
  active_canceling: {
    can_checkout: false,
    can_change_plan: true,
    can_cancel: false,
    can_reactivate: true,
    can_open_portal: true,
    can_upgrade: true,
    can_downgrade: false,
  },
  past_due: {
    can_checkout: false,
    can_change_plan: false,
    can_cancel: false,
    can_reactivate: false,
    can_open_portal: true,
    can_upgrade: false,
    can_downgrade: false,
  },
  expired: {
    can_checkout: true,
    can_change_plan: false,
    can_cancel: false,
    can_reactivate: false,
    can_open_portal: false,
    can_upgrade: false,
    can_downgrade: false,
  },
  unknown: {
    can_checkout: true,
    can_change_plan: false,
    can_cancel: false,
    can_reactivate: false,
    can_open_portal: false,
    can_upgrade: false,
    can_downgrade: false,
  },
}

function billingFixture(
  state: BillingLifecycleState,
  opts: {
    actions?: Partial<BillingActionsDto>
    subscription?: Partial<BillingSubscription> | null
  } = {},
): BillingSubscriptionResponse {
  const subscription =
    state === "none" && opts.subscription === undefined
      ? null
      : opts.subscription === null
        ? null
        : subscriptionFixture(opts.subscription ?? {})

  return {
    requires_subscription: true,
    access_ok: state === "active" || state === "active_canceling",
    cta:
      state === "past_due" || state === "active" || state === "active_canceling"
        ? "portal"
        : "checkout",
    billing_state: state,
    actions: { ...ACTIONS_BY_STATE[state], ...opts.actions },
    subscription,
    quota: QUOTA,
  }
}

function mockInitialLoad(billing: BillingSubscriptionResponse) {
  mockedFetchSubscription.mockResolvedValue(billing)
  mockedFetchPlans.mockResolvedValue({ plans: [PLAN_BASIC, PLAN_PRO] })
}

async function renderPage() {
  render(<BillingPageContent />)
  await screen.findByRole("heading", { name: "Facturación" })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("BillingPageContent — grilla de planes por estado", () => {
  it('"active": muestra la grilla de planes (bug original: quedaba oculta detrás de cta==="portal")', async () => {
    mockInitialLoad(billingFixture("active"))
    await renderPage()

    expect(await screen.findByRole("heading", { name: "Planes" })).toBeInTheDocument()
  })

  it('"active_canceling": también muestra la grilla (puede seguir cambiando de plan)', async () => {
    mockInitialLoad(billingFixture("active_canceling"))
    await renderPage()

    expect(await screen.findByRole("heading", { name: "Planes" })).toBeInTheDocument()
  })

  it('"past_due": NO muestra la grilla ni ofrece cambios de plan que el backend no autoriza', async () => {
    mockInitialLoad(billingFixture("past_due"))
    await renderPage()

    expect(screen.queryByRole("heading", { name: "Planes" })).not.toBeInTheDocument()
  })

  it('"none": muestra la grilla en modo Checkout', async () => {
    mockInitialLoad(billingFixture("none"))
    await renderPage()

    expect(await screen.findByRole("button", { name: /Elegir Basic/i })).toBeInTheDocument()
  })
})

describe("BillingPageContent — Checkout vs. cambio de plan", () => {
  it("sin suscripción (none): usar un plan dispara Checkout, nunca change-plan", async () => {
    mockInitialLoad(billingFixture("none"))
    mockedCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/x" })
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    await renderPage()

    const button = await screen.findByRole("button", { name: /Elegir Pro/i })
    fireEvent.click(button)

    await waitFor(() => expect(mockedCheckout).toHaveBeenCalledWith("pro"))
    expect(mockedChangePlan).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it("con suscripción activa: usar un plan dispara change-plan, nunca Checkout", async () => {
    mockInitialLoad(billingFixture("active"))
    mockedChangePlan.mockResolvedValue({
      billing_state: "active",
      actions: ACTIONS_BY_STATE.active,
      subscription: subscriptionFixture({ plan_code: "pro", plan_name: "Pro" }),
      billing: "immediate_paid",
    })
    await renderPage()

    const button = await screen.findByRole("button", { name: /Cambiar a Pro/i })
    fireEvent.click(button)

    await waitFor(() => expect(mockedChangePlan).toHaveBeenCalledWith("pro"))
    expect(mockedCheckout).not.toHaveBeenCalled()
  })

  it('el plan actual se muestra como "Plan actual", deshabilitado, no como Checkout ni change-plan', async () => {
    mockInitialLoad(billingFixture("active"))
    await renderPage()

    const currentButton = await screen.findByRole("button", { name: "Plan actual" })
    expect(currentButton).toBeDisabled()
  })
})

describe("BillingPageContent — cancelación y reactivación por flags", () => {
  it('"active" (can_cancel=true, can_reactivate=false): muestra Cancelar, no Revertir', async () => {
    mockInitialLoad(billingFixture("active"))
    await renderPage()

    expect(await screen.findByRole("button", { name: /Cancelar suscripción/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Revertir cancelación/i })).not.toBeInTheDocument()
  })

  it('"active_canceling" (can_reactivate=true, can_cancel=false): muestra Revertir, no Cancelar', async () => {
    mockInitialLoad(billingFixture("active_canceling"))
    await renderPage()

    expect(await screen.findByRole("button", { name: /Revertir cancelación/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Cancelar suscripción/i })).not.toBeInTheDocument()
  })

  it('"none": no muestra ni Cancelar ni Revertir (ninguno de los dos flags está disponible)', async () => {
    mockInitialLoad(billingFixture("none"))
    await renderPage()

    await screen.findByRole("heading", { name: "Planes" })
    expect(screen.queryByRole("button", { name: /Cancelar suscripción/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Revertir cancelación/i })).not.toBeInTheDocument()
  })

  it("cancelar pide confirmación antes de llamar al backend", async () => {
    mockInitialLoad(billingFixture("active"))
    mockedCancel.mockResolvedValueOnce({
      billing_state: "active_canceling",
      actions: ACTIONS_BY_STATE.active_canceling,
      subscription: subscriptionFixture({ cancel_at_period_end: true }),
    })
    await renderPage()

    fireEvent.click(await screen.findByRole("button", { name: /Cancelar suscripción/i }))
    expect(mockedCancel).not.toHaveBeenCalled()

    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: /Confirmar cancelación/i }))

    await waitFor(() => expect(mockedCancel).toHaveBeenCalledTimes(1))
  })
})

describe("BillingPageContent — resultado de change-plan (billing)", () => {
  const cases: Array<{
    billing: "immediate_paid" | "immediate_payment_pending" | "scheduled"
    toastFn: "success" | "warning"
  }> = [
    { billing: "immediate_paid", toastFn: "success" },
    { billing: "immediate_payment_pending", toastFn: "warning" },
    { billing: "scheduled", toastFn: "success" },
  ]

  it.each(cases)(
    'billing="$billing" produce feedback distinto ($toastFn)',
    async ({ billing, toastFn }) => {
      mockInitialLoad(billingFixture("active"))
      mockedChangePlan.mockResolvedValueOnce({
        billing_state: "active",
        actions: ACTIONS_BY_STATE.active,
        subscription: subscriptionFixture(),
        billing,
      })
      // Refetch posterior al cambio (ver `handleChangePlan`).
      mockedFetchSubscription.mockResolvedValueOnce(billingFixture("active"))
      await renderPage()

      fireEvent.click(await screen.findByRole("button", { name: /Cambiar a Pro/i }))

      await waitFor(() => expect(mockedChangePlan).toHaveBeenCalled())
      await waitFor(() => expect((toast as any)[toastFn]).toHaveBeenCalled())
    },
  )

  it("los tres valores de billing generan mensajes de texto distintos entre sí", async () => {
    const messages: string[] = []
    for (const billing of ["immediate_paid", "immediate_payment_pending", "scheduled"] as const) {
      vi.clearAllMocks()
      mockInitialLoad(billingFixture("active"))
      mockedChangePlan.mockResolvedValueOnce({
        billing_state: "active",
        actions: ACTIONS_BY_STATE.active,
        subscription: subscriptionFixture(),
        billing,
      })
      mockedFetchSubscription.mockResolvedValueOnce(billingFixture("active"))
      const { unmount } = render(<BillingPageContent />)
      await screen.findByRole("heading", { name: "Facturación" })
      fireEvent.click(await screen.findByRole("button", { name: /Cambiar a Pro/i }))
      await waitFor(() => expect(mockedChangePlan).toHaveBeenCalled())
      await waitFor(() => {
        const calls = [
          ...(toast.success as Mock).mock.calls,
          ...(toast.warning as Mock).mock.calls,
        ]
        expect(calls.length).toBeGreaterThan(0)
      })
      const allCalls = [
        ...(toast.success as Mock).mock.calls,
        ...(toast.warning as Mock).mock.calls,
      ]
      messages.push(String(allCalls[allCalls.length - 1][0]))
      unmount()
    }
    expect(new Set(messages).size).toBe(3)
  })
})

describe("BillingPageContent — errores sin actualización optimista", () => {
  function conflictError(message: string) {
    const err: any = new Error(message)
    err.isAxiosError = true
    err.response = { status: 409, data: { error: message } }
    return err
  }

  it("un 409 al cancelar no cambia el estado mostrado ni cierra el modal como si hubiera funcionado", async () => {
    mockInitialLoad(billingFixture("active"))
    mockedCancel.mockRejectedValueOnce(conflictError("conflicto de estado"))
    await renderPage()

    fireEvent.click(await screen.findByRole("button", { name: /Cancelar suscripción/i }))
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: /Confirmar cancelación/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("conflicto de estado"))
    // El modal NO se cierra como si la cancelación hubiera funcionado — el
    // botón de confirmar sigue ahí, listo para reintentar o volver.
    expect(
      within(dialog).getByRole("button", { name: /Confirmar cancelación/i }),
    ).toBeInTheDocument()
  })

  it("un 409 al cambiar de plan (orden ambiguo) no actualiza el plan mostrado", async () => {
    mockInitialLoad(billingFixture("active"))
    mockedChangePlan.mockRejectedValueOnce(conflictError("No existe un orden definido entre estos planes"))
    await renderPage()

    fireEvent.click(await screen.findByRole("button", { name: /Cambiar a Pro/i }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No existe un orden definido entre estos planes"),
    )
    // El plan actual sigue siendo Basic — no se reemplazó optimistamente:
    // el botón de Pro vuelve a decir "Cambiar a Pro" (no "Plan actual"), y
    // Basic sigue siendo el único marcado como plan actual.
    expect(await screen.findByRole("button", { name: "Plan actual" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cambiar a Pro/i })).toBeInTheDocument()
  })
})

describe("BillingPageContent — doble envío", () => {
  it("cambiar de plan deshabilita el botón mientras está pendiente; un segundo click no dispara una segunda llamada", async () => {
    mockInitialLoad(billingFixture("active"))
    let resolveChange!: (value: unknown) => void
    mockedChangePlan.mockImplementation(
      () => new Promise((resolve) => { resolveChange = resolve }),
    )
    await renderPage()

    const button = await screen.findByRole("button", { name: /Cambiar a Pro/i })
    fireEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    // Un click sobre un botón deshabilitado no dispara el handler en el DOM real.
    fireEvent.click(button)
    expect(mockedChangePlan).toHaveBeenCalledTimes(1)

    mockedFetchSubscription.mockResolvedValueOnce(billingFixture("active"))
    resolveChange({
      billing_state: "active",
      actions: ACTIONS_BY_STATE.active,
      subscription: subscriptionFixture(),
      billing: "immediate_paid",
    })
    await waitFor(() => expect(button).not.toBeDisabled())
    expect(mockedChangePlan).toHaveBeenCalledTimes(1)
  })
})

describe('BillingPageContent — "past_due" y "unknown" no se muestran como activos', () => {
  it('"past_due": el badge no dice "Activo" y aparece el aviso de pago pendiente', async () => {
    mockInitialLoad(billingFixture("past_due"))
    await renderPage()

    expect(screen.queryByText("Activo")).not.toBeInTheDocument()
    expect(await screen.findByText(/Pago pendiente o fallido/i)).toBeInTheDocument()
  })

  it('"unknown": el badge no dice "Activo" y aparece el aviso de estado sin verificar', async () => {
    mockInitialLoad(billingFixture("unknown"))
    await renderPage()

    expect(screen.queryByText("Activo")).not.toBeInTheDocument()
    expect(
      await screen.findByText(/No pudimos verificar el estado de tu suscripción/i),
    ).toBeInTheDocument()
  })
})
