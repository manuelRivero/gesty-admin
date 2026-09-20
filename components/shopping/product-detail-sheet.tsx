"use client"

import { Minus, Plus, UtensilsCrossed, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatMenuItemPrice } from "@/lib/format-menu-price"

import { useShoppingCart } from "./shopping-cart-context"
import type { ShoppingProduct } from "./types"

type ProductDetailSheetProps = {
  product: ShoppingProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatServesPeople(n: number): string {
  return n === 1 ? "1 persona" : `${n} personas`
}

export function ProductDetailSheet({
  product,
  open,
  onOpenChange,
}: ProductDetailSheetProps) {
  const { getQuantity, addProduct, increment, decrement } = useShoppingCart()

  if (!product) return null

  const quantity = getQuantity(product.id)
  const unavailable = !product.available
  const hasExtras =
    Boolean(product.ingredients) ||
    Boolean(product.ingredientsNotes) ||
    Boolean(product.preparation) ||
    (product.variations != null && product.variations.length > 0) ||
    (product.servesPeople != null && product.servesPeople > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col gap-0 rounded-t-2xl p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{product.name}</SheetTitle>
          <SheetDescription>
            Detalle del producto para agregar al pedido
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="bg-muted relative aspect-[16/10] w-full shrink-0 overflow-hidden">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center">
                <UtensilsCrossed className="size-12" />
              </div>
            )}
          </div>

          <div className="space-y-4 px-4 pt-4 pb-2">
            <div className="space-y-1.5 pr-8">
              <h2 className="text-foreground text-xl leading-snug font-semibold tracking-tight">
                {product.name}
              </h2>
              <p className="text-foreground text-base font-semibold tabular-nums">
                {formatMenuItemPrice(product.price, product.currencyCode)}
              </p>
              {unavailable ? (
                <p className="text-muted-foreground text-sm">No disponible</p>
              ) : null}
            </div>

            {product.servesPeople != null && product.servesPeople > 0 ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Users className="size-4 shrink-0" aria-hidden />
                Porción para {formatServesPeople(product.servesPeople)}
              </p>
            ) : null}

            {product.description ? (
              <div className="space-y-1">
                <h3 className="text-foreground text-sm font-medium">
                  Descripción
                </h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            ) : null}

            {product.ingredients ? (
              <div className="space-y-1">
                <h3 className="text-foreground text-sm font-medium">
                  Ingredientes
                </h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {product.ingredients}
                </p>
              </div>
            ) : null}

            {product.ingredientsNotes ? (
              <div className="space-y-1">
                <h3 className="text-foreground text-sm font-medium">Notas</h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {product.ingredientsNotes}
                </p>
              </div>
            ) : null}

            {product.variations != null && product.variations.length > 0 ? (
              <div className="space-y-1.5">
                <h3 className="text-foreground text-sm font-medium">
                  Variaciones
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {product.variations.map((variation) => (
                    <Badge
                      key={variation}
                      variant="secondary"
                      className="font-normal"
                    >
                      {variation}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {product.preparation ? (
              <div className="space-y-1">
                <h3 className="text-foreground text-sm font-medium">
                  Preparación
                </h3>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {product.preparation}
                </p>
              </div>
            ) : null}

            {!product.description && !hasExtras ? (
              <p className="text-muted-foreground text-sm">
                Sin más detalles por ahora.
              </p>
            ) : null}
          </div>
        </div>

        <SheetFooter className="border-t px-4 py-3">
          {unavailable ? (
            <Button type="button" disabled className="w-full">
              No disponible
            </Button>
          ) : quantity === 0 ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                addProduct(product.id)
                onOpenChange(false)
              }}
            >
              <Plus className="size-4" />
              Agregar ·{" "}
              {formatMenuItemPrice(product.price, product.currencyCode)}
            </Button>
          ) : (
            <div className="flex w-full items-center gap-3">
              <div className="bg-background flex items-center gap-1 rounded-md border">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Quitar uno"
                  onClick={() => decrement(product.id)}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="min-w-8 text-center text-sm font-medium tabular-nums">
                  {quantity}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Agregar uno"
                  onClick={() => increment(product.id)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <Button
                type="button"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Listo
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
