import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
    fetchInvoicingInvoices: vi.fn(),
    fetchInvoicePdfDataUrl: vi.fn(),
    retryInvoiceEmission: vi.fn(),
  }
})

import { toast } from "sonner"
import * as invoicingApi from "@/lib/requests/invoicing"
import type { FiscalInvoice } from "@/lib/requests/invoicing"
import InvoicingHistoryPage from "../history/page"

const mockedFetchInvoices = invoicingApi.fetchInvoicingInvoices as Mock
const mockedFetchPdf = invoicingApi.fetchInvoicePdfDataUrl as Mock
const mockedRetryEmission = invoicingApi.retryInvoiceEmission as Mock

function buildInvoice(overrides: Partial<FiscalInvoice> = {}): FiscalInvoice {
  return {
    id: "inv-1",
    business_id: "biz-1",
    order_id: "11111111-2222-3333-4444-555555555555",
    kind: "invoice",
    provider: "sistemas360",
    idempotency_key: "biz-1:order-1:invoice",
    provider_invoice_id: "ext-1",
    voucher_type: "B",
    punto_venta: null,
    comprobante_numero: 10,
    cae: "71234567890123",
    cae_vencimiento: "2027-01-01T00:00:00.000Z",
    issued_at: "2026-11-01T00:00:00.000Z",
    amount: "1500.00",
    currency_code: "ARS",
    status: "authorized",
    pdf_url: "https://example.com/pdf/xyz",
    error_message: null,
    retry_count: 0,
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

describe("InvoicingHistoryPage", () => {
  it("muestra el estado vacío cuando no hay comprobantes", async () => {
    mockedFetchInvoices.mockResolvedValue({ invoices: [] })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByText("Sin comprobantes todavía")).toBeInTheDocument()
    })
  })

  it("muestra el comprobante autorizado con su enlace al PDF, sin ninguna acción de edición/eliminación", async () => {
    mockedFetchInvoices.mockResolvedValue({ invoices: [buildInvoice()] })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByText("Autorizado")).toBeInTheDocument()
    })
    expect(screen.getByText("71234567890123")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /ver pdf/i })).toHaveAttribute(
      "href",
      "https://example.com/pdf/xyz",
    )
    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /emitir/i })).not.toBeInTheDocument()
  })

  it("no ofrece un link de PDF cuando pdf_url es null", async () => {
    mockedFetchInvoices.mockResolvedValue({
      invoices: [buildInvoice({ pdf_url: null, status: "processing", cae: null })],
    })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByText("En proceso")).toBeInTheDocument()
    })
    expect(screen.queryByRole("link", { name: /ver pdf/i })).not.toBeInTheDocument()
  })

  it("muestra un mensaje comprensible para 'requires_review' sin botón de reemisión", async () => {
    mockedFetchInvoices.mockResolvedValue({
      invoices: [
        buildInvoice({
          status: "requires_review",
          cae: null,
          pdf_url: null,
          error_message: "timeout",
        }),
      ],
    })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByText("Requiere revisión")).toBeInTheDocument()
    })
    expect(
      screen.getByText(/no hace falta ninguna acción/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument()
  })

  it("pide la siguiente página con el status filtrado al cambiar el selector", async () => {
    mockedFetchInvoices.mockResolvedValue({ invoices: [] })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(mockedFetchInvoices).toHaveBeenCalledWith({
        status: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        take: 25,
        skip: 0,
      })
    })
  })

  it("ofrece un filtro por período (desde/hasta) y lo envía al backend", async () => {
    mockedFetchInvoices.mockResolvedValue({ invoices: [] })
    const user = userEvent.setup()

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(mockedFetchInvoices).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: undefined, dateTo: undefined }),
      )
    })

    await user.type(screen.getByLabelText("Desde"), "2026-01-01")

    await waitFor(() => {
      expect(mockedFetchInvoices).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: "2026-01-01", dateTo: undefined }),
      )
    })

    await user.type(screen.getByLabelText("Hasta"), "2026-01-31")

    await waitFor(() => {
      expect(mockedFetchInvoices).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: "2026-01-01", dateTo: "2026-01-31" }),
      )
    })

    await user.click(screen.getByRole("button", { name: "Limpiar período" }))

    await waitFor(() => {
      expect(mockedFetchInvoices).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: undefined, dateTo: undefined }),
      )
    })
  })

  it("diferencia 'simulado' de 'autorizado' con una advertencia explícita de validez fiscal", async () => {
    mockedFetchInvoices.mockResolvedValue({
      invoices: [buildInvoice({ status: "simulated", cae: "00000000000000", pdf_url: null })],
    })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByText("Simulado (sin validez fiscal)")).toBeInTheDocument()
    })
    expect(screen.getByText(/SIN validez fiscal real/)).toBeInTheDocument()
    expect(screen.queryByText("Autorizado")).not.toBeInTheDocument()
  })

  it("pide el PDF a demanda cuando no hay pdf_url persistida (p. ej. Sistemas 360)", async () => {
    mockedFetchInvoices.mockResolvedValue({
      invoices: [buildInvoice({ status: "authorized", pdf_url: null })],
    })
    mockedFetchPdf.mockResolvedValue("data:application/pdf;base64,AAAA")
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ver pdf/i })).toBeInTheDocument()
    })
    screen.getByRole("button", { name: /ver pdf/i }).click()

    await waitFor(() => {
      expect(mockedFetchPdf).toHaveBeenCalledWith("11111111-2222-3333-4444-555555555555", "inv-1")
      expect(openSpy).toHaveBeenCalledWith("data:application/pdf;base64,AAAA", "_blank", "noopener,noreferrer")
    })
  })

  it("ofrece 'Reintentar' solo para 'failed' y llama al endpoint de emisión con el order_id", async () => {
    mockedFetchInvoices.mockResolvedValue({
      invoices: [buildInvoice({ status: "failed", cae: null, pdf_url: null, error_message: "timeout" })],
    })
    mockedRetryEmission.mockResolvedValue({ emitted: false, reason: "requires_review" })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument()
    })
    screen.getByRole("button", { name: /reintentar/i }).click()

    await waitFor(() => {
      expect(mockedRetryEmission).toHaveBeenCalledWith("11111111-2222-3333-4444-555555555555")
      expect(toast.error).toHaveBeenCalled()
    })
  })

  it("al reintentar y quedar autorizado, actualiza la fila y avisa éxito", async () => {
    mockedFetchInvoices.mockResolvedValue({
      invoices: [buildInvoice({ status: "failed", cae: null, pdf_url: null })],
    })
    mockedRetryEmission.mockResolvedValue({
      emitted: true,
      invoice: buildInvoice({ status: "authorized", cae: "71234567890123" }),
    })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument()
    })
    screen.getByRole("button", { name: /reintentar/i }).click()

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled()
      expect(screen.getByText("Autorizado")).toBeInTheDocument()
    })
  })

  it("no ofrece descargar PDF para comprobantes sin resultado fiscal todavía", async () => {
    mockedFetchInvoices.mockResolvedValue({
      invoices: [buildInvoice({ status: "requires_review", pdf_url: null, cae: null })],
    })

    render(<InvoicingHistoryPage />)

    await waitFor(() => {
      expect(screen.getByText("Requiere revisión")).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /ver pdf/i })).not.toBeInTheDocument()
  })
})
