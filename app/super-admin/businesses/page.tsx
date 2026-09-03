"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BusinessesTable } from "@/components/super-admin/businesses-table"
import { GrantTrialModal } from "@/components/super-admin/grant-trial-modal"
import { BillingOverrideModal } from "@/components/super-admin/billing-override-modal"
import { BlockModal } from "@/components/super-admin/block-modal"
import { CancelBillingModal } from "@/components/super-admin/cancel-billing-modal"
import { CreateBusinessModal } from "@/components/super-admin/create-business-modal"
import type {
  BusinessListFilter,
  BusinessWithSubscription,
} from "@/components/super-admin/types"
import { matchesBusinessListFilter } from "@/components/super-admin/types"
import {
  createBusinessErrorMessage,
  createSuperAdminBusiness,
  fetchSuperAdminBusinesses,
  type CreateSuperAdminBusinessPayload,
} from "@/lib/requests/super-admin-businesses"
import {
  cancelSuperAdminBilling,
  grantSuperAdminTrial,
  patchSuperAdminBilling,
  superAdminBillingErrorMessage,
  syncSuperAdminStripe,
  type GrantTrialPayload,
  type PatchSuperAdminBillingPayload,
} from "@/lib/requests/super-admin-billing"

const ITEMS_PER_PAGE = 8

