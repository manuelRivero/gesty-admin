"use client"

import * as React from "react"
import Link from "next/link"
import { ClipboardList, Search, ShoppingBag, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import { cn } from "@/lib/utils"

import type { PublicFulfillment } from "@/lib/requests/public-fulfillment"

import { CartSheet } from "./cart-sheet"
import { CategoryTags } from "./category-tags"
import { ProductCard } from "./product-card"
import { ShoppingCartProvider, useShoppingCart } from "./shopping-cart-context"
import { isDeliveryFulfillment } from "./takeaway-status"
import type { ShoppingCatalog } from "./types"
import { useActiveShoppingOrder } from "./use-active-shopping-order"

export function ShoppingNotFound({ slug }: { slug: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Local no encontrado</h1>
      <p className="text-muted-foreground text-sm">
        No hay un negocio disponible con{" "}
        <span className="text-foreground font-medium">{slug}</span>.
      </p>
    </div>
  )
}

export function ShoppingLoadError({
  message,
  slug,
}: {
  message?: string
  slug: string
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        No se pudo cargar el menú
      </h1>
      <p className="text-muted-foreground text-sm">
        {message?.trim() ||
          "Revisá la conexión o intentá de nuevo en unos minutos."}
      </p>
      <Button type="button" variant="outline" asChild>
        <a href={`/shopping/${encodeURIComponent(slug)}`}>Reintentar</a>
      </Button>
    </div>
  )
}

function ShoppingPageContent({
  catalog,
  slug,
  fulfillment,
}: {
  catalog: ShoppingCatalog
  slug: string
  fulfillment: PublicFulfillment
}) {
  const { business, categories, products } = catalog
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<
    string | null
  >(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [cartOpen, setCartOpen] = React.useState(false)
  const { itemCount, getSubtotal } = useShoppingCart()
  const activeOrder = useActiveShoppingOrder(slug)

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredProducts = products.filter((p) => {
    if (selectedCategoryId && p.categoryId !== selectedCategoryId) return false
    if (!normalizedQuery) return true
    const name = p.name.toLowerCase()
    const description = (p.description ?? "").toLowerCase()
    return name.includes(normalizedQuery) || description.includes(normalizedQuery)
  })

  const productsByCategory = categories
    .map((category) => ({
      category,
      products: filteredProducts.filter((p) => p.categoryId === category.id),
    }))
    .filter((group) => group.products.length > 0)

  const subtotal = getSubtotal(products)
  const hasItems = itemCount > 0
  const isClosed = business.isOpen === false
  const activeOrderReady = (() => {
    if (!activeOrder) return false
    const status = activeOrder.status.trim().toLowerCase()
    if (isDeliveryFulfillment(activeOrder.fulfillmentType)) {
      return status === "shipped"
    }
    return status === "ready_for_pickup" || status === "shipped"
  })()

  const emptyMessage = normalizedQuery
    ? `No encontramos productos para “${searchQuery.trim()}”.`
    : selectedCategoryId
      ? "No hay productos en esta categoría."
      : "No hay productos disponibles."


  return (
    <div className="bg-background mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="bg-background/95 sticky top-0 z-20 border-b backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {business.name}
            </h1>
            {business.tagline ? (
              <p className="text-muted-foreground text-sm">{business.tagline}</p>
            ) : null}
            {isClosed ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Cerrado ahora
                {business.nextOpenText
                  ? ` · ${business.nextOpenText}`
                  : null}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeOrder ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="relative"
                asChild
              >
                <Link
                  href={`/shopping/${encodeURIComponent(slug)}/orders/${encodeURIComponent(activeOrder.orderId)}`}
                  aria-label="Ver estado del pedido"
                >
                  <ClipboardList className="size-5" />
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 size-2.5 rounded-full",
                      activeOrderReady
                        ? "bg-emerald-500"
                        : "bg-primary animate-pulse",
                    )}
                  />
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative"
              aria-label="Abrir carrito"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag className="size-5" />
              {hasItems ? (
                <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
        <div className="space-y-3 px-4 pb-3">
          <CategoryTags
            categories={categories}
            selectedId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
          />
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos…"
              aria-label="Buscar productos por nombre"
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
      </header>

      <main className={`flex-1 px-4 ${hasItems ? "pb-28" : "pb-8"}`}>
        {productsByCategory.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {emptyMessage}
          </p>
        ) : (
          productsByCategory.map(({ category, products: groupProducts }) => (
            <section key={category.id} className="pt-4">
              {!selectedCategoryId ? (
                <h2 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                  {category.name}
                </h2>
              ) : null}
              <div>
                {groupProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {hasItems ? (
        <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex w-full max-w-lg gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              size="lg"
              className="h-12 w-full justify-between px-4 text-base"
              onClick={() => setCartOpen(true)}
            >
              <span className="flex items-center gap-2">
                <span className="bg-primary-foreground/20 flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                  {itemCount}
                </span>
                Ver carrito
              </span>
              <span className="font-semibold tabular-nums">
                {formatMenuItemPrice(subtotal, business.currencyCode)}
              </span>
            </Button>
          </div>
        </div>
      ) : null}

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        products={products}
        slug={slug}
        fulfillment={fulfillment}
        mapCenter={
          catalog.business.mapCenter ?? fulfillment.mapCenter ?? null
        }
        currencyCode={business.currencyCode}
      />
    </div>
  )
}

type ShoppingPageProps = {
  catalog: ShoppingCatalog
  slug: string
  fulfillment: PublicFulfillment
}

export function ShoppingPage({
  catalog,
  slug,
  fulfillment,
}: ShoppingPageProps) {
  return (
    <ShoppingCartProvider key={catalog.business.id}>
      <ShoppingPageContent
        catalog={catalog}
        slug={slug}
        fulfillment={fulfillment}
      />
    </ShoppingCartProvider>
  )
}
