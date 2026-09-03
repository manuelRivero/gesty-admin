"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  MoreHorizontal,
  Eye,
  SlidersHorizontal,
  CalendarPlus,
  RefreshCw,
  Ban,
  Unlock,
  CircleStop,
} from "lucide-react"

interface BusinessActionsDropdownProps {
  aiBlocked: boolean
  hasStripeSubscription: boolean
  onViewDetails: () => void
  onOverride: () => void
  onGrantTrial: () => void
  onSyncStripe: () => void
  onCancelBilling: () => void
  onToggleBlock: () => void
}

export function BusinessActionsDropdown({
  aiBlocked,
  hasStripeSubscription,
  onViewDetails,
  onOverride,
  onGrantTrial,
  onSyncStripe,
  onCancelBilling,
  onToggleBlock,
}: BusinessActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Abrir menú de acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onViewDetails}>
          <Eye className="size-4" />
          Ver detalle
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onGrantTrial}>
          <CalendarPlus className="size-4" />
          Otorgar trial
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOverride}>
          <SlidersHorizontal className="size-4" />
          Override cupo
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onSyncStripe}
          disabled={!hasStripeSubscription}
        >
          <RefreshCw className="size-4" />
          Sync Stripe
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onCancelBilling}
          disabled={!hasStripeSubscription}
        >
          <CircleStop className="size-4" />
          Cancelar al fin del período
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleBlock}>
          {aiBlocked ? (
            <>
              <Unlock className="size-4" />
              Desbloquear IA
            </>
          ) : (
            <>
              <Ban className="size-4" />
              Bloquear IA
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
