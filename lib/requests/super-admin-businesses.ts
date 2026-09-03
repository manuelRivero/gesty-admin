import { isAxiosError } from "axios"

import { api } from "@/lib/api"
import type {
  BusinessWithSubscription,
  Subscription,
} from "@/components/super-admin/types"

/** Relativo a `NEXT_PUBLIC_API` (p. ej. `http://host/api` → `/super-admin/businesses`). */
export const SUPER_ADMIN_BUSINESSES_PATH = "/super-admin/businesses"

export interface FetchSuperAdminBusinessesParams {
  offset?: number
  limit?: number
  /** Filtro por nombre (contiene, case-insensitive). */
  q?: string
}

export interface SuperAdminBusinessesListResponse {
  items: BusinessWithSubscription[]
  total: number
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function mapSuperAdminBusiness(raw: unknown): BusinessWithSubscription {
  const row = (raw ?? {}) as Record<string, unknown>
  const subRaw = (row.subscription ?? {}) as Record<string, unknown>
  const subscription: Subscription = {
    plan_name: asString(subRaw.plan_name, "Trial") as Subscription["plan_name"],
    current_period_start: asString(subRaw.current_period_start),
    current_period_end: asString(subRaw.current_period_end),
    status: asString(subRaw.status, "canceled") as Subscription["status"],
  }
  return {
    id: asString(row.id),
    name: asString(row.name),
    ai_blocked: asBoolean(row.ai_blocked),
    ai_monthly_tokens_used: asNumber(row.ai_monthly_tokens_used),
    ai_monthly_token_limit: asNumber(row.ai_monthly_token_limit),
    created_at: asString(row.created_at),
    has_subscription_row: asBoolean(row.has_subscription_row),
    access_ok: asBoolean(row.access_ok),
    is_trial: asBoolean(row.is_trial),
    trial_end:
      typeof row.trial_end === "string" || row.trial_end === null
        ? (row.trial_end as string | null)
        : null,
    subscription,
  }
}

export interface CreateSuperAdminBusinessOwnerInput {
  email: string
  name: string
  password?: string
}

export interface CreateSuperAdminBusinessPayload {
  name: string
  timezone?: string
  slug?: string
  currency_code?: string
  street_address?: string
  description?: string
  trial_days?: number
  owner: CreateSuperAdminBusinessOwnerInput
}

export interface SuperAdminBusinessOwner {
  user_id: string
  email: string
  name: string | null
  created: boolean
}

export interface CreateSuperAdminBusinessResponse extends BusinessWithSubscription {
  owner: SuperAdminBusinessOwner
}

export type CreateBusinessErrorCode =
  | "PASSWORD_REQUIRED"
  | "SLUG_TAKEN"
  | "CURRENCY_INVALID"
  | "EMAIL_INVALID"

function mapOwner(raw: unknown): SuperAdminBusinessOwner {
  const row = (raw ?? {}) as Record<string, unknown>
  return {
    user_id: asString(row.user_id),
    email: asString(row.email),
    name: typeof row.name === "string" ? row.name : null,
    created: asBoolean(row.created),
  }
}

export async function createSuperAdminBusiness(
  payload: CreateSuperAdminBusinessPayload,
): Promise<CreateSuperAdminBusinessResponse> {
  const { data } = await api.post<unknown>(SUPER_ADMIN_BUSINESSES_PATH, payload)
  const row = (data ?? {}) as Record<string, unknown>
  return {
    ...mapSuperAdminBusiness(data),
    owner: mapOwner(row.owner),
  }
}

export function createBusinessErrorMessage(err: unknown): string {
  if (!isAxiosError(err)) {
    return "No se pudo crear el negocio."
  }
  const data = err.response?.data as
    | {
        code?: string
        error?: string
        message?: string
        details?: unknown
      }
    | undefined

  const code = data?.code
  if (code === "PASSWORD_REQUIRED") {
    return "Ese email es nuevo: necesitás una contraseña (mín. 8 caracteres)."
  }
  if (code === "SLUG_TAKEN") {
    return "Ese slug ya está en uso. Probá otro o dejalo vacío."
  }
  if (code === "CURRENCY_INVALID") {
    return "Código de moneda inválido."
  }
  if (code === "EMAIL_INVALID") {
    return "Email del dueño inválido."
  }

  if (data?.error && typeof data.error === "string") return data.error
  if (data?.message && typeof data.message === "string") return data.message
  return err.message || "No se pudo crear el negocio."
}

export async function fetchSuperAdminBusinesses(
  params: FetchSuperAdminBusinessesParams = {},
): Promise<SuperAdminBusinessesListResponse> {
  const offset = Math.max(0, params.offset ?? 0)
  const limit = Math.min(500, Math.max(1, params.limit ?? 100))
  const { data } = await api.get<{ items?: unknown[]; total?: number }>(
    SUPER_ADMIN_BUSINESSES_PATH,
    {
      params: {
        offset,
        limit,
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      },
    },
  )
  return {
    items: Array.isArray(data.items)
      ? data.items.map(mapSuperAdminBusiness)
      : [],
    total: Number.isFinite(data.total) ? Number(data.total) : 0,
  }
}

export async function fetchSuperAdminBusinessById(
  id: string,
): Promise<BusinessWithSubscription> {
  const { data } = await api.get<unknown>(
    `${SUPER_ADMIN_BUSINESSES_PATH}/${encodeURIComponent(id)}`,
  )
  return mapSuperAdminBusiness(data)
}
