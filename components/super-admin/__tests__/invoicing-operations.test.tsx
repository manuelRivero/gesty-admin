import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Mock } from "vitest"

vi.mock("@/lib/requests/invoicing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/requests/invoicing")>(
    "@/lib/requests/invoicing",
  )
  return {
    ...actual,
    fetchSuperAdminInvoicingIssues: vi.fn(),
    fetchSuperAdminInvoicingUsage: vi.fn(),
    fetchSuperAdminInvoicingBusinesses: vi.fn(),
  }
})

import * as invoicingApi from "@/lib/requests/invoicing"
import {
  SuperAdminInvoicingBusinessesSection,
  SuperAdminInvoicingIssuesSection,
  SuperAdminInvoicingUsageSection,
} from "../invoicing-operations"

const fetchIssues = invoicingApi.fetchSuperAdminInvoicingIssues as Mock
const fetchUsage = invoicingApi.fetchSuperAdminInvoicingUsage as Mock
const fetchBusinesses = invoicingApi.fetchSuperAdminInvoicingBusinesses as Mock

const issue = (overrides: Record<string, unknown> = {}) => ({
  id: "invoice-1",
  business_id: "business-1",
  order_id: "order-1",
  kind: "invoice",
  provider: "sistemas360",
  provider_environment: "sandbox",
  voucher_type: "B",
  punto_venta: 1,
  comprobante_numero: 25,
  issued_at: "2026-10-25T10:00:00.000Z",
  amount: "1250.50",
  currency_code: "ARS",
  status: "requires_review",
  error_message: "Resultado de emisión desconocido",
  retry_count: 2,
  created_at: "2026-10-25T09:00:00.000Z",
  updated_at: "2026-10-25T11:00:00.000Z",
  business: { id: "business-1", name: "Restaurante Centro" },
  ...overrides,
})

