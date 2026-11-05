import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}))

import { api } from "@/lib/api"
import {
  cuitLookupErrorMessage,
  deriveBillingReadiness,
  fetchCuitLookup,
  fetchFiscalConfiguration,
  fetchInvoicingAddon,
  fetchInvoicingInvoices,
  fetchInvoicingUsage,
  fetchIssuerConnectivity,
  invoiceEmissionReasonMessage,
  provisionEmisor,
  retryInvoiceEmission,
  saveFiscalConfiguration,
  saveInvoicingAddon,
  type FiscalConfiguration,
} from "../invoicing"

const mockedGet = api.get as ReturnType<typeof vi.fn>
const mockedPut = api.put as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Estos tests fijan los contratos EXACTOS (ruta, método, forma del body) contra
 * `gesty-backend/src/routes/adminOrders.routes.ts` y `adminInvoicing.controller.ts`. Si el
 * backend cambia un contrato, estos tests deben fallar — no se infieren ni se inventan.
 */
describe("lib/requests/invoicing", () => {
  it("fetchFiscalConfiguration — GET /admin/invoicing/fiscal-configuration", async () => {
    mockedGet.mockResolvedValue({ data: { fiscalConfiguration: null } })
    await fetchFiscalConfiguration()
    expect(mockedGet).toHaveBeenCalledWith("/admin/invoicing/fiscal-configuration")
  })

  it("saveFiscalConfiguration — PUT /admin/invoicing/fiscal-configuration con el body esperado", async () => {
    mockedPut.mockResolvedValue({ data: { fiscalConfiguration: null } })
    await saveFiscalConfiguration({
      cuit: "20123456786",
      razonSocial: "Test",
      condicionIva: "RI",
      domicilioFiscal: "Calle 123",
      autoIssueOnline: true,
      autoIssueCash: false,
    })
    expect(mockedPut).toHaveBeenCalledWith("/admin/invoicing/fiscal-configuration", {
      cuit: "20123456786",
      razonSocial: "Test",
      condicionIva: "RI",
      domicilioFiscal: "Calle 123",
      autoIssueOnline: true,
      autoIssueCash: false,
    })
  })

  it("fetchIssuerConnectivity — GET .../issuer-connectivity", async () => {
    mockedGet.mockResolvedValue({
      data: { credentialsShapeValid: false, credentialErrors: [], issuerStatus: null },
    })
    await fetchIssuerConnectivity()
    expect(mockedGet).toHaveBeenCalledWith(
      "/admin/invoicing/fiscal-configuration/issuer-connectivity",
    )
  })

  it("fetchInvoicingAddon / saveInvoicingAddon — GET y PUT /admin/invoicing/addon", async () => {
    mockedGet.mockResolvedValue({ data: { addon: null } })
    await fetchInvoicingAddon()
    expect(mockedGet).toHaveBeenCalledWith("/admin/invoicing/addon")

    mockedPut.mockResolvedValue({ data: { addon: null } })
    await saveInvoicingAddon({ enabled: true })
    expect(mockedPut).toHaveBeenCalledWith("/admin/invoicing/addon", { enabled: true })
  })

  it("fetchInvoicingUsage — GET /admin/invoicing/usage, con/sin período", async () => {
    mockedGet.mockResolvedValue({ data: { current: null, history: [] } })
    await fetchInvoicingUsage()
    expect(mockedGet).toHaveBeenCalledWith("/admin/invoicing/usage", { params: undefined })

    await fetchInvoicingUsage("2026-11")
    expect(mockedGet).toHaveBeenCalledWith("/admin/invoicing/usage", {
      params: { period: "2026-11" },
    })
  })

  it("fetchInvoicingInvoices — GET /admin/invoicing/invoices con status/take/skip", async () => {
    mockedGet.mockResolvedValue({ data: { invoices: [] } })
    await fetchInvoicingInvoices({ status: "authorized", take: 25, skip: 0 })
    expect(mockedGet).toHaveBeenCalledWith("/admin/invoicing/invoices", {
      params: { status: "authorized", take: 25, skip: 0 },
    })
  })

  /**
   * `postProvisionEmisorHandler` responde 200 (provisioned) o 409 (p. ej. conflicto de emisor)
   * — ambos son resultados válidos del contrato, no errores de red. Sin `validateStatus`, axios
   * convierte el 409 en una excepción y el `detail` específico nunca llega a mostrarse en la UI
   * (hallazgo de la auditoría). Se fija explícitamente que ambos códigos se aceptan.
   */
  it("provisionEmisor — POST .../provision-emisor acepta 200 y 409 sin lanzar", async () => {
    const mockedPost = api.post as ReturnType<typeof vi.fn>
    mockedPost.mockResolvedValue({
      data: { provisioned: false, externalIssuerId: null, status: "conflict", detail: "Contactá a soporte." },
    })
    const result = await provisionEmisor()
    expect(mockedPost).toHaveBeenCalledWith(
      "/admin/invoicing/fiscal-configuration/provision-emisor",
      undefined,
      { validateStatus: expect.any(Function) },
    )
    const validateStatus = mockedPost.mock.calls[0][2].validateStatus
    expect(validateStatus(200)).toBe(true)
    expect(validateStatus(409)).toBe(true)
    expect(validateStatus(500)).toBe(false)
    expect(result.detail).toBe("Contactá a soporte.")
  })

  it("retryInvoiceEmission — POST .../orders/:orderId/emit acepta 201 y 409 sin lanzar", async () => {
    const mockedPost = api.post as ReturnType<typeof vi.fn>
    mockedPost.mockResolvedValue({ data: { emitted: false, reason: "requires_review" } })
    const outcome = await retryInvoiceEmission("order-1")
    expect(mockedPost).toHaveBeenCalledWith(
      "/admin/invoicing/orders/order-1/emit",
      undefined,
      { validateStatus: expect.any(Function) },
    )
    const validateStatus = mockedPost.mock.calls[0][2].validateStatus
    expect(validateStatus(201)).toBe(true)
    expect(validateStatus(409)).toBe(true)
    expect(validateStatus(404)).toBe(false)
    expect(outcome.reason).toBe("requires_review")
  })

  it("invoiceEmissionReasonMessage — traduce motivos conocidos y nunca expone el código crudo", () => {
    expect(invoiceEmissionReasonMessage("emisor_not_provisioned")).toMatch(/asociado en Sistemas 360/)
    expect(invoiceEmissionReasonMessage("algo_nuevo_no_mapeado")).not.toMatch(/algo_nuevo_no_mapeado/)
    expect(invoiceEmissionReasonMessage(undefined)).toBe("No se pudo procesar la emisión.")
  })

  it("fetchCuitLookup — GET .../cuit-lookup/:cuit", async () => {
    mockedGet.mockResolvedValue({
      data: {
        cuitLookup: {
          cuit: "20123456786",
          razonSocial: "Restaurante Test",
          condicionIva: "RI",
          condicionIvaRaw: "Responsable Inscripto",
          domicilioFiscal: "Calle Falsa 123",
        },
      },
    })
    const result = await fetchCuitLookup("20123456786")
    expect(mockedGet).toHaveBeenCalledWith(
      "/admin/invoicing/fiscal-configuration/cuit-lookup/20123456786",
    )
    expect(result.cuitLookup.razonSocial).toBe("Restaurante Test")
  })

  /**
   * `cuitLookupErrorMessage` nunca debe devolver el `error`/`mensaje_api` crudo que viene del
   * backend (puede reflejar el mensaje interno del proveedor) — siempre un texto fijo,
   * comprensible para un restaurante.
   */
  describe("cuitLookupErrorMessage", () => {
    function axiosErrorWithStatus(status: number, rawMessage: string) {
      return {
        isAxiosError: true,
        response: { status, data: { error: rawMessage } },
        message: rawMessage,
      }
    }

    it("mapea 400/404/409 a mensajes fijos, sin exponer el texto crudo del backend", () => {
      expect(cuitLookupErrorMessage(axiosErrorWithStatus(400, "cuit invalido segun arca"))).toBe(
        "El CUIT ingresado no es válido.",
      )
      expect(
        cuitLookupErrorMessage(axiosErrorWithStatus(404, "no existe en el padron interno")),
      ).toMatch(/No encontramos ese CUIT/)
      expect(
        cuitLookupErrorMessage(axiosErrorWithStatus(409, "token de cuenta no configurado")),
      ).toMatch(/no está disponible/)

      for (const status of [400, 404, 409]) {
        expect(cuitLookupErrorMessage(axiosErrorWithStatus(status, "mensaje interno secreto"))).not.toMatch(
          /mensaje interno secreto/,
        )
      }
    })

    it("devuelve un mensaje genérico para 502/errores de red, sin exponer el detalle técnico", () => {
      expect(cuitLookupErrorMessage(axiosErrorWithStatus(502, "sistemas360 fallo interno xyz"))).not.toMatch(
        /sistemas360 fallo interno xyz/,
      )
      expect(cuitLookupErrorMessage(new TypeError("network down"))).toMatch(/no se pudo consultar/i)
    })
  })

  /**
   * `provisioning` solo viene en la respuesta de `saveFiscalConfiguration` (PUT) — el backend lo
   * agrega como segunda operación tras guardar (`provisionAfterFiscalSave`). Se fija el contrato
   * EXACTO contra lo que devuelve `putFiscalConfigurationHandler`.
   */
  it("saveFiscalConfiguration — PUT devuelve fiscalConfiguration junto con el resultado del aprovisionamiento", async () => {
    mockedPut.mockResolvedValue({
      data: {
        fiscalConfiguration: { id: "fc-1", cuit: "20123456786" },
        provisioning: { outcome: "provisioned", detail: "Emisor creado." },
      },
    })
    const result = await saveFiscalConfiguration({
      cuit: "20123456786",
      razonSocial: "Test",
      condicionIva: "RI",
      domicilioFiscal: "Calle 123",
      autoIssueOnline: true,
      autoIssueCash: false,
    })
    expect(result.provisioning).toEqual({ outcome: "provisioned", detail: "Emisor creado." })
  })
})

