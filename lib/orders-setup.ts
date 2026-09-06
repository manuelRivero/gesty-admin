import { fetchAdminMenuItems } from "@/lib/requests/menu-items"
import { fetchPaymentMethodConfigs } from "@/lib/requests/payment-method-configs"
import { fetchAdminPaymentProviders } from "@/lib/requests/payment-providers"

/** Snapshot de config usado para evaluar fulfillment / pedidos. */
export type OrdersSetupConfigSnapshot = {
  orders_enabled: boolean
  delivery_enabled: boolean
  takeaway_enabled: boolean
  external_delivery_enabled: boolean
}

export type OrdersSetupStepId =
  | "menu"
  | "fulfillment"
  | "payment"
  | "orders"

export type OrdersSetupStep = {
  id: OrdersSetupStepId
  label: string
  description: string
  href: string
  done: boolean
}

export type OrdersSetupStatus = {
  hasActiveMenu: boolean
  hasFulfillment: boolean
  hasOfferablePayment: boolean
  ordersEnabled: boolean
  /** Prerequisitos listos; falta solo el toggle de pedidos. */
  canEnableOrders: boolean
  /** Checklist completo (incluye pedidos habilitados). */
  isReadyToSell: boolean
  steps: OrdersSetupStep[]
}

export function hasFulfillmentCapability(config: {
  delivery_enabled: boolean
  takeaway_enabled: boolean
  external_delivery_enabled: boolean
}): boolean {
  return (
    config.delivery_enabled ||
    config.takeaway_enabled ||
    config.external_delivery_enabled
  )
}

/**
 * Espejo cliente de `listOfferedPaymentMethods` (sin filtrar por delivery externo
 * más allá de excluir cash cuando aplica): activo ∩ online con MP.
 */
export function hasOfferablePaymentMethod(params: {
  paymentMethods: Array<{ paymentMethod: string; isActive: boolean }>
  hasActiveMercadoPago: boolean
  externalDeliveryEnabled: boolean
}): boolean {
  const activeIds = params.paymentMethods
    .filter((m) => m.isActive)
    .map((m) => m.paymentMethod)

  const offerable = activeIds.filter((id) => {
    if (id === "cash" && params.externalDeliveryEnabled) return false
    if (id === "online") return params.hasActiveMercadoPago
    return id === "cash" || id === "transfer" || id === "online"
  })

  return offerable.length > 0
}

export function buildOrdersSetupStatus(params: {
  config: OrdersSetupConfigSnapshot
  hasActiveMenu: boolean
  hasOfferablePayment: boolean
}): OrdersSetupStatus {
  const hasFulfillment = hasFulfillmentCapability(params.config)
  const ordersEnabled = params.config.orders_enabled
  const canEnableOrders =
    params.hasActiveMenu && hasFulfillment && params.hasOfferablePayment
  const isReadyToSell = canEnableOrders && ordersEnabled

  const steps: OrdersSetupStep[] = [
    {
      id: "menu",
      label: "Cargar menú",
      description: "Al menos un producto disponible",
      href: "/menu-items",
      done: params.hasActiveMenu,
    },
    {
      id: "fulfillment",
      label: "Elegir fulfillment",
      description: "Delivery y/o retiro en local",
      href: "/settings#entrega",
      done: hasFulfillment,
    },
    {
      id: "payment",
      label: "Activar método de pago",
      description: "Al menos uno ofrecible (online requiere Mercado Pago)",
      href: "/payment-method-configs",
      done: params.hasOfferablePayment,
    },
    {
      id: "orders",
      label: "Habilitar pedidos",
      description: "El bot no toma pedidos hasta que actives este control",
      href: "/settings#pedidos",
      done: ordersEnabled,
    },
  ]

  return {
    hasActiveMenu: params.hasActiveMenu,
    hasFulfillment,
    hasOfferablePayment: params.hasOfferablePayment,
    ordersEnabled,
    canEnableOrders,
    isReadyToSell,
    steps,
  }
}

/** Carga menú + pagos para armar el checklist (sin mutar config). */
export async function fetchOrdersSetupPrerequisites(
  config: OrdersSetupConfigSnapshot,
): Promise<OrdersSetupStatus> {
  const [menu, paymentConfigs, providers] = await Promise.all([
    fetchAdminMenuItems({ page: 1, pageSize: 1, includeUnavailable: false }),
    fetchPaymentMethodConfigs(),
    fetchAdminPaymentProviders(),
  ])

  const hasActiveMenu = menu.total > 0 || menu.items.length > 0
  const hasActiveMercadoPago = providers.items.some(
    (p) => p.provider === "mercado_pago" && p.isActive,
  )
  const offerable = hasOfferablePaymentMethod({
    paymentMethods: paymentConfigs.map((c) => ({
      paymentMethod: c.paymentMethod,
      isActive: c.isActive,
    })),
    hasActiveMercadoPago,
    externalDeliveryEnabled: config.external_delivery_enabled,
  })

  return buildOrdersSetupStatus({
    config,
    hasActiveMenu,
    hasOfferablePayment: offerable,
  })
}

export function ordersSetupCtaCopy(status: OrdersSetupStatus): {
  title: string
  description: string
} {
  if (status.isReadyToSell) {
    return {
      title: "Pedidos habilitados",
      description:
        "El local ya puede tomar pedidos cuando el bot esté activo.",
    }
  }
  if (status.canEnableOrders) {
    return {
      title: "Ya podés habilitar pedidos",
      description:
        "Menú, fulfillment y pago están listos. Activá el toggle en Configuración — no se habilita solo.",
    }
  }
  const missing = status.steps
    .filter((s) => s.id !== "orders" && !s.done)
    .map((s) => s.label.toLowerCase())
  return {
    title: "Siguiente: completar setup de pedidos",
    description:
      missing.length > 0
        ? `Todavía falta: ${missing.join(", ")}.`
        : "Completá los pasos del checklist para poder vender.",
  }
}
