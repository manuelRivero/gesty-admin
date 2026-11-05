import { isAxiosError } from "axios"

import { api } from "@/lib/api"

/**
 * Contratos del módulo de facturación electrónica de `gesty-backend`
 * (`src/controllers/adminInvoicing.controller.ts`, rutas en
 * `src/routes/adminOrders.routes.ts` bajo `/invoicing/*`). Reflejan la forma
 * REAL de las respuestas (incluye los nombres `snake_case` de Prisma: el
 * backend no los transforma a camelCase en estos endpoints). No inventar
 * campos que el backend no devuelve.
 */

export const ADMIN_INVOICING_FISCAL_CONFIG_PATH =
  "/admin/invoicing/fiscal-configuration"
export const ADMIN_INVOICING_ISSUER_CONNECTIVITY_PATH =
  "/admin/invoicing/fiscal-configuration/issuer-connectivity"
export const ADMIN_INVOICING_ADDON_PATH = "/admin/invoicing/addon"
export const ADMIN_INVOICING_USAGE_PATH = "/admin/invoicing/usage"
export const ADMIN_INVOICING_INVOICES_PATH = "/admin/invoicing/invoices"
export const ADMIN_INVOICING_PROVISION_EMISOR_PATH =
  "/admin/invoicing/fiscal-configuration/provision-emisor"
export const ADMIN_INVOICING_CUIT_LOOKUP_PATH =
  "/admin/invoicing/fiscal-configuration/cuit-lookup"
export const ADMIN_INVOICING_ARCA_HEALTH_PATH = "/admin/invoicing/arca-health"

export async function fetchAdminArcaHealth(): Promise<{ ok: boolean; status: number }> {
  const { data } = await api.get(ADMIN_INVOICING_ARCA_HEALTH_PATH)
  return data
}

export function adminInvoiceOrderPdfPath(orderId: string, invoiceId: string): string {
  return `/admin/invoicing/orders/${orderId}/invoices/${invoiceId}/pdf`
}
export function adminInvoiceOrderEmitPath(orderId: string): string {
  return `/admin/invoicing/orders/${orderId}/emit`
}
export function adminCuitLookupPath(cuit: string): string {
  return `${ADMIN_INVOICING_CUIT_LOOKUP_PATH}/${cuit}`
}

export function superAdminCentralProviderConfigPath(provider: CentralBillingProvider): string {
  return `/super-admin/invoicing/providers/${provider}/config`
}
export function superAdminCentralProviderTokenPath(provider: CentralBillingProvider): string {
  return `/super-admin/invoicing/providers/${provider}/token`
}
export function superAdminCentralProviderEnvironmentPath(provider: CentralBillingProvider): string {
  return `/super-admin/invoicing/providers/${provider}/environment`
}
export function superAdminCentralProviderActivePath(provider: CentralBillingProvider): string {
  return `/super-admin/invoicing/providers/${provider}/active`
}
export function superAdminCentralProviderValidatePath(provider: CentralBillingProvider): string {
  return `/super-admin/invoicing/providers/${provider}/validate`
}
export function superAdminCentralProviderArcaHealthPath(provider: CentralBillingProvider): string {
  return `/super-admin/invoicing/providers/${provider}/arca-health`
}

export type FiscalConfigStatus =
  | "not_configured"
  | "pending_validation"
  | "validated"
  | "rejected"

