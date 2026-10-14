import type { Metadata } from "next"
import { isAxiosError } from "axios"

import {
  ShoppingMarketplaceLoadError,
  ShoppingMarketplacePage,
} from "@/components/shopping/marketplace/marketplace-page"
import { fetchBusinessCategories } from "@/lib/requests/business-categories"
import { fetchPublicStorefronts } from "@/lib/requests/public-storefront"

export const metadata: Metadata = {
  title: "Gesty Shopping",
  description: "Descubrí locales y armá tu pedido online.",
}

/** Estado abierto/cerrado cambia por local y por hora: nunca cachear estático. */
export const dynamic = "force-dynamic"

export default async function ShoppingIndexPage() {
  try {
    const [businesses, categoryOptions] = await Promise.all([
      fetchPublicStorefronts(),
      fetchBusinessCategories(),
    ])
    return (
      <ShoppingMarketplacePage
        businesses={businesses}
        categoryOptions={categoryOptions}
      />
    )
  } catch (error) {
    const message = isAxiosError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : undefined
    return <ShoppingMarketplaceLoadError message={message} />
  }
}
