import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { AUTH_COOKIE_NAME, getUserRoleFromToken } from "@/lib/auth"
import {
  canAccessPath,
  defaultPathForRole,
} from "@/lib/access-control"

const LOGIN_PATH = "/login"

/** Rutas públicas (sin cookie). `/login` se trata aparte por el redirect si ya hay sesión. */
const PUBLIC_PATHS = ["/shopping"] as const

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

/** Dominio exclusivo de la tienda pública (ej. shopping.gesty.online), servido sin el prefijo /shopping. Si no se define, no se restringe nada. */
const SHOP_HOST = process.env.NEXT_PUBLIC_SHOP_HOST?.trim().toLowerCase()

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (SHOP_HOST && request.headers.get("host")?.toLowerCase() === SHOP_HOST) {
    if (pathname.startsWith("/api")) {
      return NextResponse.next()
    }
    // Los links internos usan /shopping/...; en este host se normalizan a /...
    if (isPublicPath(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = pathname.slice("/shopping".length) || "/"
      return NextResponse.redirect(url, 308)
    }
    const url = request.nextUrl.clone()
    url.pathname = `/shopping${pathname === "/" ? "" : pathname}`
    return NextResponse.rewrite(url)
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    if (token) {
      const role = getUserRoleFromToken(token)
      return NextResponse.redirect(
        new URL(defaultPathForRole(role), request.url),
      )
    }
    return NextResponse.next()
  }

  if (!token) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = getUserRoleFromToken(token)
  if (!canAccessPath(role, pathname)) {
    return NextResponse.redirect(new URL(defaultPathForRole(role), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Excluir estáticos + SW de push (si no, /sw-storefront.js → /login y falla el registro).
    "/((?!api/|_next/|favicon.ico|sw-storefront\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