export default function BusinessesPage() {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<BusinessWithSubscription[]>([])
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState<BusinessListFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const [selectedBusiness, setSelectedBusiness] =
    useState<BusinessWithSubscription | null>(null)
  const [grantTrialOpen, setGrantTrialOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createPending, setCreatePending] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchQuery.trim()), 400)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedQ])

  const loadList = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const { items, total: count } = await fetchSuperAdminBusinesses({
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
        q: debouncedQ || undefined,
      })
      setBusinesses(items)
      setTotal(count)
    } catch (e) {
      setLoadError(
        superAdminBillingErrorMessage(e, "No se pudieron cargar los negocios."),
      )
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, debouncedQ])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const visibleBusinesses = useMemo(
    () => businesses.filter((item) => matchesBusinessListFilter(item, filter)),
    [businesses, filter],
  )

  const runMutation = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setPending(true)
    try {
      await action()
      toast.success(successMessage)
      setGrantTrialOpen(false)
      setOverrideOpen(false)
      setBlockOpen(false)
      setCancelOpen(false)
      await loadList()
    } catch (err) {
      toast.error(superAdminBillingErrorMessage(err, "No se pudo completar la acción."))
    } finally {
      setPending(false)
    }
  }

  const handleGrantTrial = async (payload: GrantTrialPayload) => {
    if (!selectedBusiness) return
    await runMutation(
      () => grantSuperAdminTrial(selectedBusiness.id, payload),
      `Trial otorgado a ${selectedBusiness.name}`,
    )
  }

  const handleOverride = async (payload: PatchSuperAdminBillingPayload) => {
    if (!selectedBusiness) return
    await runMutation(
      () => patchSuperAdminBilling(selectedBusiness.id, payload),
      `Cupo actualizado para ${selectedBusiness.name}`,
    )
  }

  const handleToggleBlock = async () => {
    if (!selectedBusiness) return
    const nextBlocked = !selectedBusiness.ai_blocked
    await runMutation(
      () =>
        patchSuperAdminBilling(selectedBusiness.id, { ai_blocked: nextBlocked }),
      nextBlocked
        ? `${selectedBusiness.name} bloqueado`
        : `${selectedBusiness.name} desbloqueado`,
    )
  }

  const handleSyncStripe = async (business: BusinessWithSubscription) => {
    setPending(true)
    try {
      await syncSuperAdminStripe(business.id)
      toast.success(`Stripe sincronizado para ${business.name}`)
      await loadList()
    } catch (err) {
      toast.error(superAdminBillingErrorMessage(err, "No se pudo sincronizar Stripe."))
    } finally {
      setPending(false)
    }
  }

  const handleCancelBilling = async () => {
    if (!selectedBusiness) return
    await runMutation(
      () => cancelSuperAdminBilling(selectedBusiness.id),
      `Cancelación programada para ${selectedBusiness.name}`,
    )
  }

  const handleCreateBusiness = async (
    payload: CreateSuperAdminBusinessPayload,
  ) => {
    setCreatePending(true)
    try {
      const created = await createSuperAdminBusiness(payload)
      toast.success(`Negocio “${created.name}” creado`)
      if (created.owner.created) {
        toast.message("Usuario creado. Guardá la contraseña que ingresaste.")
      }
      setCreateOpen(false)
      router.push(`/super-admin/businesses/${created.id}`)
    } catch (err) {
      toast.error(createBusinessErrorMessage(err))
    } finally {
      setCreatePending(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Negocios</h1>
          <p className="text-muted-foreground">
            Administrá negocios y suscripciones
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Crear negocio
        </Button>
      </div>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-medium">Todos los negocios</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={filter}
              onValueChange={(value) => {
                if (value) setFilter(value as BusinessListFilter)
              }}
              className="flex-wrap justify-start"
            >
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
              <ToggleGroupItem value="no_sub">Sin sub</ToggleGroupItem>
              <ToggleGroupItem value="trial_expiring">Trial por vencer</ToggleGroupItem>
              <ToggleGroupItem value="past_due">Past due</ToggleGroupItem>
              <ToggleGroupItem value="blocked">Bloqueados</ToggleGroupItem>
            </ToggleGroup>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <BusinessesTable
              businesses={visibleBusinesses}
              onViewDetails={(business) =>
                router.push(`/super-admin/businesses/${business.id}`)
              }
              onOverride={(business) => {
                setSelectedBusiness(business)
                setOverrideOpen(true)
              }}
              onGrantTrial={(business) => {
                setSelectedBusiness(business)
                setGrantTrialOpen(true)
              }}
              onSyncStripe={(business) => void handleSyncStripe(business)}
              onCancelBilling={(business) => {
                setSelectedBusiness(business)
                setCancelOpen(true)
              }}
              onToggleBlock={(business) => {
                setSelectedBusiness(business)
                setBlockOpen(true)
              }}
            />
          )}
        </CardContent>
      </Card>

      {!isLoading && totalPages > 1 && (
        <Pagination aria-label="Paginación de negocios">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                label="Anterior"
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage((p) => Math.max(1, p - 1))
                }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(page)
                      }}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              }
              if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <PaginationItem key={page}>
                    <PaginationEllipsis srOnlyLabel="Más páginas" />
                  </PaginationItem>
                )
              }
              return null
            })}
            <PaginationItem>
              <PaginationNext
                label="Siguiente"
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }}
                aria-disabled={currentPage === totalPages}
                className={
                  currentPage === totalPages ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {!isLoading ? (
        <p className="text-center text-sm text-muted-foreground">
          {total === 0
            ? "Sin resultados"
            : filter === "all"
              ? `Mostrando ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, total)} de ${total}`
              : `${visibleBusinesses.length} en esta página (filtro local)`}
        </p>
      ) : null}

      <GrantTrialModal
        businessName={selectedBusiness?.name ?? null}
        open={grantTrialOpen}
        pending={pending}
        onOpenChange={setGrantTrialOpen}
        onConfirm={handleGrantTrial}
      />
      <BillingOverrideModal
        businessName={selectedBusiness?.name ?? null}
        open={overrideOpen}
        pending={pending}
        initialPlan={selectedBusiness?.subscription.plan_name}
        initialTokenLimit={selectedBusiness?.ai_monthly_token_limit}
        initialBlocked={selectedBusiness?.ai_blocked}
        onOpenChange={setOverrideOpen}
        onConfirm={handleOverride}
      />
      <BlockModal
        businessName={selectedBusiness?.name ?? null}
        isBlocked={selectedBusiness?.ai_blocked ?? false}
        open={blockOpen}
        pending={pending}
        onOpenChange={setBlockOpen}
        onConfirm={handleToggleBlock}
      />
      <CancelBillingModal
        businessName={selectedBusiness?.name ?? null}
        open={cancelOpen}
        pending={pending}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancelBilling}
      />
      <CreateBusinessModal
        open={createOpen}
        pending={createPending}
        onOpenChange={setCreateOpen}
        onConfirm={handleCreateBusiness}
      />
    </div>
  )
}
