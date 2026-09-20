"use client"

import Link from "next/link"
import { Check, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  buildStorefrontPublicPath,
  buildStorefrontPublicUrl,
  type StorefrontSetupStatus,
} from "@/lib/storefront-setup"

type StorefrontSetupPanelProps = {
  status: StorefrontSetupStatus | null
  isLoading?: boolean
  slug: string | null
  storefrontEnabled: boolean
  className?: string
}

export function StorefrontSetupPanel({
  status,
  isLoading = false,
  slug,
  storefrontEnabled,
  className,
}: StorefrontSetupPanelProps) {
  if (isLoading || !status) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        Cargando estado de la tienda web…
      </div>
    )
  }

  if (!storefrontEnabled) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        Activá la tienda web para compartir el link del menú.
      </div>
    )
  }

  if (!status.hasSlug) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3",
          className,
        )}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">Falta el slug del local</p>
          <p className="text-sm text-muted-foreground">
            Definí un slug del local para la URL pública.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/my-business">
            Ir a Mi negocio
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      </div>
    )
  }

  const path = buildStorefrontPublicPath(slug!)
  const absoluteUrl = buildStorefrontPublicUrl(slug!)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      toast.success("Link copiado")
    } catch {
      toast.error("No se pudo copiar el link")
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="space-y-2">
        <p className="text-sm font-medium">Link público</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={absoluteUrl} className="font-mono text-xs" />
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
              <Copy className="size-3.5" />
              Copiar
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={path} target="_blank" rel="noreferrer">
                Abrir
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {status.canTakeWebOrders ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Tienda web lista para pedidos</p>
            <p className="text-sm text-muted-foreground">
              Menú, pedidos y retiro en local están activos. Compartí el link con
              tus clientes.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Para tomar pedidos por la web</p>
            <p className="text-sm text-muted-foreground">
              La vitrina ya está on. Completá estos pasos para que “Confirmar
              pedido” funcione en el shopping.
            </p>
          </div>
          <ol className="flex flex-col gap-2">
            {status.steps
              .filter((step) => step.id !== "slug")
              .map((step, index) => (
                <li
                  key={step.id}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        step.done
                          ? "bg-emerald-600 text-white"
                          : "border border-muted-foreground/40 text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {step.done ? (
                        <Check className="size-3" />
                      ) : (
                        <span className="text-[10px] font-medium">
                          {index + 1}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          step.done && "text-muted-foreground line-through",
                        )}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {!step.done ? (
                    <Button asChild variant="ghost" size="sm" className="shrink-0">
                      <Link href={step.href}>
                        Ir
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="w-12 shrink-0" aria-hidden />
                  )}
                </li>
              ))}
          </ol>
        </div>
      )}
    </div>
  )
}
