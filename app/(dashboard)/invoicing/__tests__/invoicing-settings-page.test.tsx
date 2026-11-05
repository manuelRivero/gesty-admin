import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Mock } from "vitest"

// jsdom no implementa `ResizeObserver`; lo necesita Radix `Select` (usado en esta página para
// la condición de IVA). Polyfill local, no se toca `vitest.setup.ts` global.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// jsdom tampoco implementa el pointer capture que usa Radix `Select` al abrir/cerrar con click.
// Mismo criterio que el stub de arriba: local a este archivo, no se toca `vitest.setup.ts`.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

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
    saveFiscalConfiguration: vi.fn(),
    fetchCuitLookup: vi.fn(),
  }
})

import * as invoicingApi from "@/lib/requests/invoicing"
import type { FiscalConfiguration } from "@/lib/requests/invoicing"
import InvoicingSettingsPage from "../settings/page"

const mockedFetchFiscalConfiguration = invoicingApi.fetchFiscalConfiguration as Mock
const mockedSaveFiscalConfiguration = invoicingApi.saveFiscalConfiguration as Mock
const mockedFetchCuitLookup = invoicingApi.fetchCuitLookup as Mock

function buildFiscalConfig(overrides: Partial<FiscalConfiguration> = {}): FiscalConfiguration {
  return {
    id: "fc-1",
    business_id: "biz-1",
    cuit: "20123456786",
    razon_social: "Restaurante Test",
    condicion_iva: "RI",
    domicilio_fiscal: "Calle Falsa 123",
    punto_venta: null,
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

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("InvoicingSettingsPage", () => {
  it("no solicita credenciales de proveedor al restaurante", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig(),
    })

    render(<InvoicingSettingsPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sistemas 360 (cuenta central de Gesty)")).toBeInTheDocument()
    })
    expect(screen.queryByLabelText("Punto de venta")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/user token|api token|api key|webhook token/i)).not.toBeInTheDocument()
  })

  it("precarga los datos fiscales ya guardados en el formulario", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig({ razon_social: "Mi Restaurante SRL" }),
    })

    render(<InvoicingSettingsPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue("Mi Restaurante SRL")).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue("20123456786")).toBeInTheDocument()
  })

  it("no ofrece ninguna acción manual de asociación de emisor ni de verificación de conectividad", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig(),
    })

    render(<InvoicingSettingsPage />)

    await waitFor(() => {
      expect(screen.getAllByText("Configurando facturación").length).toBeGreaterThan(0)
    })
    expect(screen.queryByRole("button", { name: /asociar\/verificar emisor/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /verificar conectividad/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/punto de venta predeterminado/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/emisor en la cuenta central/i)).not.toBeInTheDocument()
  })

  it("muestra 'Datos fiscales pendientes' cuando todavía no hay nada guardado", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({ fiscalConfiguration: null })

    render(<InvoicingSettingsPage />)

    await waitFor(() => {
      expect(screen.getAllByText("Datos fiscales pendientes").length).toBeGreaterThan(0)
    })
  })

  it("muestra 'Facturación lista' cuando ya hay un emisor asociado, sin exponer su identificador interno", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig({ external_issuer_id: "77" }),
    })

    render(<InvoicingSettingsPage />)

    await waitFor(() => {
      expect(screen.getAllByText("Facturación lista").length).toBeGreaterThan(0)
    })
    expect(screen.queryByText("77")).not.toBeInTheDocument()
    expect(screen.queryByText(/ID interno/i)).not.toBeInTheDocument()
  })
})