export interface FiscalConfiguration {
  id: string
  business_id: string
  cuit: string | null
  razon_social: string | null
  condicion_iva: string | null
  domicilio_fiscal: string | null
  punto_venta: number | null
  auto_issue_online: boolean
  auto_issue_cash: boolean
  status: FiscalConfigStatus
  validated_at: string | null
  external_issuer_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Resultado del aprovisionamiento automático que dispara el backend como segunda operación
 * tras `PUT /fiscal-configuration` (`provisionAfterFiscalSave`, `emisorProvisioning.service.ts`).
 * `provisioned`: el emisor quedó asociado. `pending`: fallo recuperable (proveedor caído, lock
 * ocupado, o Gesty todavía no configuró el token central) — se reintenta solo, nunca requiere
 * volver a ingresar datos. `requires_attention`: conflicto real (p. ej. el emisor ya pertenece a
 * otro negocio) — necesita soporte. Solo viene en la respuesta del PUT, no en el GET: tras
 * recargar la página no hay señal transitoria, por eso `deriveBillingReadiness` no distingue
 * `pending` de `requires_attention` sin este campo (limitación conocida, ver auditoría).
 */
export type FiscalProvisioningOutcome = "provisioned" | "pending" | "requires_attention"

export interface FiscalProvisioningSummary {
  outcome: FiscalProvisioningOutcome
  detail: string | null
}

export interface FiscalConfigurationResponse {
  fiscalConfiguration: FiscalConfiguration | null
  /** Solo presente en la respuesta de `saveFiscalConfiguration` (PUT), nunca en el GET. */
  provisioning?: FiscalProvisioningSummary
}

export interface UpsertFiscalConfigurationInput {
  cuit: string
  razonSocial: string
  condicionIva: string
  domicilioFiscal: string
  autoIssueOnline: boolean
  autoIssueCash: boolean
}

/**
 * `BillingProvider.getIssuerStatus()` normalizado — ver
 * `src/domain/invoicing/types.ts` del backend. `status` NUNCA debe leerse
 * como "AFIP/ARCA confirmó el emisor": se mantiene separado del estado
 * fiscal persistido del negocio (ver `detail`).
 */
export interface IssuerStatusResult {
  status: "not_configured" | "pending_validation" | "validated" | "rejected"
  externalIssuerId: string | null
  detail: string | null
}

export interface IssuerConnectivityResponse {
  credentialsShapeValid: boolean
  credentialErrors: string[]
  issuerStatus: IssuerStatusResult | null
}

export interface InvoicingAddon {
  id: string
  business_id: string
  enabled: boolean
  monthly_voucher_limit: number | null
  /** Decimal serializado como string por Prisma; `null` = precio sin definir todavía. */
  price_per_voucher: string | null
  provider_cost_per_voucher: string | null
  currency_code: string
  activated_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoicingAddonResponse {
  addon: InvoicingAddon | null
}

export interface InvoicingUsagePeriod {
  id: string
  business_id: string
  period: string
  vouchers_authorized: number
  provider_requests: number
  provider_cost_total: string
  commercial_amount_total: string
  currency_code: string
  reconciliation_status: string
  created_at: string
  updated_at: string
}

export interface InvoicingUsageResponse {
  current: InvoicingUsagePeriod | null
  history: InvoicingUsagePeriod[]
}

export type FiscalInvoiceKind = "invoice" | "credit_note"
export type FiscalVoucherType = "A" | "B" | "C"
export type FiscalInvoiceStatus =
  | "pending"
  | "processing"
  | "authorized"
  | "rejected"
  | "failed"
  | "requires_review"
  | "cancelled"
  /** Emitido contra token/entorno de pruebas (Sistemas 360: `modo_simulacion`). Sin validez
   * fiscal real — nunca mostrar junto a "Autorizado" sin diferenciar. */
  | "simulated"

export interface FiscalInvoice {
  id: string
  business_id: string
  order_id: string
  kind: FiscalInvoiceKind
  provider: string
  idempotency_key: string
  provider_invoice_id: string | null
  voucher_type: FiscalVoucherType | null
  punto_venta: number | null
  comprobante_numero: number | null
  cae: string | null
  cae_vencimiento: string | null
  issued_at: string | null
  amount: string
  currency_code: string
  status: FiscalInvoiceStatus
  pdf_url: string | null
  error_message: string | null
  retry_count: number
  created_at: string
  updated_at: string
}

export interface InvoicesListResponse {
  invoices: FiscalInvoice[]
}

export async function fetchFiscalConfiguration(): Promise<FiscalConfigurationResponse> {
  const { data } = await api.get<FiscalConfigurationResponse>(
    ADMIN_INVOICING_FISCAL_CONFIG_PATH,
  )
  return data
}

export async function saveFiscalConfiguration(
  input: UpsertFiscalConfigurationInput,
): Promise<FiscalConfigurationResponse> {
  const { data } = await api.put<FiscalConfigurationResponse>(
    ADMIN_INVOICING_FISCAL_CONFIG_PATH,
    input,
  )
  return data
}

export async function fetchIssuerConnectivity(): Promise<IssuerConnectivityResponse> {
  const { data } = await api.get<IssuerConnectivityResponse>(
    ADMIN_INVOICING_ISSUER_CONNECTIVITY_PATH,
  )
  return data
}

export async function fetchInvoicingAddon(): Promise<InvoicingAddonResponse> {
  const { data } = await api.get<InvoicingAddonResponse>(
    ADMIN_INVOICING_ADDON_PATH,
  )
  return data
}

export async function saveInvoicingAddon(input: {
  enabled: boolean
  monthlyVoucherLimit?: number | null
}): Promise<InvoicingAddonResponse> {
  const { data } = await api.put<InvoicingAddonResponse>(
    ADMIN_INVOICING_ADDON_PATH,
    input,
  )
  return data
}

export async function fetchInvoicingUsage(
  period?: string,
): Promise<InvoicingUsageResponse> {
  const { data } = await api.get<InvoicingUsageResponse>(
    ADMIN_INVOICING_USAGE_PATH,
    { params: period ? { period } : undefined },
  )
  return data
}

/**
 * Lista paginada por `take`/`skip` (sin conteo total: el backend no lo
 * devuelve). El filtro por período NO existe en el backend — solo por
 * `status` — no se agrega un selector de fechas que no tenga endpoint real.
 */
export async function fetchInvoicingInvoices(options: {
  status?: FiscalInvoiceStatus
  take?: number
  skip?: number
}): Promise<InvoicesListResponse> {
  const { data } = await api.get<InvoicesListResponse>(
    ADMIN_INVOICING_INVOICES_PATH,
    { params: options },
  )
  return data
}

/**
 * Estado simplificado de "¿puede este negocio facturar?" para la vista del restaurante — NO es
 * `FiscalConfigStatus` (ese es el estado persistido, pensado para diagnóstico interno). Combina
 * si los datos fiscales están completos, si ya hay un emisor asociado (`external_issuer_id`) y,
 * cuando está disponible, el resultado transitorio del último guardado (`provisioning`, solo
 * viene en la respuesta del PUT). El restaurante nunca ve "conectividad", "token" ni "emisor" —
 * ver auditoría "Aprovisionamiento automático de emisores".
 */
export type BillingReadinessState = "pending_data" | "provisioning" | "ready" | "requires_attention"

export function deriveBillingReadiness(
  config: FiscalConfiguration | null,
  provisioning?: FiscalProvisioningSummary | null,
): BillingReadinessState {
  if (!config?.cuit?.trim() || !config?.razon_social?.trim() || !config?.condicion_iva?.trim()) {
    return "pending_data"
  }
  if (config.external_issuer_id) return "ready"
  if (provisioning?.outcome === "requires_attention") return "requires_attention"
  return "provisioning"
}

export const BILLING_READINESS_LABEL: Record<BillingReadinessState, string> = {
  pending_data: "Datos fiscales pendientes",
  provisioning: "Configurando facturación",
  ready: "Facturación lista",
  requires_attention: "Requiere atención",
}

export const FISCAL_CONFIG_STATUS_LABEL: Record<FiscalConfigStatus, string> = {
  not_configured: "Sin configurar",
  pending_validation: "Configurado (conexión no confirmada)",
  validated: "Validado",
  rejected: "Rechazado",
}

export const INVOICE_STATUS_LABEL: Record<FiscalInvoiceStatus, string> = {
  pending: "Pendiente",
  processing: "En proceso",
  authorized: "Autorizado",
  rejected: "Rechazado",
  failed: "Error",
  requires_review: "Requiere revisión",
  cancelled: "Cancelado",
  simulated: "Simulado (sin validez fiscal)",
}

export const INVOICE_KIND_LABEL: Record<FiscalInvoiceKind, string> = {
  invoice: "Factura",
  credit_note: "Nota de crédito",
}

/**
 * `CuitLookupResult` normalizado — ver `src/domain/invoicing/types.ts` del backend. Consulta de
 * solo lectura al padrón (`BillingProvider.lookupCuit`): nunca registra ni modifica un emisor.
 * `condicionIvaRaw` se conserva siempre porque el mapeo a `condicionIva` es best-effort del
 * backend — si no reconoce el valor, cae en `"NO_CATEGORIZADO"` y el formulario debe exigir
 * selección manual en vez de inferir una categoría incorrecta.
 */
export interface CuitLookupResult {
  cuit: string
  razonSocial: string | null
  condicionIva: string
  condicionIvaRaw: string | null
  domicilioFiscal: string | null
}

export interface CuitLookupResponse {
  cuitLookup: CuitLookupResult
}

export async function fetchCuitLookup(cuit: string): Promise<CuitLookupResponse> {
  const { data } = await api.get<CuitLookupResponse>(adminCuitLookupPath(cuit))
  return data
}

/**
 * Mensajes fijos por código HTTP — nunca se expone el `error` crudo que devuelve el backend (que
 * puede reflejar el mensaje del proveedor) en esta consulta: debe ser comprensible para un
 * restaurante, nunca un detalle técnico.
 */
export function cuitLookupErrorMessage(err: unknown): string {
  if (!isAxiosError(err)) {
    return "No se pudo consultar el CUIT en este momento. Probá de nuevo en unos minutos."
  }
  switch (err.response?.status) {
    case 400:
      return "El CUIT ingresado no es válido."
    case 404:
      return "No encontramos ese CUIT en el padrón. Revisá que esté bien escrito o completá los datos manualmente."
    case 409:
      return "La consulta al padrón no está disponible en este momento. Completá los datos manualmente."
    default:
      return "No se pudo consultar el CUIT en este momento. Probá de nuevo en unos minutos."
  }
}

/**
 * Asociación restaurante ↔ emisor en la cuenta central de Sistemas 360.
 * `postProvisionEmisorHandler` responde 200 cuando `provisioned === true` y
 * 409 cuando falla (conflicto u otro motivo): sin `validateStatus`, axios
 * trata el 409 como excepción y el `detail` específico del backend nunca
 * llega a mostrarse. Se acepta explícitamente ambos códigos para poder leer
 * `detail` en los dos casos.
 */
export async function provisionEmisor(): Promise<{
  provisioned: boolean
  externalIssuerId: string | null
  status: string
  detail: string | null
}> {
  const { data } = await api.post(ADMIN_INVOICING_PROVISION_EMISOR_PATH, undefined, {
    validateStatus: (status) => status === 200 || status === 409,
  })
  return data
}

/** Refleja `InvoiceEmissionOutcome` de `src/services/invoicing/invoice.service.ts` del backend. */
export interface InvoiceEmissionOutcome {
  emitted: boolean
  invoice?: FiscalInvoice
  reason?: string
}

/**
 * Reintento/emisión manual de un comprobante desde el dashboard
 * (`postEmitOrderInvoiceHandler`, FASE 7). Idempotente y seguro ante doble
 * clic: el backend decide internamente si corresponde reclamar, reconciliar
 * o devolver el estado actual (advisory lock + `@@unique` por pedido) —
 * nunca duplica una emisión. Responde 201 si quedó autorizado, 409 en
 * cualquier otro desenlace (no es un error de red, es parte del contrato).
 */
export async function retryInvoiceEmission(orderId: string): Promise<InvoiceEmissionOutcome> {
  const { data } = await api.post<InvoiceEmissionOutcome>(
    adminInvoiceOrderEmitPath(orderId),
    undefined,
    { validateStatus: (status) => status === 201 || status === 409 },
  )
  return data
}

/**
 * Motivos (`reason`) que puede devolver `requestInvoiceEmission` del backend.
 * Traducidos a lenguaje no técnico para el restaurante; cualquier motivo no
 * listado cae en un mensaje genérico (nunca se expone el código crudo).
 */
export const INVOICE_EMISSION_REASON_LABEL: Record<string, string> = {
  addon_disabled: "El complemento de facturación electrónica está desactivado para este negocio.",
  order_not_found: "No se encontró el pedido asociado a este comprobante.",
  order_not_paid: "El pedido todavía no está marcado como cobrado.",
  order_total_missing: "El pedido no tiene un importe total válido.",
  unsupported_currency_requires_fx:
    "La moneda del pedido no está soportada para la emisión automática.",
  fiscal_configuration_incomplete: "Faltan completar los datos fiscales del negocio.",
  emisor_not_provisioned:
    "El emisor todavía no quedó asociado en Sistemas 360. Probá asociarlo desde Configuración fiscal.",
  provider_not_configured: "Sistemas 360 no está disponible en este momento.",
  voucher_type_undetermined:
    "No se pudo determinar el tipo de comprobante para la condición fiscal configurada.",
  line_items_build_error: "No se pudieron armar los ítems del pedido para el comprobante.",
  line_items_total_mismatch: "El importe del pedido no coincide con el detalle de ítems.",
  lock_unavailable: "El sistema está procesando otra operación para este pedido. Probá de nuevo en unos segundos.",
  fiscal_configuration_lock_unavailable:
    "El sistema está procesando otra operación para este pedido. Probá de nuevo en unos segundos.",
  persist_error_after_provider_response:
    "El proveedor respondió pero todavía no pudimos confirmar el resultado. Se va a reconciliar automáticamente.",
  provider_error_uncertain:
    "No se pudo confirmar la respuesta del proveedor todavía. Se va a reconciliar automáticamente.",
  reconciliation_error: "No se pudo confirmar el estado con el proveedor todavía.",
  in_progress: "Ya hay una emisión en curso para este pedido.",
  manual_review_required: "Este comprobante requiere revisión manual de soporte.",
  rejected: "El proveedor rechazó este comprobante.",
  authorized: "Este comprobante ya está autorizado.",
  cancelled: "Este comprobante está cancelado.",
}

export function invoiceEmissionReasonMessage(reason: string | undefined): string {
  if (!reason) return "No se pudo procesar la emisión."
  return (
    INVOICE_EMISSION_REASON_LABEL[reason] ??
    "No se pudo procesar la emisión. Probá de nuevo en unos minutos."
  )
}

/** PDF a demanda cuando el proveedor no persiste una URL pública. */
export async function fetchInvoicePdfDataUrl(orderId: string, invoiceId: string): Promise<string> {
  const { data } = await api.get<{ pdfDataUrl: string }>(adminInvoiceOrderPdfPath(orderId, invoiceId))
  return data.pdfDataUrl
}

// ---------------------------------------------------------------------------------------------
// Configuración CENTRAL de proveedor (exclusiva de SUPER_ADMIN) — ver
// `superAdminInvoicingProvider.controller.ts` / `superAdmin.routes.ts` del backend.
// ---------------------------------------------------------------------------------------------

export type CentralProviderEnvironment = "sandbox" | "production"
export type CentralBillingProvider = "sistemas360"

export interface CentralProviderConfig {
  provider: CentralBillingProvider
  activeEnvironment: CentralProviderEnvironment
  isActive: boolean
  status: FiscalConfigStatus
  lastValidatedAt: string | null
  lastValidationDetail: string | null
  lastValidatedEnvironment: CentralProviderEnvironment | null
  hasSandboxToken: boolean
  hasProductionToken: boolean
  totalRequestsCount: number
}

export async function fetchCentralProviderConfig(
  provider: CentralBillingProvider,
): Promise<{ config: CentralProviderConfig | null }> {
  const { data } = await api.get(superAdminCentralProviderConfigPath(provider))
  return data
}

export async function saveCentralProviderToken(
  provider: CentralBillingProvider,
  environment: CentralProviderEnvironment,
  token: string,
): Promise<{ config: CentralProviderConfig }> {
  const { data } = await api.put(superAdminCentralProviderTokenPath(provider), { environment, token })
  return data
}

export async function saveCentralProviderEnvironment(
  provider: CentralBillingProvider,
  environment: CentralProviderEnvironment,
): Promise<{ config: CentralProviderConfig }> {
  const { data } = await api.put(superAdminCentralProviderEnvironmentPath(provider), { environment })
  return data
}

export async function setCentralProviderActive(
  provider: CentralBillingProvider,
  isActive: boolean,
): Promise<{ config: CentralProviderConfig }> {
  const { data } = await api.put(superAdminCentralProviderActivePath(provider), { isActive })
  return data
}

export async function validateCentralProviderConnectivity(
  provider: CentralBillingProvider,
): Promise<{ config: CentralProviderConfig }> {
  const { data } = await api.post(superAdminCentralProviderValidatePath(provider))
  return data
}

export async function fetchArcaHealth(provider: CentralBillingProvider): Promise<{ ok: boolean; status: number }> {
  const { data } = await api.get(superAdminCentralProviderArcaHealthPath(provider))
  return data
}

export const SUPER_ADMIN_INVOICING_ISSUES_PATH = "/super-admin/invoicing/issues"
export const SUPER_ADMIN_INVOICING_USAGE_PATH = "/super-admin/invoicing/usage"
export const SUPER_ADMIN_INVOICING_BUSINESSES_PATH = "/super-admin/invoicing/businesses"

export interface SuperAdminInvoicingIssue {
  id: string
  business_id: string
  order_id: string
  kind: FiscalInvoiceKind
  provider: string
  provider_environment: string | null
  voucher_type: FiscalVoucherType | null
  punto_venta: number | null
  comprobante_numero: number | null
  issued_at: string | null
  amount: string
  currency_code: string
  status: Extract<FiscalInvoiceStatus, "requires_review" | "rejected" | "failed">
  error_message: string | null
  retry_count: number
  created_at: string
  updated_at: string
  business: {
    id: string
    name: string
  }
}

export interface SuperAdminInvoicingIssuesResponse {
  invoices: SuperAdminInvoicingIssue[]
}

export interface SuperAdminInvoicingUsageRow {
  id: string
  business_id: string
  period: string
  vouchers_authorized: number
  provider_requests: number
  currency_code: string
  reconciliation_status: string
  created_at: string
  updated_at: string
  business: {
    id: string
    name: string
  }
}

export interface SuperAdminInvoicingUsageResponse {
  period: string
  rows: SuperAdminInvoicingUsageRow[]
}

export interface SuperAdminInvoicingBusiness {
  id: string
  business_id: string
  enabled: boolean
  activated_at: string | null
  business: {
    id: string
    name: string
  }
}

export interface SuperAdminInvoicingBusinessesResponse {
  businesses: SuperAdminInvoicingBusiness[]
}

export async function fetchSuperAdminInvoicingIssues(): Promise<SuperAdminInvoicingIssuesResponse> {
  const { data } = await api.get<SuperAdminInvoicingIssuesResponse>(
    SUPER_ADMIN_INVOICING_ISSUES_PATH,
  )
  return data
}

export async function fetchSuperAdminInvoicingUsage(
  period?: string,
): Promise<SuperAdminInvoicingUsageResponse> {
  const { data } = await api.get<SuperAdminInvoicingUsageResponse>(
    SUPER_ADMIN_INVOICING_USAGE_PATH,
    { params: period ? { period } : undefined },
  )
  return data
}

export async function fetchSuperAdminInvoicingBusinesses(): Promise<SuperAdminInvoicingBusinessesResponse> {
  const { data } = await api.get<SuperAdminInvoicingBusinessesResponse>(
    SUPER_ADMIN_INVOICING_BUSINESSES_PATH,
  )
  return data
}
