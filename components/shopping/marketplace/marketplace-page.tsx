"use client"

import * as React from "react"
import { Search, Store, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { BusinessCategoryOption } from "@/lib/business-categories"
import { cn } from "@/lib/utils"

import type { ShoppingStorefrontSummary } from "../types"
import { StorefrontCard } from "./storefront-card"

export function ShoppingMarketplaceLoadError({
  message,
}: {
  message?: string
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        No se pudieron cargar los locales
      </h1>
      <p className="text-muted-foreground text-sm">
        {message?.trim() ||
          "Revisá la conexión o intentá de nuevo en unos minutos."}
      </p>
      <Button type="button" variant="outline" asChild>
        <a href="/shopping">Reintentar</a>
      </Button>
    </div>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center">
      <Store className="size-10 opacity-40" />
      <p className="text-foreground font-medium">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  )
}

export function ShoppingMarketplacePage({
  businesses,
  categoryOptions,
}: {
  businesses: ShoppingStorefrontSummary[]
  categoryOptions: BusinessCategoryOption[]
}) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<
    string | null
  >(null)
  const normalizedQuery = searchQuery.trim().toLowerCase()

  // Solo categorías con al menos un local real: no se inventan chips vacíos.
  const availableCategories = categoryOptions.filter((opt) =>
    businesses.some((business) => business.category === opt.value),
  )

  const filteredBusinesses = businesses.filter((business) => {
    if (selectedCategory && business.category !== selectedCategory) {
      return false
    }
    if (!normalizedQuery) return true
    const name = business.name.toLowerCase()
    const tagline = (business.tagline ?? "").toLowerCase()
    return name.includes(normalizedQuery) || tagline.includes(normalizedQuery)
  })

  const hasActiveFilters = Boolean(normalizedQuery) || selectedCategory !== null

  return (
    <div className="bg-background mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header className="bg-background/95 sticky top-0 z-20 border-b backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 px-4 pt-4">
          <img src="/icon.svg" alt="" className="size-8 shrink-0 rounded-lg" />
          <span className="text-lg font-semibold tracking-tight">Gesty</span>
        </div>
        <div className="space-y-1 px-4 pt-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Descubrí locales y pedí online
          </h1>
          <p className="text-muted-foreground text-sm">
            Elegí un restaurante para ver su menú y armar tu pedido.
          </p>
        </div>
        <div className="px-4 pt-3 pb-4">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar un local…"
              aria-label="Buscar restaurantes por nombre"
              className="h-10 pr-9 pl-9"
            />
            {searchQuery ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearchQuery("")}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        {availableCategories.length > 0 ? (
          <div className="-mx-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  selectedCategory === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                Todas
              </button>
              {availableCategories.map((opt) => {
                const active = selectedCategory === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedCategory(opt.value)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent",
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1 px-4 pt-4 pb-10">
        {businesses.length === 0 ? (
          <EmptyState
            title="Todavía no hay locales disponibles"
            description="Volvé a intentarlo más tarde."
          />
        ) : filteredBusinesses.length === 0 ? (
          <EmptyState
            title={
              normalizedQuery
                ? `No encontramos locales para “${searchQuery.trim()}”.`
                : "No hay locales en esta categoría."
            }
            description={
              hasActiveFilters
                ? "Probá quitando el filtro o buscando otro nombre."
                : "Probá con otro nombre."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBusinesses.map((business) => (
              <StorefrontCard
                key={business.id}
                business={business}
                categoryOptions={categoryOptions}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
