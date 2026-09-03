"use client"

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BusinessRow } from "./business-row"
import type { BusinessWithSubscription } from "./types"

interface BusinessesTableProps {
  businesses: BusinessWithSubscription[]
  onViewDetails: (business: BusinessWithSubscription) => void
  onOverride: (business: BusinessWithSubscription) => void
  onGrantTrial: (business: BusinessWithSubscription) => void
  onSyncStripe: (business: BusinessWithSubscription) => void
  onCancelBilling: (business: BusinessWithSubscription) => void
  onToggleBlock: (business: BusinessWithSubscription) => void
}

export function BusinessesTable({
  businesses,
  onViewDetails,
  onOverride,
  onGrantTrial,
  onSyncStripe,
  onCancelBilling,
  onToggleBlock,
}: BusinessesTableProps) {
  if (businesses.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No hay negocios para mostrar
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Negocio</TableHead>
          <TableHead>Acceso</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Trial</TableHead>
          <TableHead>Tokens</TableHead>
          <TableHead>IA bloqueada</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {businesses.map((business) => (
          <BusinessRow
            key={business.id}
            business={business}
            onViewDetails={() => onViewDetails(business)}
            onOverride={() => onOverride(business)}
            onGrantTrial={() => onGrantTrial(business)}
            onSyncStripe={() => onSyncStripe(business)}
            onCancelBilling={() => onCancelBilling(business)}
            onToggleBlock={() => onToggleBlock(business)}
          />
        ))}
      </TableBody>
    </Table>
  )
}
