import type { Metadata } from "next"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"

import { ShoppingOrderDetail } from "@/components/shopping/order-detail-page"

type ShoppingOrdersPageProps = {
  params: Promise<{ slug: string; orderId: string }>
}

export async function generateMetadata({
  params,
}: ShoppingOrdersPageProps): Promise<Metadata> {
  const { orderId } = await params
  return {
    title: `Pedido · ${orderId.slice(0, 8)}`,
    description: "Seguimiento de tu pedido",
  }
}

export default async function ShoppingOrdersPage({
  params,
}: ShoppingOrdersPageProps) {
  const { slug, orderId } = await params
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-3 px-6">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Cargando tu pedido…</p>
        </div>
      }
    >
      <ShoppingOrderDetail slug={slug} orderId={orderId} />
    </Suspense>
  )
}