describe("deriveBillingReadiness", () => {
  function buildConfig(overrides: Partial<FiscalConfiguration> = {}): FiscalConfiguration {
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

  it("sin configuración, o con datos fiscales incompletos, es 'pending_data'", () => {
    expect(deriveBillingReadiness(null)).toBe("pending_data")
    expect(deriveBillingReadiness(buildConfig({ razon_social: "" }))).toBe("pending_data")
    expect(deriveBillingReadiness(buildConfig({ condicion_iva: null }))).toBe("pending_data")
  })

  it("datos completos pero sin emisor asociado es 'provisioning'", () => {
    expect(deriveBillingReadiness(buildConfig())).toBe("provisioning")
  })

  it("emisor asociado (external_issuer_id) es 'ready', sin importar el resultado transitorio", () => {
    expect(deriveBillingReadiness(buildConfig({ external_issuer_id: "99" }))).toBe("ready")
    expect(
      deriveBillingReadiness(buildConfig({ external_issuer_id: "99" }), {
        outcome: "requires_attention",
        detail: "no debería pesar más que tener un emisor ya asociado",
      }),
    ).toBe("ready")
  })

  it("'requires_attention' del último guardado se refleja solo si todavía no hay emisor asociado", () => {
    expect(
      deriveBillingReadiness(buildConfig(), { outcome: "requires_attention", detail: "Conflicto." }),
    ).toBe("requires_attention")
  })

  it("'pending' del último guardado no cambia el estado derivado (sigue 'provisioning')", () => {
    expect(
      deriveBillingReadiness(buildConfig(), { outcome: "pending", detail: "Reintentando." }),
    ).toBe("provisioning")
  })
})
