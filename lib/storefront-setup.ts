import { fetchAdminMenuItems } from "@/lib/requests/menu-items"

export type StorefrontSetupConfigSnapshot = {
  storefront_enabled: boolean
  orders_enabled: boolean
  takeaway_enabled: boolean
}

export type StorefrontSetupStepId =
  | "slug"
  | "menu"
  | "orders"
  | "takeaway"

export type StorefrontSetupStep = {
  id: StorefrontSetupStepId
  label: string
  description: string
  href: string
  done: boolean
}

export type StorefrontSetupStatus = {
  storefrontEnabled: boolean
  hasSlug: boolean
  hasActiveMenu: boolean
  ordersEnabled: boolean
  takeawayEnabled: boolean
  /** Storefront on + slug: el link público es compartible. */
  canShareLink: boolean
  /** Pedidos web listos (menú + orders + takeaway). */
  canTakeWebOrders: boolean
  steps: StorefrontSetupStep[]
}

export function buildStorefrontPublicPath(slug: string): string {
  return `/shopping/${encodeURIComponent(slug.trim())}`
}

/** URL absoluta para copiar/abrir (mismo origen del panel). */
export function buildStorefrontPublicUrl(slug: string): string {
  const path = buildStorefrontPublicPath(slug)
  if (typeof window === "undefined") return path
  return `${window.location.origin}${path}`
}

export function buildStorefrontSetupStatus(params: {
  config: StorefrontSetupConfigSnapshot
  slug: string | null | undefined
  hasActiveMenu: boolean
}): StorefrontSetupStatus {
  const hasSlug = Boolean(params.slug?.trim())
  const storefrontEnabled = params.config.storefront_enabled
  const ordersEnabled = params.config.orders_enabled
  const takeawayEnabled = params.config.takeaway_enabled
  const canShareLink = storefrontEnabled && hasSlug
  const canTakeWebOrders =
    params.hasActiveMenu && ordersEnabled && takeawayEnabled

  const steps: StorefrontSetupStep[] = [
    {
      id: "slug",
      label: "Definir slug del local",
      description: "Necesario para la URL pública /shopping/{slug}",
      href: "/my-business",
      done: hasSlug,
    },
    {
      id: "menu",
      label: "Menú disponible",
      description: "Al menos un producto disponible en la carta",
      href: "/menu-items",
      done: params.hasActiveMenu,
    },
    {
      id: "orders",
      label: "Habilitar pedidos",
      description: "Capacidad operativa de pedidos del local",
      href: "/settings#pedidos",
      done: ordersEnabled,
    },
    {
      id: "takeaway",
      label: "Habilitar retiro en local",
      description: "El storefront usa takeaway / autoservicio en el local",
      href: "/settings#entrega",
      done: takeawayEnabled,
    },
  ]

  return {
    storefrontEnabled,
    hasSlug,
    hasActiveMenu: params.hasActiveMenu,
    ordersEnabled,
    takeawayEnabled,
    canShareLink,
    canTakeWebOrders,
    steps,
  }
}

export async function fetchStorefrontSetupPrerequisites(params: {
  config: StorefrontSetupConfigSnapshot
  slug: string | null | undefined
}): Promise<StorefrontSetupStatus> {
  const menu = await fetchAdminMenuItems({
    page: 1,
    pageSize: 1,
    includeUnavailable: false,
  })
  const hasActiveMenu = menu.total > 0 || menu.items.length > 0
  return buildStorefrontSetupStatus({
    config: params.config,
    slug: params.slug,
    hasActiveMenu,
  })
}
