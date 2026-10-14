import { api } from "@/lib/api"

/** Relativo a `NEXT_PUBLIC_API` (p. ej. `…/api` → `/admin/business`). */
export const ADMIN_BUSINESS_PROFILE_PATH = "/admin/business"

export interface AdminBusinessProfile {
  id: string
  name: string
  description: string | null
  street_address: string | null
  address_notes: string | null
  latitude: number | null
  longitude: number | null
  timezone: string
  slug: string | null
  category: string | null
  currency_code: string
  is_active: boolean
}

export type AdminBusinessProfilePatch = Partial<{
  name: string
  description: string | null
  street_address: string | null
  address_notes: string | null
  latitude: number | null
  longitude: number | null
  timezone: string
  slug: string
  category: string | null
}>

export async function fetchAdminBusinessProfile(): Promise<AdminBusinessProfile> {
  const { data } = await api.get<AdminBusinessProfile>(ADMIN_BUSINESS_PROFILE_PATH)
  return data
}

export async function patchAdminBusinessProfile(
  payload: AdminBusinessProfilePatch,
): Promise<AdminBusinessProfile> {
  const { data } = await api.patch<AdminBusinessProfile>(
    ADMIN_BUSINESS_PROFILE_PATH,
    payload,
  )
  return data
}
