import type { Metadata } from "next"
import { isAxiosError } from "axios"

import {
  ShoppingLoadError,
  ShoppingNotFound,
  ShoppingPage,
} from "@/components/shopping/shopping-page"
import {
  DEFAULT_PUBLIC_FULFILLMENT,
  fetchPublicStorefrontFulfillment,
} from "@/lib/requests/public-fulfillment"
import {
  fetchPublicStorefrontMenu,
  PublicStorefrontNotFoundError,
} from "@/lib/requests/public-storefront"

type ShoppingSlugPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: ShoppingSlugPageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const catalog = await fetchPublicStorefrontMenu(slug)
    return {
      title: `Pedir · ${catalog.business.name}`,
      description:
        catalog.business.tagline ??
        `Armá tu pedido en ${catalog.business.name}`,
    }
  } catch {
    return {
      title: "Shopping",
      description: "Armá tu pedido online",
    }
  }
}

export default async function ShoppingSlugPage({
  params,
}: ShoppingSlugPageProps) {
  const { slug } = await params

  try {
    const [catalog, fulfillment] = await Promise.all([
      fetchPublicStorefrontMenu(slug),
      fetchPublicStorefrontFulfillment(slug).catch(() => null),
    ])
    return (
      <ShoppingPage
        catalog={catalog}
        slug={slug}
        fulfillment={fulfillment ?? DEFAULT_PUBLIC_FULFILLMENT}
      />
    )
  } catch (error) {
    if (error instanceof PublicStorefrontNotFoundError) {
      return <ShoppingNotFound slug={slug} />
    }

    const message = isAxiosError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : undefined

    return <ShoppingLoadError slug={slug} message={message} />
  }
}
