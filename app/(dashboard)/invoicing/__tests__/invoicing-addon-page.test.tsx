import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { Mock } from "vitest"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return { ...actual, getUserRoleFromCookie: vi.fn() }
})

vi.mock("@/lib/requests/invoicing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/requests/invoicing")>(
    "@/lib/requests/invoicing",
  )
  return {
    ...actual,
    fetchInvoicingAddon: vi.fn(),
    fetchInvoicingUsage: vi.fn(),
    saveInvoicingAddon: vi.fn(),
  }
})

import * as invoicingApi from "@/lib/requests/invoicing"
import { getUserRoleFromCookie } from "@/lib/auth"
import type { InvoicingAddon, InvoicingUsagePeriod } from "@/lib/requests/invoicing"
import InvoicingAddonPage from "../addon/page"

const mockedFetchAddon = invoicingApi.fetchInvoicingAddon as Mock
const mockedFetchUsage = invoicingApi.fetchInvoicingUsage as Mock
const mockedGetUserRole = getUserRoleFromCookie as Mock

function buildAddon(overrides: Partial<InvoicingAddon> = {}): InvoicingAddon {
  return {
    id: "addon-1",
    business_id: "biz-1",
    enabled: true,
    monthly_voucher_limit: 100,
    price_per_voucher: null,
    provider_cost_per_voucher: "0.05",
    currency_code: "USD",
    activated_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function buildUsage(overrides: Partial<InvoicingUsagePeriod> = {}): InvoicingUsagePeriod {
  return {
    id: "usage-1",
    business_id: "biz-1",
    period: "2026-11",
    vouchers_authorized: 3,
    provider_requests: 10,
    provider_cost_total: "0.15",
    commercial_amount_total: "0",
    currency_code: "USD",
    reconciliation_status: "open",
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("InvoicingAddonPage", () => {
  it("muestra 'Pendiente de definición' cuando el precio comercial es null, sin inventar una tarifa", async () => {
    mockedGetUserRole.mockReturnValue("ADMIN")
    mockedFetchAddon.mockResolvedValue({ addon: buildAddon({ price_per_voucher: null }) })
    mockedFetchUsage.mockResolvedValue({ current: buildUsage(), history: [] })

    render(<InvoicingAddonPage />)

    await waitFor(() => {
      expect(screen.getByText("Tarifa todavía sin definir")).toBeInTheDocument()
    })
    expect(screen.getAllByText("Pendiente de definición").length).toBeGreaterThan(0)
  })

  it("oculta el costo del proveedor para rol ADMIN y lo muestra para OWNER", async () => {
    mockedFetchAddon.mockResolvedValue({ addon: buildAddon() })
    mockedFetchUsage.mockResolvedValue({ current: buildUsage(), history: [] })

    mockedGetUserRole.mockReturnValue("ADMIN")
    const { unmount } = render(<InvoicingAddonPage />)
    await waitFor(() => {
      expect(screen.getByText("Comprobantes autorizados")).toBeInTheDocument()
    })
    expect(screen.queryByText("Costo del proveedor (estimado)")).not.toBeInTheDocument()
    unmount()

    mockedGetUserRole.mockReturnValue("OWNER")
    render(<InvoicingAddonPage />)
    await waitFor(() => {
      expect(screen.getByText("Costo del proveedor (estimado)")).toBeInTheDocument()
    })
  })

  it("no ofrece ningún control de cobro automático", async () => {
    mockedGetUserRole.mockReturnValue("OWNER")
    mockedFetchAddon.mockResolvedValue({ addon: buildAddon() })
    mockedFetchUsage.mockResolvedValue({ current: buildUsage(), history: [] })

    render(<InvoicingAddonPage />)

    await waitFor(() => {
      expect(screen.getByText("Activación")).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /cobrar/i })).not.toBeInTheDocument()
  })
})
