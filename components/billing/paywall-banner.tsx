"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getUserRoleFromCookie } from "@/lib/auth"
import { fetchAiQuota } from "@/lib/requests/billing"

export function BillingPaywallBanner() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const role = getUserRoleFromCookie()
    if (role !== "OWNER" && role !== "ADMIN") {
      setShow(false)
      return
    }
    if (pathname === "/billing" || pathname.startsWith("/billing/")) {
      setShow(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const data = await fetchAiQuota()
        if (!cancelled) setShow(!data.access_ok)
      } catch {
        if (!cancelled) setShow(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pathname])

  if (!show) return null

  return (
    <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Plan inactivo — el asistente está pausado</p>
            <p className="text-destructive/90">
              Activá o renová tu suscripción para seguir operando.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 self-start sm:self-center">
          <Link href="/billing">Ir a facturación</Link>
        </Button>
      </div>
    </div>
  )
}
