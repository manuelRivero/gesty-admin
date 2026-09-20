"use client"

import * as React from "react"
import Link from "next/link"
import { ClipboardList, ShoppingBag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import { cn } from "@/lib/utils"

import { CartSheet } from "./cart-sheet"
import { CategoryTags } from "./category-tags"
import { ProductCard } from "./product-card"
import { ShoppingCartProvider, useShoppingCart } from "./shopping-cart-context"
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
}: {
  catalog: ShoppingCatalog
  slug: string
}) {
  const { business, categories, products } = catalog
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<
    string | null
  >(null)
  const [cartOpen, setCartOpen] = React.useState(false)
  const { itemCount, getSubtotal } = useShoppingCart()
  const activeOrder = useActiveShoppingOrder(slug)

  const filteredProducts = selectedCategoryId
    ? products.filter((p) => p.categoryId === selectedCategoryId)
    : products

  const productsByCategory = categories
    .map((category) => ({
      category,
      products: filteredProducts.filter((p) => p.categoryId === category.id),
    }))
    .filter((group) => group.products.length > 0)

  const subtotal = getSubtotal(products)
  const hasItems = itemCount > 0
  const isClosed = business.isOpen === false
  const activeOrderReady =
    activeOrder?.status.trim().toLowerCase() === "ready_for_pickup"

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
                  href={`/shopping/${encodeURIComponent(slug)}/order/${encodeURIComponent(activeOrder.orderId)}`}
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
        <div className="px-4 pb-3">
          <CategoryTags
            categories={categories}
            selectedId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
          />
        </div>
      </header>

      <main className={`flex-1 px-4 ${hasItems ? "pb-28" : "pb-8"}`}>
        {productsByCategory.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No hay productos en esta categoría.
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
      />
    </div>
  )
}

type ShoppingPageProps = {
  catalog: ShoppingCatalog
  slug: string
}

export function ShoppingPage({ catalog, slug }: ShoppingPageProps) {
  return (
    <ShoppingCartProvider key={catalog.business.id}>
      <ShoppingPageContent catalog={catalog} slug={slug} />
    </ShoppingCartProvider>
  )
}
