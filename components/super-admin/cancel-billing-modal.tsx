"use client"

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
import { Loader2 } from "lucide-react"

interface CancelBillingModalProps {
  businessName: string | null
  open: boolean
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}

export function CancelBillingModal({
  businessName,
  open,
  pending = false,
  onOpenChange,
  onConfirm,
}: CancelBillingModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar al fin del período</AlertDialogTitle>
          <AlertDialogDescription>
            Se programará la cancelación de {businessName} en Stripe
            (cancel_at_period_end). El acceso sigue hasta que termine el período
            actual.
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
