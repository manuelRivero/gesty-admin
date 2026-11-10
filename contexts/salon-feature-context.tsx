"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

import { fetchSalonFeatureFlag } from "@/lib/requests/business-config"

interface SalonFeatureContextValue {
  /** Kill switch de `business_config.salon_enabled` — ver Fase 8.1. */
  salonEnabled: boolean
  isLoading: boolean
}

const SalonFeatureContext = createContext<SalonFeatureContextValue | null>(null)

/**
 * Carga `business_config.salon_enabled` UNA vez por sesión del dashboard y lo
 * expone al sidebar/rutas del módulo de salón (POS/KDS). Fail-closed: si la
 * carga falla o todavía no resolvió, `salonEnabled` es `false` — nunca se
 * muestra el módulo "por las dudas".
 */
export function SalonFeatureProvider({ children }: { children: React.ReactNode }) {
  const [salonEnabled, setSalonEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchSalonFeatureFlag()
      .then((enabled) => {
        if (active) setSalonEnabled(enabled)
      })
      .catch(() => {
        if (active) setSalonEnabled(false)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(() => ({ salonEnabled, isLoading }), [salonEnabled, isLoading])

  return <SalonFeatureContext.Provider value={value}>{children}</SalonFeatureContext.Provider>
}

export function useSalonFeature() {
  const ctx = useContext(SalonFeatureContext)
  if (!ctx) {
    throw new Error("useSalonFeature debe usarse dentro de SalonFeatureProvider")
  }
  return ctx
}
