import type { Metadata } from "next"

import { ShoppingOrderDetail } from "@/components/shopping/order-detail-page"

type ShoppingOrderPageProps = {
  params: Promise<{ slug: string; orderId: string }>
}

export async function generateMetadata({
  params,
}: ShoppingOrderPageProps): Promise<Metadata> {
  const { orderId } = await params
  return {
    title: `Pedido · ${orderId.slice(0, 8)}`,
    description: "Seguimiento de tu pedido",
  }
}

export default async function ShoppingOrderPage({
  params,
}: ShoppingOrderPageProps) {
  const { slug, orderId } = await params
  return <ShoppingOrderDetail slug={slug} orderId={orderId} />
}
