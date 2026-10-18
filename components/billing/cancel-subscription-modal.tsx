"use client"

import { Loader2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

/**
 * Confirmación de cancelación owner-facing — mismo patrón visual que
 * `components/super-admin/cancel-billing-modal.tsx`, pero sin reusar ese
 * componente: ese llama al endpoint de super-admin
 * (`/super-admin/businesses/:id/billing/cancel`), que no aplica al owner
 * (`/admin/billing/subscription/cancel`). Se reutiliza el patrón visual,
 * no el endpoint.
 */
interface CancelSubscriptionModalProps {
  open: boolean
  pending?: boolean
  periodEndLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}

export function CancelSubscriptionModal({
  open,
  pending = false,
  periodEndLabel,
  onOpenChange,
  onConfirm,
}: CancelSubscriptionModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar suscripción</AlertDialogTitle>
          <AlertDialogDescription>
            La cancelación se hace efectiva al fin del período vigente
            ({periodEndLabel}), no de inmediato. El asistente sigue
            funcionando normalmente hasta esa fecha. Podés revertirlo
            mientras tanto desde esta misma pantalla.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Cancelando…
              </>
            ) : (
              "Confirmar cancelación"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
