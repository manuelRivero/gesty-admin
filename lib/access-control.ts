export type UserRole =
  | "STAFF"
  | "DELIVERY"
  | "ADMIN"
  | "MANAGER"
  | "OWNER"
  | "SUPER_ADMIN"
  | "MOZO"
  | "UNKNOWN"

/** Home del panel super-admin (listado de negocios). */
export const SUPER_ADMIN_HOME = "/super-admin/businesses"

function normalizeRole(raw: unknown): UserRole {
  if (typeof raw !== "string") return "UNKNOWN"
  const role = raw.trim().toUpperCase().replace(/-/g, "_")
  if (role === "STAFF") return "STAFF"
  if (role === "DELIVERY") return "DELIVERY"
  if (role === "ADMIN") return "ADMIN"
  if (role === "MANAGER") return "MANAGER"
  if (role === "OWNER") return "OWNER"
  if (role === "SUPER_ADMIN") return "SUPER_ADMIN"
  if (role === "MOZO") return "MOZO"
  return "UNKNOWN"
}

export function resolveUserRole(payload: Record<string, unknown>): UserRole {
  const directRole = normalizeRole(payload.role)
  if (directRole !== "UNKNOWN") return directRole

  const nestedUser = payload.user
  if (nestedUser && typeof nestedUser === "object") {
    const nestedRole = normalizeRole((nestedUser as Record<string, unknown>).role)
    if (nestedRole !== "UNKNOWN") return nestedRole
  }

  const realmAccess = payload.realm_access
  if (realmAccess && typeof realmAccess === "object") {
    const roles = (realmAccess as Record<string, unknown>).roles
    if (
      Array.isArray(roles) &&
      roles.some(
        (item) =>
          String(item).toUpperCase().replace(/-/g, "_") === "SUPER_ADMIN",
      )
    ) {
      return "SUPER_ADMIN"
    }
    if (Array.isArray(roles) && roles.some((item) => String(item).toUpperCase() === "STAFF")) {
      return "STAFF"
    }
    if (Array.isArray(roles) && roles.some((item) => String(item).toUpperCase() === "DELIVERY")) {
      return "DELIVERY"
    }
    if (Array.isArray(roles) && roles.some((item) => String(item).toUpperCase() === "OWNER")) {
      return "OWNER"
    }
  }

  return "UNKNOWN"
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const isSuperAdminArea =
    pathname === "/super-admin" || pathname.startsWith("/super-admin/")

  if (isSuperAdminArea) {
    return role === "SUPER_ADMIN"
  }

  if (role === "SUPER_ADMIN") {
    return false
  }

  if (role === "STAFF") {
    return pathname === "/check-in" || pathname.startsWith("/check-in/")
  }

  if (role === "DELIVERY") {
    return pathname === "/delivery" || pathname.startsWith("/delivery/")
  }

  // Fase 8.1 + decisión posterior: MOZO es exclusivo de mesas/comandas
  // (POS_TECHNICAL_DESIGN.md §4.F) — ni ADMIN ni OWNER operan /pos /kds
  // (ver abajo), y MOZO no tiene acceso a ninguna otra pantalla del panel,
  // mismo criterio que STAFF/DELIVERY arriba.
  if (role === "MOZO") {
    return (
      pathname === "/pos" ||
      pathname.startsWith("/pos/") ||
      pathname === "/kds" ||
      pathname.startsWith("/kds/")
    )
  }

  if (pathname === "/check-in" || pathname.startsWith("/check-in/")) {
    return role === "ADMIN" || role === "MANAGER" || role === "OWNER"
  }
  if (pathname === "/delivery" || pathname.startsWith("/delivery/")) {
    return role === "DELIVERY"
  }
  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  if (pathname === "/menu-items" || pathname.startsWith("/menu-items/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  if (pathname === "/tables" || pathname.startsWith("/tables/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  // Matriz confirmada (auditoría vs. Fudo — separa "Cerrar ventas" de
  // "Cobrar mesa", nivel supervisor): ADMIN/OWNER SÍ necesitan /pos para
  // revisar el consumo y cerrar la cuenta (el backend expone lectura de
  // table-tabs a ambos, y `POST .../close` es exclusivo de ellos, no de
  // MOZO). Operar la mesa (abrir/rondas/transferir) sigue siendo exclusivo
  // de MOZO a nivel de backend aunque esta ruta esté abierta para ambos.
  if (pathname === "/pos" || pathname.startsWith("/pos/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  // KDS (comandas de cocina) no es parte de esta decisión — sigue exclusivo
  // de MOZO, ver rama arriba.
  if (pathname === "/kds" || pathname.startsWith("/kds/")) {
    return false
  }
  if (pathname === "/hours" || pathname.startsWith("/hours/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  if (pathname === "/reservation-slots" || pathname.startsWith("/reservation-slots/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  if (pathname === "/my-business" || pathname.startsWith("/my-business/")) {
    return role === "OWNER"
  }
  if (pathname === "/billing" || pathname.startsWith("/billing/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  if (pathname === "/invoicing" || pathname.startsWith("/invoicing/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  if (pathname === "/online-payments" || pathname.startsWith("/online-payments/")) {
    return role === "ADMIN" || role === "OWNER"
  }

  if (pathname === "/payment-method-configs" || pathname.startsWith("/payment-method-configs/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  if (pathname === "/promotions" || pathname.startsWith("/promotions/")) {
    return role === "ADMIN" || role === "OWNER"
  }
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return role === "ADMIN" || role === "OWNER"
  }

  return true
}

export function defaultPathForRole(role: UserRole): string {
  if (role === "STAFF") return "/check-in"
  if (role === "DELIVERY") return "/delivery"
  if (role === "SUPER_ADMIN") return SUPER_ADMIN_HOME
  if (role === "MOZO") return "/pos"
  return "/"
}

/**
 * Tras login: respeta `from` solo si el rol puede acceder a esa ruta;
 * si no, envía al home del rol.
 */
export function resolvePostLoginDestination(
  role: UserRole,
  fromParam: string | null | undefined,
): string {
  const from =
    fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//")
      ? fromParam
      : null
  if (from && canAccessPath(role, from)) {
    return from
  }
  return defaultPathForRole(role)
}
