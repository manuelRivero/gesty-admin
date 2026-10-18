"use client"

import * as React from "react"
import {
  AlertTriangle,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { isAxiosError } from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { fetchAdminMenuItems } from "@/lib/requests/menu-items"
import type { MenuItem } from "@/components/menu-items/types"
import {
  addAdminDraftOrderItem,
  fetchAdminDraftOrder,
  removeAdminDraftOrderItem,
  requestAdminDraftOrderConfirmation,
  setAdminDraftOrderFulfillment,
  updateAdminDraftOrderItemQuantity,
  type AdminDraftOrder,
  type AdminDraftOrderFulfillmentType,
} from "@/lib/requests/draft-orders"

interface DraftOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  customerName: string
}

const ERROR_MESSAGES: Record<string, string> = {
  NO_ADDRESS: "El cliente no tiene una dirección cargada para delivery.",
  OUT_OF_COVERAGE: "La dirección del cliente está fuera de la zona de cobertura.",
  PAYMENT_METHOD_NOT_OFFERED: "Elegí un método de pago habilitado.",
  NO_WHATSAPP_CONFIG: "El negocio no tiene WhatsApp configurado.",
  EMPTY_CART: "El pedido no tiene ítems.",
}

function errorMessageFor(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  }
  return fallback
}

