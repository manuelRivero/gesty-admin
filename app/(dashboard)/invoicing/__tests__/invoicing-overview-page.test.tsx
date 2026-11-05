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

vi.mock("@/lib/requests/invoicing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/requests/invoicing")>(
    "@/lib/requests/invoicing",
  )
  return {
    ...actual,
    fetchFiscalConfiguration: vi.fn(),
    fetchInvoicingAddon: vi.fn(),
    fetchInvoicingUsage: vi.fn(),
  }
})

import * as invoicingApi from "@/lib/requests/invoicing"
import type { FiscalConfiguration, InvoicingAddon, InvoicingUsagePeriod } from "@/lib/requests/invoicing"
import { InvoicingOverviewContent } from "../page"

const mockedFetchFiscalConfiguration = invoicingApi.fetchFiscalConfiguration as Mock
const mockedFetchAddon = invoicingApi.fetchInvoicingAddon as Mock
const mockedFetchUsage = invoicingApi.fetchInvoicingUsage as Mock

function buildFiscalConfig(overrides: Partial<FiscalConfiguration> = {}): FiscalConfiguration {
  return {
    id: "fc-1",
    business_id: "biz-1",
    cuit: "20123456786",
    razon_social: "Restaurante Test",
    condicion_iva: "RI",
    domicilio_fiscal: "Calle Falsa 123",
    punto_venta: 3,
    auto_issue_online: true,
    auto_issue_cash: false,
    status: "pending_validation",
    validated_at: null,
    external_issuer_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function buildAddon(overrides: Partial<InvoicingAddon> = {}): InvoicingAddon {
  return {
    id: "addon-1",
    business_id: "biz-1",
    enabled: false,
    monthly_voucher_limit: null,
    price_per_voucher: null,
    provider_cost_per_voucher: null,
    currency_code: "USD",
    activated_at: null,
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
    vouchers_authorized: 0,
    provider_requests: 0,
    provider_cost_total: "0",
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

describe("InvoicingOverviewContent", () => {
  it("muestra el aviso de emisión deshabilitada siempre", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({ fiscalConfiguration: null })
    mockedFetchAddon.mockResolvedValue({ addon: null })
    mockedFetchUsage.mockResolvedValue({ current: null, history: [] })

    render(<InvoicingOverviewContent />)

    await waitFor(() => {
      expect(screen.getByText("Emisión real deshabilitada")).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /emitir/i })).not.toBeInTheDocument()
  })

  it("muestra 'Datos fiscales pendientes' y el llamado a completar datos cuando no hay configuración fiscal", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({ fiscalConfiguration: null })
    mockedFetchAddon.mockResolvedValue({ addon: null })
    mockedFetchUsage.mockResolvedValue({ current: null, history: [] })

    render(<InvoicingOverviewContent />)

    await waitFor(() => {
      expect(screen.getByText("Datos fiscales pendientes")).toBeInTheDocument()
    })
    expect(
      screen.getByText("Todavía no configuraste la facturación electrónica"),
    ).toBeInTheDocument()
  })

  it("muestra los comprobantes autorizados del período y el estado del complemento", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig(),
    })
    mockedFetchAddon.mockResolvedValue({ addon: buildAddon({ enabled: true }) })
    mockedFetchUsage.mockResolvedValue({
      current: buildUsage({ vouchers_authorized: 7, period: "2026-11" }),
      history: [],
    })

    render(<InvoicingOverviewContent />)

    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument()
    })
    expect(screen.getByText("Período 2026-11")).toBeInTheDocument()
    expect(screen.getByText("Activado")).toBeInTheDocument()
    expect(screen.getByText("Configurando facturación")).toBeInTheDocument()
  })

  it("muestra 'Facturación lista' cuando ya hay un emisor asociado", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig({ external_issuer_id: "99" }),
    })
    mockedFetchAddon.mockResolvedValue({ addon: null })
    mockedFetchUsage.mockResolvedValue({ current: null, history: [] })

    render(<InvoicingOverviewContent />)

    await waitFor(() => {
      expect(screen.getByText("Facturación lista")).toBeInTheDocument()
    })
  })

  it("muestra el proveedor Sistemas 360 y no pide tokens centrales ni expone conectividad interna al restaurante", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig({ cuit: null, razon_social: null, condicion_iva: null }),
    })
    mockedFetchAddon.mockResolvedValue({ addon: null })
    mockedFetchUsage.mockResolvedValue({ current: null, history: [] })

    render(<InvoicingOverviewContent />)

    await waitFor(() => {
      expect(screen.getByText(/Proveedor: Sistemas 360/)).toBeInTheDocument()
    })
    expect(screen.queryByText(/credenciales del proveedor/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/cargar tokens centrales/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/conexión — sistemas 360/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/ARCA\/WSFE/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /verificar conectividad/i })).not.toBeInTheDocument()
  })
})
