import Link from "next/link"
import { Clock, Store } from "lucide-react"

import {
  businessCategoryLabel,
  type BusinessCategoryOption,
} from "@/lib/business-categories"

import type { ShoppingStorefrontSummary } from "../types"

export function StorefrontCard({
  business,
  categoryOptions,
}: {
  business: ShoppingStorefrontSummary
  categoryOptions: BusinessCategoryOption[]
}) {
  const isClosed = business.isOpen === false
  const categoryLabel = businessCategoryLabel(categoryOptions, business.category)

  return (
    <Link
      href={`/shopping/${encodeURIComponent(business.slug)}`}
      className="bg-background flex flex-col overflow-hidden rounded-xl border transition-colors hover:bg-muted/40"
    >
      <div className="bg-muted relative aspect-[16/9] w-full shrink-0 overflow-hidden">
        {business.imageUrl ? (
          <img
            src={business.imageUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center">
            <Store className="size-10" />
          </div>
        )}
        {isClosed ? (
          <span className="bg-background/90 text-muted-foreground absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur">
            Cerrado
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-foreground truncate font-medium">
          {business.name}
        </h3>
        {categoryLabel ? (
          <span className="text-muted-foreground w-fit text-xs font-medium tracking-wide uppercase">
            {categoryLabel}
          </span>
        ) : null}
        {business.tagline ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {business.tagline}
          </p>
        ) : null}
        {isClosed ? (
          <p className="text-muted-foreground mt-auto flex items-center gap-1 pt-1 text-xs">
            <Clock className="size-3.5" />
            {business.nextOpenText
              ? `Abre ${business.nextOpenText}`
              : "Cerrado ahora"}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