function formatPrice(value: number): string {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function DraftOrderModal({
  open,
  onOpenChange,
  conversationId,
  customerName,
}: DraftOrderModalProps) {
  const [draft, setDraft] = React.useState<AdminDraftOrder | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [mutatingItemId, setMutatingItemId] = React.useState<string | null>(null)
  const [updatingFulfillment, setUpdatingFulfillment] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [paymentMethod, setPaymentMethod] = React.useState<string>("")

  const [query, setQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<MenuItem[]>([])
  const [searching, setSearching] = React.useState(false)
  const [addingProductId, setAddingProductId] = React.useState<string | null>(null)

  const applyDraft = React.useCallback((result: AdminDraftOrder) => {
    setDraft(result)
    setPaymentMethod((prev) =>
      prev && result.offeredPaymentMethods.some((m) => m.id === prev)
        ? prev
        : (result.offeredPaymentMethods[0]?.id ?? ""),
    )
  }, [])

  const loadDraft = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminDraftOrder(conversationId)
      applyDraft(result)
    } catch {
      toast.error("No se pudo cargar el pedido")
    } finally {
      setLoading(false)
    }
  }, [conversationId, applyDraft])

  React.useEffect(() => {
    if (!open) return
    void loadDraft()
  }, [open, loadDraft])

  React.useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchAdminMenuItems({
            q: trimmed,
            pageSize: 10,
            includeUnavailable: false,
          })
          setSearchResults(result.items)
        } catch {
          setSearchResults([])
        } finally {
          setSearching(false)
        }
      })()
    }, 300)
    return () => clearTimeout(timeout)
  }, [query, open])

  async function handleAddProduct(product: MenuItem) {
    setAddingProductId(product.id)
    try {
      const result = await addAdminDraftOrderItem(conversationId, {
        menuItemId: product.id,
      })
      applyDraft(result)
    } catch {
      toast.error("No se pudo agregar el producto")
    } finally {
      setAddingProductId(null)
    }
  }

  async function handleQuantityChange(itemId: string, quantity: number) {
    if (quantity < 1) return
    setMutatingItemId(itemId)
    try {
      const result = await updateAdminDraftOrderItemQuantity(
        conversationId,
        itemId,
        quantity,
      )
      applyDraft(result)
    } catch {
      toast.error("No se pudo actualizar la cantidad")
    } finally {
      setMutatingItemId(null)
    }
  }

  async function handleRemove(itemId: string) {
    setMutatingItemId(itemId)
    try {
      const result = await removeAdminDraftOrderItem(conversationId, itemId)
      applyDraft(result)
    } catch {
      toast.error("No se pudo quitar el ítem")
    } finally {
      setMutatingItemId(null)
    }
  }

  async function handleFulfillmentChange(value: string) {
    if (value !== "TAKE_AWAY" && value !== "DELIVERY") return
    setUpdatingFulfillment(true)
    try {
      const result = await setAdminDraftOrderFulfillment(
        conversationId,
        value as AdminDraftOrderFulfillmentType,
      )
      applyDraft(result)
    } catch {
      toast.error("No se pudo actualizar la modalidad")
    } finally {
      setUpdatingFulfillment(false)
    }
  }

  async function handleSendForConfirmation() {
    if (!paymentMethod) {
      toast.error("Elegí un método de pago")
      return
    }
    setSubmitting(true)
    try {
      await requestAdminDraftOrderConfirmation(conversationId, { paymentMethod })
      toast.success(
        "Se envió el resumen al cliente por WhatsApp. El pedido se crea cuando lo confirme.",
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessageFor(err, "No se pudo enviar la confirmación"))
    } finally {
      setSubmitting(false)
    }
  }

  const items = draft?.items ?? []
  const isDelivery = draft?.fulfillmentType === "DELIVERY"
  const deliveryBlocked = isDelivery && draft?.deliveryCoverage !== "ok"
  const hasPaymentMethods = (draft?.offeredPaymentMethods.length ?? 0) > 0
  const canSend =
    items.length > 0 &&
    !!draft?.fulfillmentType &&
    !deliveryBlocked &&
    hasPaymentMethods &&
    !!paymentMethod &&
    !submitting &&
    !loading

  const totalWithDelivery = (draft?.totalAmount ?? 0) + (draft?.deliveryFee ?? 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            Pedido de {customerName}
          </DialogTitle>
          <DialogDescription>
            Editá el carrito que venía armando el bot y enviáselo al cliente
            para que lo confirme.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto para agregar..."
            className="pl-9"
          />
        </div>

        {query.trim() ? (
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {searching ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Buscando...
              </div>
            ) : searchResults.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No se encontraron productos.
              </p>
            ) : (
              searchResults.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-2 border-b p-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    {product.price != null ? (
                      <p className="text-xs text-muted-foreground">
                        ${formatPrice(product.price)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={addingProductId === product.id}
                    onClick={() => void handleAddProduct(product)}
                  >
                    {addingProductId === product.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Agregar"
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        ) : null}

        <Separator />

        <div className="flex-1 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando pedido...
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              El carrito está vacío. Buscá productos arriba para agregarlos.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => {
                const isMutating = mutatingItemId === item.id
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.name}
                        {item.variation ? ` (${item.variation})` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${formatPrice(item.unitPrice)} c/u · ${formatPrice(item.totalPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7"
                        disabled={isMutating || item.quantity <= 1}
                        onClick={() =>
                          void handleQuantityChange(item.id, item.quantity - 1)
                        }
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7"
                        disabled={isMutating}
                        onClick={() =>
                          void handleQuantityChange(item.id, item.quantity + 1)
                        }
                      >
                        <Plus className="size-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        disabled={isMutating}
                        onClick={() => void handleRemove(item.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {!loading && draft ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Modalidad</Label>
                <RadioGroup
                  value={draft.fulfillmentType ?? undefined}
                  onValueChange={(v) => void handleFulfillmentChange(v)}
                  className="flex gap-4"
                  disabled={updatingFulfillment}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="TAKE_AWAY" id="fulfillment-takeaway" />
                    <Label htmlFor="fulfillment-takeaway" className="font-normal">
                      Retiro en local
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="DELIVERY" id="fulfillment-delivery" />
                    <Label htmlFor="fulfillment-delivery" className="font-normal">
                      Delivery
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {isDelivery ? (
                deliveryBlocked ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertDescription>
                      {draft.deliveryCoverage === "no_address"
                        ? "El cliente no tiene una dirección cargada. Pedisela por el chat antes de enviar la confirmación."
                        : "La dirección del cliente está fuera de la zona de cobertura de delivery."}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Entrega a: </span>
                    {draft.deliveryAddress}
                    <span className="text-muted-foreground"> · Envío: </span>$
                    {formatPrice(draft.deliveryFee)}
                  </p>
                )
              ) : null}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Método de pago</Label>
                {hasPaymentMethods ? (
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                    className="flex flex-wrap gap-4"
                  >
                    {draft.offeredPaymentMethods.map((method) => (
                      <div key={method.id} className="flex items-center gap-2">
                        <RadioGroupItem value={method.id} id={`payment-${method.id}`} />
                        <Label htmlFor={`payment-${method.id}`} className="font-normal">
                          {method.emoji} {method.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    El negocio no tiene métodos de pago habilitados.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <Separator />

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm font-medium">
            Total: ${formatPrice(totalWithDelivery)} {draft?.currency ?? ""}
          </p>
          <Button disabled={!canSend} onClick={() => void handleSendForConfirmation()}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar para confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
