export type UserRole =
  | "STAFF"
  | "DELIVERY"
  | "ADMIN"
  | "MANAGER"
  | "OWNER"
  | "SUPER_ADMIN"
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