const usageRows = [
  {
    id: "usage-1",
    business_id: "business-1",
    period: "2026-11",
    vouchers_authorized: 2,
    provider_requests: 4,
    currency_code: "ARS",
    reconciliation_status: "open",
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-02T00:00:00.000Z",
    business: { id: "business-1", name: "Restaurante Centro" },
  },
  {
    id: "usage-2",
    business_id: "business-2",
    period: "2026-11",
    vouchers_authorized: 1,
    provider_requests: 3,
    currency_code: "ARS",
    reconciliation_status: "open",
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-02T00:00:00.000Z",
    business: { id: "business-2", name: "Restaurante Norte" },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  fetchIssues.mockResolvedValue({ invoices: [] })
  fetchUsage.mockImplementation(async (period?: string) => ({
    period: period ?? "2026-11",
    rows: period ? [] : usageRows,
  }))
  fetchBusinesses.mockResolvedValue({ businesses: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("SuperAdminInvoicingIssuesSection", () => {
  it("distingue requires_review, rejected y failed y no ofrece mutaciones fiscales", async () => {
    fetchIssues.mockResolvedValue({
      invoices: [
        issue(),
        issue({
          id: "invoice-2",
          status: "rejected",
          provider: "sistemas360",
          provider_environment: null,
          error_message: "Comprobante rechazado",
          business: { id: "business-2", name: "Restaurante Norte" },
        }),
        issue({
          id: "invoice-3",
          status: "failed",
          error_message: "Error de conexión",
          business: { id: "business-3", name: "Restaurante Sur" },
        }),
      ],
    })

    render(<SuperAdminInvoicingIssuesSection />)

    expect(await screen.findByText("Requiere revisión")).toBeInTheDocument()
    expect(screen.getByText("Rechazado")).toBeInTheDocument()
    expect(screen.getByText("Fallido")).toBeInTheDocument()
    expect(screen.getByText("Restaurante Centro")).toBeInTheDocument()
    expect(screen.getByText("Restaurante Norte")).toBeInTheDocument()
    expect(screen.getByText("Restaurante Sur")).toBeInTheDocument()
    expect(screen.getAllByText("00001-00000025")).toHaveLength(3)
    expect(screen.getAllByText("Sistemas 360").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /reemitir|reintentar|autorizar|eliminar/i })).not.toBeInTheDocument()
  })

  it("muestra estado vacío, error y permite actualizar manualmente", async () => {
    const userEvent = (await import("@testing-library/user-event")).default
    const user = userEvent.setup()
    const { rerender } = render(<SuperAdminInvoicingIssuesSection />)
    expect(await screen.findByText("No hay incidencias de facturación para mostrar.")).toBeInTheDocument()

    fetchIssues.mockRejectedValueOnce(new Error("offline"))
    await user.click(screen.getByRole("button", { name: "Actualizar incidencias de facturación" }))
    expect(await screen.findByText("No se pudieron cargar las incidencias.")).toBeInTheDocument()

    fetchIssues.mockResolvedValueOnce({ invoices: [issue()] })
    rerender(<SuperAdminInvoicingIssuesSection />)
    await user.click(screen.getByRole("button", { name: "Actualizar incidencias de facturación" }))
    expect(await screen.findByText("Resultado de emisión desconocido")).toBeInTheDocument()
    expect(fetchIssues).toHaveBeenCalledTimes(3)
  })
})

describe("SuperAdminInvoicingUsageSection", () => {
  it("separa requests técnicos de comprobantes autorizados y respeta el período del backend", async () => {
    render(<SuperAdminInvoicingUsageSection />)

    expect(await screen.findByText("Restaurante Norte")).toBeInTheDocument()
    expect(screen.getByText(/Período informado por backend: 2026-11/)).toBeInTheDocument()
    expect(screen.getByLabelText("Período")).toHaveValue("2026-11")
    expect(screen.getByText("7", { exact: true })).toBeInTheDocument()
    expect(screen.getAllByText("3", { exact: true }).length).toBeGreaterThan(1)

    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "2026-10" } })
    await waitFor(() => {
      expect(fetchUsage).toHaveBeenCalledWith("2026-10")
      expect(screen.getByLabelText("Período")).toHaveValue("2026-10")
    })
  })

  it("muestra errores y períodos sin datos", async () => {
    fetchUsage.mockRejectedValueOnce(new Error("offline"))
    const { rerender } = render(<SuperAdminInvoicingUsageSection />)
    expect(await screen.findByText("No se pudo cargar el consumo de facturación.")).toBeInTheDocument()

    fetchUsage.mockResolvedValueOnce({ period: "2026-09", rows: [] })
    rerender(<SuperAdminInvoicingUsageSection />)
    fireEvent.click(screen.getByRole("button", { name: "Actualizar consumo global de facturación" }))
    expect(await screen.findByText("No hay datos de consumo para el período informado.")).toBeInTheDocument()
    expect(screen.getByLabelText("Período")).toHaveValue("2026-09")
  })
})

describe("SuperAdminInvoicingBusinessesSection", () => {
  it("lista restaurantes con sus estados de complemento y muestra el estado vacío", async () => {
    fetchBusinesses.mockResolvedValue({
      businesses: [
        {
          id: "addon-1",
          business_id: "business-1",
          enabled: true,
          activated_at: "2026-10-01T00:00:00.000Z",
          business: { id: "business-1", name: "Restaurante Sistemas" },
        },
        {
          id: "addon-2",
          business_id: "business-2",
          enabled: true,
          activated_at: null,
          business: { id: "business-2", name: "Restaurante histórico" },
        },
      ],
    })
    const { rerender } = render(<SuperAdminInvoicingBusinessesSection />)

    expect(await screen.findByText("Restaurante Sistemas")).toBeInTheDocument()
    expect(screen.getByText("Restaurante histórico")).toBeInTheDocument()
    expect(screen.getAllByText("Activo")).toHaveLength(2)
    expect(screen.getByText(/no incluye proveedor ni estado de configuración fiscal/)).toBeInTheDocument()

    fetchBusinesses.mockResolvedValueOnce({ businesses: [] })
    rerender(<SuperAdminInvoicingBusinessesSection />)
    fireEvent.click(screen.getByRole("button", { name: "Actualizar restaurantes adheridos" }))
    expect(await screen.findByText("No hay restaurantes adheridos para mostrar.")).toBeInTheDocument()
  })

  it("expone errores de carga y permite actualizar", async () => {
    fetchBusinesses.mockRejectedValueOnce(new Error("offline"))
    render(<SuperAdminInvoicingBusinessesSection />)
    expect(await screen.findByText("No se pudieron cargar los restaurantes adheridos.")).toBeInTheDocument()
  })
})
