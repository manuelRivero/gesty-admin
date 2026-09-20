"use client"

import { Minus, Plus, UtensilsCrossed } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import { cn } from "@/lib/utils"

import { useShoppingCart } from "./shopping-cart-context"
import type { ShoppingProduct } from "./types"

type ProductCardProps = {
  product: ShoppingProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const { getQuantity, addProduct, increment, decrement } = useShoppingCart()
  const quantity = getQuantity(product.id)
  const unavailable = !product.available

  return (
    <article
      className={cn(
        "flex gap-3 border-b border-border py-4 last:border-b-0",
        unavailable && "opacity-55",
      )}
    >
      <div className="bg-muted relative size-24 shrink-0 overflow-hidden rounded-lg sm:size-28">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center">
            <UtensilsCrossed className="size-8" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-foreground leading-snug font-medium">
            {product.name}
          </h3>
          {product.description ? (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {product.description}
            </p>
          ) : null}
          <p className="text-foreground pt-0.5 text-sm font-semibold tabular-nums">
            {formatMenuItemPrice(product.price, product.currencyCode)}
          </p>
          {unavailable ? (
            <p className="text-muted-foreground text-xs">No disponible</p>
          ) : null}
        </div>

        <div className="mt-auto flex justify-end">
          {unavailable ? null : quantity === 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5"
              onClick={() => addProduct(product.id)}
            >
              <Plus className="size-4" />
              Agregar
            </Button>
          ) : (
            <div className="bg-background flex items-center gap-1 rounded-md border">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Quitar uno"
                onClick={() => decrement(product.id)}
              >
                <Minus className="size-4" />
              </Button>
              <span className="min-w-6 text-center text-sm font-medium tabular-nums">
                {quantity}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Agregar uno"
                onClick={() => increment(product.id)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