describe("InvoicingSettingsPage — guardado y aprovisionamiento automático", () => {
  async function fillAndSave(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("CUIT"), "20123456786")
    await user.type(screen.getByLabelText(/Razón social/i), "Restaurante Test")
    await user.click(screen.getByRole("combobox", { name: /Condición frente al IVA/i }))
    await user.click(screen.getByRole("option", { name: "Responsable Inscripto" }))
    await user.click(screen.getByRole("button", { name: /guardar datos fiscales/i }))
  }

  it("al guardar, el aprovisionamiento se dispara solo en el backend — la UI no tiene ningún botón para hacerlo a mano", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({ fiscalConfiguration: null })
    mockedSaveFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig({ external_issuer_id: "99" }),
      provisioning: { outcome: "provisioned", detail: "Emisor creado." },
    })
    const user = userEvent.setup()
    render(<InvoicingSettingsPage />)
    await waitFor(() => expect(screen.getByLabelText("CUIT")).toBeInTheDocument())

    await fillAndSave(user)

    await waitFor(() => {
      expect(mockedSaveFiscalConfiguration).toHaveBeenCalledTimes(1)
    })
    // El estado visible se actualiza con la respuesta del mismo PUT, sin recargar la página.
    expect(await screen.findAllByText("Facturación lista")).not.toHaveLength(0)
  })

  it("un aprovisionamiento 'pending' muestra 'Configurando facturación' y ofrece reintentar sin pedir los datos de nuevo", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({ fiscalConfiguration: null })
    mockedSaveFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig({ external_issuer_id: null }),
      provisioning: { outcome: "pending", detail: "Reintentando." },
    })
    const user = userEvent.setup()
    render(<InvoicingSettingsPage />)
    await waitFor(() => expect(screen.getByLabelText("CUIT")).toBeInTheDocument())

    await fillAndSave(user)

    const retryButton = await screen.findByRole("button", { name: /reintentar/i })
    expect(retryButton).toBeInTheDocument()

    mockedSaveFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig({ external_issuer_id: "99" }),
      provisioning: { outcome: "provisioned", detail: "Emisor creado." },
    })
    await user.click(retryButton)

    await waitFor(() => {
      expect(mockedSaveFiscalConfiguration).toHaveBeenCalledTimes(2)
    })
    // El segundo llamado reutiliza los mismos datos ya guardados, sin pedir volver a escribirlos.
    expect(mockedSaveFiscalConfiguration.mock.calls[1][0]).toMatchObject({
      cuit: "20123456786",
      razonSocial: "Restaurante Test",
    })
  })

  it("'requires_attention' muestra el mensaje del backend sin ocultar que los datos sí se guardaron", async () => {
    mockedFetchFiscalConfiguration.mockResolvedValue({ fiscalConfiguration: null })
    mockedSaveFiscalConfiguration.mockResolvedValue({
      fiscalConfiguration: buildFiscalConfig({ external_issuer_id: null }),
      provisioning: {
        outcome: "requires_attention",
        detail: "El emisor ya está asociado a otro negocio de Gesty.",
      },
    })
    const user = userEvent.setup()
    render(<InvoicingSettingsPage />)
    await waitFor(() => expect(screen.getByLabelText("CUIT")).toBeInTheDocument())

    await fillAndSave(user)

    expect(await screen.findByText("El emisor ya está asociado a otro negocio de Gesty.")).toBeInTheDocument()
    // Los datos siguen mostrándose en el formulario (no se revierte nada del guardado exitoso).
    expect(screen.getByDisplayValue("Restaurante Test")).toBeInTheDocument()
  })
})

