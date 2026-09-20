import axios, { isAxiosError } from "axios"

import {
  clearAuthCookie,
  getAuthCookie,
} from "@/lib/auth"

export function resolveApiBaseUrl(): string | undefined {
  const raw =
    process.env.NEXT_PUBLIC_API ??
    (typeof window === "undefined" ? process.env.API : undefined)
  if (!raw?.trim()) return undefined
  return raw.replace(/\/$/, "")
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  /** Cookie HttpOnly `access_token` (si el backend la usa). */
  withCredentials: true,
})

/**
 * Cliente sin JWT ni redirect a `/login`.
 * Para storefront público (`/public/...`).
 */
export const publicApi = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use((config) => {
  const token = getAuthCookie()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      isAxiosError(error) &&
      error.response?.status === 401
    ) {
      clearAuthCookie()
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login")
      }
    }
    return Promise.reject(error)
  },
)
