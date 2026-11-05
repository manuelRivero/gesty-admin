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
    fetchCentralProviderConfig: vi.fn(),
    fetchArcaHealth: vi.fn(),
    saveCentralProviderToken: vi.fn(),
    saveCentralProviderEnvironment: vi.fn(),
    setCentralProviderActive: vi.fn(),
    validateCentralProviderConnectivity: vi.fn(),
    fetchSuperAdminInvoicingIssues: vi.fn(),
    fetchSuperAdminInvoicingUsage: vi.fn(),
    fetchSuperAdminInvoicingBusinesses: vi.fn(),
  }
})

import * as invoicingApi from "@/lib/requests/invoicing"
import type { CentralProviderConfig } from "@/lib/requests/invoicing"
import SuperAdminInvoicingPage from "../page"

const mockedFetchConfig = invoicingApi.fetchCentralProviderConfig as Mock
const mockedFetchArcaHealth = invoicingApi.fetchArcaHealth as Mock
const mockedSaveToken = invoicingApi.saveCentralProviderToken as Mock

function buildConfig(overrides: Partial<CentralProviderConfig> = {}): CentralProviderConfig {
  return {
    provider: "sistemas360",
    activeEnvironment: "sandbox",
    isActive: false,
    status: "not_configured",
    lastValidatedAt: null,
    lastValidationDetail: null,
    lastValidatedEnvironment: null,
    hasSandboxToken: false,
    hasProductionToken: false,
    totalRequestsCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("SuperAdminInvoicingPage", () => {
  it("el entorno inicial es sandbox cuando todavía no hay configuración", async () => {
    mockedFetchConfig.mockResolvedValue({ config: null })
    mockedFetchArcaHealth.mockResolvedValue({ ok: true, status: 200 })
    ;(invoicingApi.fetchSuperAdminInvoicingIssues as Mock).mockResolvedValue({ invoices: [] })
    ;(invoicingApi.fetchSuperAdminInvoicingUsage as Mock).mockResolvedValue({
      period: "2026-11",
      rows: [],
    })
    ;(invoicingApi.fetchSuperAdminInvoicingBusinesses as Mock).mockResolvedValue({
      businesses: [],
    })

    render(<SuperAdminInvoicingPage />)

    await waitFor(() => {
      expect(screen.getByText("Sandbox es el entorno inicial")).toBeInTheDocument()
    })
  })

  it("nunca muestra el token guardado: el input queda vacío aunque hasSandboxToken sea true", async () => {
    mockedFetchConfig.mockResolvedValue({ config: buildConfig({ hasSandboxToken: true }) })
    mockedFetchArcaHealth.mockResolvedValue({ ok: true, status: 200 })

    render(<SuperAdminInvoicingPage />)

    await waitFor(() => {
      expect(screen.getAllByText("Ya configurado").length).toBeGreaterThan(0)
    })
    const sandboxInput = screen.getByLabelText("Token sandbox") as HTMLInputElement
    expect(sandboxInput.value).toBe("")
    expect(sandboxInput.type).toBe("password")
  })

  it("al guardar, envía el token en texto plano UNA vez al backend (que lo cifra) y nunca lo vuelve a mostrar", async () => {
    mockedFetchConfig.mockResolvedValue({ config: buildConfig() })
    mockedFetchArcaHealth.mockResolvedValue({ ok: true, status: 200 })
    mockedSaveToken.mockResolvedValue({ config: buildConfig({ hasSandboxToken: true }) })

    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<SuperAdminInvoicingPage />)

    await waitFor(() => expect(screen.getByLabelText("Token sandbox")).toBeInTheDocument())
    await user.type(screen.getByLabelText("Token sandbox"), "secret-token-abc")
    await user.click(screen.getAllByRole("button", { name: "Guardar" })[0])

    await waitFor(() => {
      expect(mockedSaveToken).toHaveBeenCalledWith("sistemas360", "sandbox", "secret-token-abc")
    })
    const sandboxInput = screen.getByLabelText("Token sandbox") as HTMLInputElement
    expect(sandboxInput.value).toBe("")
  })

  it("muestra el estado de ARCA/WSFE sin exponer ningún token", async () => {
    mockedFetchConfig.mockResolvedValue({ config: buildConfig({ isActive: true, activeEnvironment: "sandbox" }) })
    mockedFetchArcaHealth.mockResolvedValue({ ok: false, status: 503 })

    render(<SuperAdminInvoicingPage />)

    await waitFor(() => {
      expect(screen.getByText("No disponible")).toBeInTheDocument()
    })
  })

  it("distingue el token configurado de una validación de otro entorno y muestra el total histórico", async () => {
    mockedFetchConfig.mockResolvedValue({
      config: buildConfig({
        activeEnvironment: "sandbox",
        isActive: true,
        status: "validated",
        lastValidatedAt: "2026-10-25T12:00:00.000Z",
        lastValidatedEnvironment: "production",
        hasSandboxToken: true,
        totalRequestsCount: 1432,
      }),
    })
    mockedFetchArcaHealth.mockResolvedValue({ ok: true, status: 200 })

    render(<SuperAdminInvoicingPage />)

    await waitFor(() => {
      expect(screen.getByText("Token del entorno activo: configurado")).toBeInTheDocument()
      expect(screen.getByText("Validación de otro entorno")).toBeInTheDocument()
      expect(screen.getByText("Entorno de la última validación: Producción")).toBeInTheDocument()
      expect(screen.getByText("1.432")).toBeInTheDocument()
    })
    expect(screen.queryByText("Token validado para el entorno activo")).not.toBeInTheDocument()
  })

  it("no presenta consumo mensual y nunca muestra las credenciales", async () => {
    mockedFetchConfig.mockResolvedValue({
      config: buildConfig({
        hasSandboxToken: true,
        totalRequestsCount: 12,
        lastValidationDetail: "Validación completada",
      }),
    })
    mockedFetchArcaHealth.mockResolvedValue({ ok: true, status: 200 })

    render(<SuperAdminInvoicingPage />)

    await waitFor(() => {
      expect(screen.getByText("Requests técnicos acumulados")).toBeInTheDocument()
      expect(screen.getByText(/no representa consumo mensual/)).toBeInTheDocument()
    })
    expect(document.body).not.toHaveTextContent("secret-token-abc")
  })

  it("no presenta una validación anterior como vigente después de cambiar el token", async () => {
    mockedFetchConfig.mockResolvedValue({
      config: buildConfig({
        activeEnvironment: "sandbox",
        status: "pending_validation",
        lastValidatedAt: "2026-10-25T12:00:00.000Z",
        lastValidatedEnvironment: "sandbox",
        hasSandboxToken: true,
      }),
    })
    mockedFetchArcaHealth.mockResolvedValue({ ok: true, status: 200 })

    render(<SuperAdminInvoicingPage />)

    await waitFor(() => {
      expect(screen.getByText("Validación pendiente")).toBeInTheDocument()
      expect(screen.getByText(/Última validación registrada:/)).toBeInTheDocument()
    })
    expect(screen.queryByText("Token validado para el entorno activo")).not.toBeInTheDocument()
  })
})