describe("InvoicingSettingsPage — consulta de CUIT", () => {
  async function renderEmptyForm() {
    mockedFetchFiscalConfiguration.mockResolvedValue({ fiscalConfiguration: null })
    render(<InvoicingSettingsPage />)
    await waitFor(() => {
      expect(screen.getByLabelText("CUIT")).toBeInTheDocument()
    })
    return userEvent.setup()
  }

  it("no consulta al backend si el CUIT es inválido localmente", async () => {
    const user = await renderEmptyForm()

    await user.type(screen.getByLabelText("CUIT"), "123")
    await user.click(screen.getByRole("button", { name: /consultar cuit/i }))

    expect(mockedFetchCuitLookup).not.toHaveBeenCalled()
    expect(await screen.findByText(/no es válido/i)).toBeInTheDocument()
  })

  it("completa razón social, condición de IVA y domicilio fiscal con una consulta exitosa", async () => {
    const user = await renderEmptyForm()
    mockedFetchCuitLookup.mockResolvedValue({
      cuitLookup: {
        cuit: "20123456786",
        razonSocial: "Restaurante Test",
        condicionIva: "RI",
        condicionIvaRaw: "Responsable Inscripto",
        domicilioFiscal: "Calle Falsa 123",
      },
    })

    await user.type(screen.getByLabelText("CUIT"), "20123456786")
    await user.click(screen.getByRole("button", { name: /consultar cuit/i }))

    await waitFor(() => {
      expect(mockedFetchCuitLookup).toHaveBeenCalledWith("20123456786")
    })
    expect(await screen.findByDisplayValue("Restaurante Test")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Calle Falsa 123")).toBeInTheDocument()
    expect(screen.getByText("Datos obtenidos del padrón")).toBeInTheDocument()
    expect(screen.getAllByText("Dato del padrón").length).toBeGreaterThan(0)
  })

  it("exige selección manual cuando la condición de IVA del padrón no se puede mapear con seguridad", async () => {
    const user = await renderEmptyForm()
    mockedFetchCuitLookup.mockResolvedValue({
      cuitLookup: {
        cuit: "20123456786",
        razonSocial: "Restaurante Test",
        condicionIva: "NO_CATEGORIZADO",
        condicionIvaRaw: "Algo no reconocido",
        domicilioFiscal: "Calle Falsa 123",
      },
    })

    await user.type(screen.getByLabelText("CUIT"), "20123456786")
    await user.click(screen.getByRole("button", { name: /consultar cuit/i }))

    await waitFor(() => {
      expect(mockedFetchCuitLookup).toHaveBeenCalled()
    })
    expect(await screen.findByText(/Algo no reconocido/)).toBeInTheDocument()
    expect(screen.getByText("Seleccioná una condición")).toBeInTheDocument()
  })

  it("muestra un mensaje comprensible cuando el CUIT no existe en el padrón (404)", async () => {
    const user = await renderEmptyForm()
    mockedFetchCuitLookup.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { error: "No se encontró el CUIT 20123456786 en el padrón." } },
    })

    await user.type(screen.getByLabelText("CUIT"), "20123456786")
    await user.click(screen.getByRole("button", { name: /consultar cuit/i }))

    expect(await screen.findByText(/No encontramos ese CUIT/i)).toBeInTheDocument()
  })

  it("muestra un mensaje genérico (sin detalle técnico) ante un error del proveedor", async () => {
    const user = await renderEmptyForm()
    mockedFetchCuitLookup.mockRejectedValue({
      isAxiosError: true,
      response: { status: 502, data: { error: "[sistemas360] Error técnico: timeout interno xyz" } },
    })

    await user.type(screen.getByLabelText("CUIT"), "20123456786")
    await user.click(screen.getByRole("button", { name: /consultar cuit/i }))

    const message = await screen.findByText(/No se pudo consultar el CUIT/i)
    expect(message).toBeInTheDocument()
    expect(screen.queryByText(/timeout interno xyz/)).not.toBeInTheDocument()
  })

  it("invalida el resultado de una consulta anterior si el CUIT sigue cambiando (no confirma datos de otra consulta)", async () => {
    const user = await renderEmptyForm()
    mockedFetchCuitLookup.mockResolvedValue({
      cuitLookup: {
        cuit: "20123456786",
        razonSocial: "Restaurante Test",
        condicionIva: "RI",
        condicionIvaRaw: "Responsable Inscripto",
        domicilioFiscal: "Calle Falsa 123",
      },
    })

    await user.type(screen.getByLabelText("CUIT"), "20123456786")
    await user.click(screen.getByRole("button", { name: /consultar cuit/i }))
    await waitFor(() => {
      expect(screen.getByText("Datos obtenidos del padrón")).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText("CUIT"), "9")

    expect(screen.queryByText("Datos obtenidos del padrón")).not.toBeInTheDocument()
    expect(mockedFetchCuitLookup).toHaveBeenCalledTimes(1)
  })
})
