"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, LocateFixed, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { formatMenuItemPrice } from "@/lib/format-menu-price"
import { requestBrowserLocation } from "@/lib/browser-location"
import {
  fetchPublicDeliveryQuote,
  type DeliveryQuoteResult,
} from "@/lib/requests/public-delivery-quote"
import type { PublicFulfillment } from "@/lib/requests/public-fulfillment"
import { offersPublicDelivery } from "@/lib/requests/public-fulfillment"
import {
  createPublicCounterOrder,
  PublicOrderRequestError,
  type CreatePublicOrderResult,
  type PublicFulfillmentType,
  type PublicOrderPaymentMethod,
} from "@/lib/requests/public-orders"
import {
  DEFAULT_PUBLIC_PAYMENT_METHODS,
  fetchPublicPaymentMethods,
  storefrontSelectableMethods,
  type PublicPaymentMethod,
  type PublicPaymentMethodsResult,
} from "@/lib/requests/public-payment-methods"
import { fetchPublicReverseGeocode } from "@/lib/requests/public-reverse-geocode"
import { cn } from "@/lib/utils"

import { writeActiveShoppingOrder } from "./active-order-storage"
import {
  toCustomerContactPayload,
  validateCustomerContact,
  type ShoppingCustomerContactErrors,
} from "./customer-contact"
import {
  DestinationPinMap,
  type DestinationCoords,
} from "./destination-pin-map"
import { useShoppingCart } from "./shopping-cart-context"
import type { ShoppingMapCenter, ShoppingProduct } from "./types"

type CartSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ShoppingProduct[]
  /** Slug o UUID de la URL (`/shopping/[slug]`). */
  slug: string
  fulfillment: PublicFulfillment
  mapCenter?: ShoppingMapCenter | null
  currencyCode: string
}

function defaultFulfillmentType(
  fulfillment: PublicFulfillment,
): PublicFulfillmentType {
  if (fulfillment.takeawayEnabled) return "TAKE_AWAY"
  if (offersPublicDelivery(fulfillment)) return "DELIVERY"
  return "TAKE_AWAY"
}

function defaultPaymentMethod(
  methods: PublicPaymentMethod[],
): PublicOrderPaymentMethod {
  if (methods.some((m) => m.paymentMethod === "cash")) return "cash"
  if (methods.some((m) => m.paymentMethod === "online")) return "online"
  return "cash"
}

function formatSubtotalHint(subtotal: number): string {
  return subtotal.toFixed(2)
}

export function CartSheet({
  open,
  onOpenChange,
  products,
  slug,
  fulfillment,
  mapCenter,
  currencyCode,
}: CartSheetProps) {
  const {
    lines,
    itemCount,
    customerName,
    customerPhone,
    setCustomerName,
    setCustomerPhone,
    isContactValid,
    getCustomerContact,
    increment,
    decrement,
    remove,
    clear,
    getLineTotal,
    getSubtotal,
  } = useShoppingCart()

  const takeawayEnabled = fulfillment.takeawayEnabled
  /** Propio o externo: mismo “Envío” para el cliente. */
  const deliveryOffered = offersPublicDelivery(fulfillment)
  const showModePicker = takeawayEnabled && deliveryOffered
  const onlyTakeaway = takeawayEnabled && !deliveryOffered
  const onlyDelivery = deliveryOffered && !takeawayEnabled
  const webCheckoutAvailable = takeawayEnabled || deliveryOffered

  const [fulfillmentType, setFulfillmentType] =
    React.useState<PublicFulfillmentType>(() =>
      defaultFulfillmentType(fulfillment),
    )
  const [touched, setTouched] = React.useState({
    name: false,
    phone: false,
    street: false,
  })
  const [attemptedSubmit, setAttemptedSubmit] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [placedOrder, setPlacedOrder] =
    React.useState<CreatePublicOrderResult | null>(null)

  const [destination, setDestination] =
    React.useState<DestinationCoords | null>(null)
  const [streetAddress, setStreetAddress] = React.useState("")
  const [neighborhood, setNeighborhood] = React.useState<string | null>(null)
  const [city, setCity] = React.useState<string | null>(null)
  const [apartment, setApartment] = React.useState("")
  const [instructions, setInstructions] = React.useState("")
  const [quote, setQuote] = React.useState<DeliveryQuoteResult | null>(null)
  const [quoteLoading, setQuoteLoading] = React.useState(false)
  const [quoteError, setQuoteError] = React.useState<string | null>(null)
  const [locating, setLocating] = React.useState(false)
  const [locationHint, setLocationHint] = React.useState<string | null>(null)
  const [reverseLoading, setReverseLoading] = React.useState(false)
  const [reverseHint, setReverseHint] = React.useState<string | null>(null)
  /** Si el usuario edita la calle tras el autofill, no pisar hasta mover el pin. */
  const streetEditedRef = React.useRef(false)

  const [paymentCatalog, setPaymentCatalog] =
    React.useState<PublicPaymentMethodsResult>(DEFAULT_PUBLIC_PAYMENT_METHODS)
  const [paymentMethodsLoading, setPaymentMethodsLoading] = React.useState(false)
  const [paymentMethod, setPaymentMethod] =
    React.useState<PublicOrderPaymentMethod>("cash")

  const byId = new Map(products.map((p) => [p.id, p]))
  const resolved = lines
    .map((line) => {
      const product = byId.get(line.productId)
      if (!product) return null
      return { line, product }
    })
    .filter(
      (entry): entry is { line: (typeof lines)[number]; product: ShoppingProduct } =>
        Boolean(entry),
    )

  const subtotal = getSubtotal(products)
  const isDelivery = fulfillmentType === "DELIVERY"
  const streetOk = streetAddress.trim().length >= 3
  const errors: ShoppingCustomerContactErrors = validateCustomerContact({
    name: customerName,
    phone: customerPhone,
  })
  const showNameError = (touched.name || attemptedSubmit) && errors.name
  const showPhoneError = (touched.phone || attemptedSubmit) && errors.phone
  const showStreetError =
    isDelivery && (touched.street || attemptedSubmit) && !streetOk

  const quoteOk =
    !isDelivery ||
    (Boolean(quote?.inCoverage) &&
      quote?.minOrderMet !== false &&
      !quoteLoading &&
      !quoteError)

  const selectablePayments = storefrontSelectableMethods(paymentCatalog)
  const showPaymentPicker = selectablePayments.length > 1
  const onlyOnlinePayment =
    selectablePayments.length === 1 &&
    selectablePayments[0]?.paymentMethod === "online"
  const selectedPaymentMeta = selectablePayments.find(
    (m) => m.paymentMethod === paymentMethod,
  )
  const paymentReady =
    selectablePayments.length > 0 &&
    selectablePayments.some((m) => m.paymentMethod === paymentMethod)

  const canConfirm =
    resolved.length > 0 &&
    isContactValid &&
    webCheckoutAvailable &&
    paymentReady &&
    (!isDelivery || (Boolean(destination) && streetOk && quoteOk)) &&
    !submitting &&
    !placedOrder &&
    !paymentMethodsLoading

  const deliveryFeeDisplay =
    isDelivery && quote?.inCoverage && quote.deliveryFee != null
      ? quote.deliveryFee
      : null

  const estimatedTotal =
    deliveryFeeDisplay != null
      ? subtotal + (Number.parseFloat(deliveryFeeDisplay) || 0)
      : subtotal

  React.useEffect(() => {
    setFulfillmentType(defaultFulfillmentType(fulfillment))
  }, [fulfillment])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      setPaymentMethodsLoading(true)
      try {
        const result = await fetchPublicPaymentMethods(slug)
        if (cancelled) return
        const catalog = result ?? DEFAULT_PUBLIC_PAYMENT_METHODS
        const selectable = storefrontSelectableMethods(catalog)
        setPaymentCatalog(
          selectable.length > 0 ? catalog : DEFAULT_PUBLIC_PAYMENT_METHODS,
        )
        const next = defaultPaymentMethod(
          selectable.length > 0 ? selectable : DEFAULT_PUBLIC_PAYMENT_METHODS.paymentMethods,
        )
        setPaymentMethod(next)
      } catch {
        if (cancelled) return
        setPaymentCatalog(DEFAULT_PUBLIC_PAYMENT_METHODS)
        setPaymentMethod("cash")
      } finally {
        if (!cancelled) setPaymentMethodsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, slug])

  React.useEffect(() => {
    if (!isDelivery || !destination || !open) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setQuoteLoading(true)
        setQuoteError(null)
        try {
          const result = await fetchPublicDeliveryQuote(slug, {
            latitude: destination.latitude,
            longitude: destination.longitude,
            itemsSubtotal: formatSubtotalHint(subtotal),
          })
          if (cancelled) return
          setQuote(result)
        } catch (error) {
          if (cancelled) return
          setQuote(null)
          setQuoteError(
            error instanceof PublicOrderRequestError
              ? error.message
              : "No se pudo cotizar el envío",
          )
        } finally {
          if (!cancelled) setQuoteLoading(false)
        }
      })()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [destination, isDelivery, open, slug, subtotal])

  // Pin → calle (ORD-12). Cobertura sigue siendo solo delivery-quote.
  React.useEffect(() => {
    if (!isDelivery || !destination || !open) return

    streetEditedRef.current = false
    setNeighborhood(null)
    setCity(null)
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setReverseLoading(true)
        setReverseHint(null)
        try {
          const result = await fetchPublicReverseGeocode(slug, {
            latitude: destination.latitude,
            longitude: destination.longitude,
          })
          if (cancelled || streetEditedRef.current) return

          setNeighborhood(result.neighborhood)
          setCity(result.city)

          if (result.streetAddress) {
            setStreetAddress(result.streetAddress)
            setReverseHint(null)
          } else {
            setStreetAddress("")
            setReverseHint(
              "No pudimos armar la calle automáticamente. Completala a mano.",
            )
          }
        } catch (error) {
          if (cancelled || streetEditedRef.current) return
          if (
            error instanceof PublicOrderRequestError &&
            error.code === "RATE_LIMITED"
          ) {
            setReverseHint(
              "Demasiadas consultas de dirección. Completá la calle a mano o esperá un momento.",
            )
            return
          }
          setReverseHint(
            "No pudimos obtener la calle. Completala a mano.",
          )
        } finally {
          if (!cancelled) setReverseLoading(false)
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [destination, isDelivery, open, slug])

  async function handleConfirm() {
    setAttemptedSubmit(true)
    if (
      !isContactValid ||
      submitting ||
      resolved.length === 0 ||
      placedOrder ||
      !paymentReady
    ) {
      return
    }
    if (isDelivery) {
      if (!destination || !streetOk || !quoteOk) return
    }

    setSubmitting(true)
    try {
      const customer = toCustomerContactPayload(getCustomerContact())
      const order = await createPublicCounterOrder(slug, {
        customer,
        items: resolved.map(({ line, product }) => ({
          menuItemId: product.id,
          quantity: line.quantity,
        })),
        fulfillmentType,
        paymentMethod,
        ...(isDelivery && destination
          ? {
              address: {
                latitude: destination.latitude,
                longitude: destination.longitude,
                streetAddress: streetAddress.trim(),
                apartment: apartment.trim() || null,
                neighborhood: neighborhood,
                city: city,
                instructions: instructions.trim() || null,
              },
            }
          : {}),
      })
      clear()
      writeActiveShoppingOrder(slug, order)

      const checkoutUrl = order.checkoutUrl?.trim()
      if (paymentMethod === "online" && checkoutUrl) {
        toast.success("Redirigiendo a Mercado Pago…")
        window.location.assign(checkoutUrl)
        return
      }

      if (paymentMethod === "online") {
        toast.message("Pedido creado", {
          description: "Abrí el seguimiento para completar el pago.",
        })
        window.location.assign(
          `/shopping/${encodeURIComponent(slug)}/orders/${encodeURIComponent(order.orderId)}?payment=pending`,
        )
        return
      }

      setPlacedOrder(order)
      toast.success("Pedido enviado", {
        description: "Seguí el estado desde el ícono de pedidos.",
      })
    } catch (error) {
      const message =
        error instanceof PublicOrderRequestError
          ? error.message
          : "No se pudo crear el pedido. Intentá de nuevo."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  function resetCheckoutForm() {
    setPlacedOrder(null)
    setAttemptedSubmit(false)
    setTouched({ name: false, phone: false, street: false })
    setDestination(null)
    setStreetAddress("")
    setNeighborhood(null)
    setCity(null)
    setApartment("")
    setInstructions("")
    setQuote(null)
    setQuoteError(null)
    setLocationHint(null)
    setReverseHint(null)
    setReverseLoading(false)
    setLocating(false)
    streetEditedRef.current = false
    setFulfillmentType(defaultFulfillmentType(fulfillment))
    setPaymentMethod(
      defaultPaymentMethod(storefrontSelectableMethods(paymentCatalog)),
    )
  }

  function handleOpenChange(next: boolean) {
    if (!next && placedOrder) {
      resetCheckoutForm()
    }
    onOpenChange(next)
  }

  function handleNewOrder() {
    resetCheckoutForm()
    onOpenChange(false)
  }

  async function handleUseMyLocation() {
    if (submitting || locating) return
    setLocating(true)
    setLocationHint(null)
    try {
      const result = await requestBrowserLocation()
      if (!result.ok) {
        setLocationHint(result.message)
        return
      }
      setDestination({
        latitude: result.latitude,
        longitude: result.longitude,
      })
      setLocationHint(
        "Ubicación marcada. Podés ajustar el pin si hace falta.",
      )
    } finally {
      setLocating(false)
    }
  }

  const successHint =
    placedOrder?.fulfillmentType?.toUpperCase() === "DELIVERY"
      ? "Te vamos a avisar cuando el pedido vaya en camino."
      : "Te vamos a llamar por tu nombre cuando esté listo."

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col gap-0 rounded-t-2xl p-0"
      >
        {placedOrder ? (
          <>
            <SheetHeader className="border-b px-4 pt-4 pb-3">
              <SheetTitle>Pedido recibido</SheetTitle>
              <SheetDescription>Pedido confirmado</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-6 py-8 text-center">
              <CheckCircle2 className="text-foreground size-12" />
              <div className="space-y-1">
                <p className="text-lg font-semibold tracking-tight">
                  {placedOrder.customer.name?.trim() || "Listo"}
                </p>
                <p className="text-muted-foreground text-sm">{successHint}</p>
              </div>
              <div className="bg-muted/50 w-full space-y-2 rounded-lg px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">
                    {formatMenuItemPrice(
                      placedOrder.total,
                      placedOrder.currencyCode,
                    )}
                  </span>
                </div>
                {placedOrder.deliveryFee ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Envío</span>
                    <span className="tabular-nums">
                      {formatMenuItemPrice(
                        placedOrder.deliveryFee,
                        placedOrder.currencyCode,
                      )}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Pedido</span>
                  <span className="font-mono text-xs tabular-nums">
                    {placedOrder.orderId.slice(0, 8)}…
                  </span>
                </div>
              </div>
            </div>
            <SheetFooter className="border-t gap-2 p-4">
              <Button type="button" size="lg" className="w-full" asChild>
                <Link
                  href={`/shopping/${encodeURIComponent(slug)}/orders/${encodeURIComponent(placedOrder.orderId)}`}
                >
                  Ver estado del pedido
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleNewOrder}
              >
                Seguir mirando el menú
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader className="border-b px-4 pt-4 pb-3">
              <SheetTitle>Tu pedido</SheetTitle>
              <SheetDescription>
                {itemCount === 0
                  ? "Todavía no agregaste productos."
                  : `${itemCount} ${itemCount === 1 ? "producto" : "productos"}`}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {resolved.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center gap-3 py-10 text-center text-sm">
                  <ShoppingBag className="size-10 opacity-40" />
                  <p>Explorá el menú y agregá lo que quieras pedir.</p>
                </div>
              ) : (
                <>
                  <ul className="divide-y">
                    {resolved.map(({ line, product }) => (
                      <li key={product.id} className="flex gap-3 py-3">
                        <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-md">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {product.name}
                              </p>
                              <p className="text-muted-foreground text-sm tabular-nums">
                                {formatMenuItemPrice(
                                  getLineTotal(product, line.quantity),
                                  product.currencyCode,
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Eliminar del carrito"
                              disabled={submitting}
                              onClick={() => remove(product.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <div className="bg-background inline-flex items-center gap-1 rounded-md border">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Quitar uno"
                              disabled={submitting}
                              onClick={() => decrement(product.id)}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="min-w-6 text-center text-sm font-medium tabular-nums">
                              {line.quantity}
                            </span>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Agregar uno"
                              disabled={submitting}
                              onClick={() => increment(product.id)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-3 border-t pt-4 pb-2">
                    <p className="text-sm font-medium">¿Cómo lo querés?</p>
                    {showModePicker ? (
                      <RadioGroup
                        value={fulfillmentType}
                        onValueChange={(v) =>
                          setFulfillmentType(v as PublicFulfillmentType)
                        }
                        className="grid grid-cols-2 gap-2"
                        disabled={submitting}
                      >
                        <ModeOption
                          value="TAKE_AWAY"
                          label="Retiro"
                          description="Pasás por el local"
                          selected={fulfillmentType === "TAKE_AWAY"}
                        />
                        <ModeOption
                          value="DELIVERY"
                          label="Envío"
                          description="Te lo llevamos"
                          selected={fulfillmentType === "DELIVERY"}
                        />
                      </RadioGroup>
                    ) : onlyTakeaway ? (
                      <div className="bg-muted/40 rounded-lg border px-3 py-2.5 text-sm">
                        <p className="font-medium">Solo retiro en el local</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Este local no ofrece envío. Pasás a buscar el pedido.
                        </p>
                      </div>
                    ) : onlyDelivery ? (
                      <div className="bg-muted/40 rounded-lg border px-3 py-2.5 text-sm">
                        <p className="font-medium">Solo envío a domicilio</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Este local no ofrece retiro. Completá la dirección
                          abajo.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-amber-600/30 bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-950/30">
                        <p className="font-medium">
                          Este local no tiene retiro ni envío activos
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          Por ahora no se pueden confirmar pedidos online.
                        </p>
                      </div>
                    )}
                  </div>

                  {isDelivery ? (
                    <div className="space-y-3 border-t pt-4 pb-2">
                      <div>
                        <p className="text-sm font-medium">
                          Dirección de entrega
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Usá tu ubicación o tocá el mapa para marcar el destino.
                          El mapa se centra en el local solo como referencia.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={submitting || locating}
                        onClick={() => void handleUseMyLocation()}
                      >
                        {locating ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Obteniendo ubicación…
                          </>
                        ) : (
                          <>
                            <LocateFixed className="size-4" />
                            Usar mi ubicación
                          </>
                        )}
                      </Button>
                      {locationHint ? (
                        <p className="text-muted-foreground text-xs">
                          {locationHint}
                        </p>
                      ) : null}
                      {open ? (
                        <DestinationPinMap
                          mapCenter={mapCenter ?? fulfillment.mapCenter}
                          value={destination}
                          onChange={(coords) => {
                            setDestination(coords)
                            setLocationHint(null)
                          }}
                          disabled={submitting}
                          active={open && isDelivery && !locating}
                        />
                      ) : null}
                      {!destination ? (
                        <p className="text-muted-foreground text-xs">
                          Todavía no hay destino. Tocá el mapa o usá tu
                          ubicación.
                        </p>
                      ) : null}
                      <div className="space-y-1.5">
                        <Label htmlFor="shopping-street">Calle y número</Label>
                        <div className="relative">
                          <Input
                            id="shopping-street"
                            name="streetAddress"
                            autoComplete="street-address"
                            placeholder="Ej. Mitre 1200"
                            value={streetAddress}
                            disabled={submitting}
                            aria-invalid={Boolean(showStreetError)}
                            onChange={(e) => {
                              streetEditedRef.current = true
                              setStreetAddress(e.target.value)
                              setReverseHint(null)
                            }}
                            onBlur={() =>
                              setTouched((prev) => ({ ...prev, street: true }))
                            }
                          />
                          {reverseLoading ? (
                            <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
                          ) : null}
                        </div>
                        {showStreetError ? (
                          <p className="text-destructive text-xs">
                            Indicá calle y número.
                          </p>
                        ) : reverseHint ? (
                          <p className="text-muted-foreground text-xs">
                            {reverseHint}
                          </p>
                        ) : city || neighborhood ? (
                          <p className="text-muted-foreground text-xs">
                            {[neighborhood, city].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="shopping-apartment">
                          Depto / piso (opcional)
                        </Label>
                        <Input
                          id="shopping-apartment"
                          name="apartment"
                          autoComplete="address-line2"
                          placeholder="Ej. 3B"
                          value={apartment}
                          disabled={submitting}
                          onChange={(e) => setApartment(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="shopping-instructions">
                          Instrucciones para el repartidor
                        </Label>
                        <Textarea
                          id="shopping-instructions"
                          name="instructions"
                          placeholder="Ej. Timbre roto, dejar en portería…"
                          value={instructions}
                          disabled={submitting}
                          rows={2}
                          onChange={(e) => setInstructions(e.target.value)}
                        />
                      </div>

                      <QuoteFeedback
                        loading={quoteLoading}
                        error={quoteError}
                        quote={quote}
                        currencyCode={currencyCode}
                      />
                    </div>
                  ) : null}

                  <div className="space-y-3 border-t pt-4 pb-2">
                    <p className="text-sm font-medium">Tus datos</p>
                    <p className="text-muted-foreground text-xs">
                      {isDelivery
                        ? "Los usamos para coordinar la entrega."
                        : "Los usamos para llamarte cuando tu pedido esté listo."}
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="shopping-customer-name">Nombre</Label>
                      <Input
                        id="shopping-customer-name"
                        name="customerName"
                        autoComplete="name"
                        placeholder="Ej. María"
                        value={customerName}
                        disabled={submitting}
                        aria-invalid={Boolean(showNameError)}
                        onChange={(e) => setCustomerName(e.target.value)}
                        onBlur={() =>
                          setTouched((prev) => ({ ...prev, name: true }))
                        }
                      />
                      {showNameError ? (
                        <p className="text-destructive text-xs">
                          {errors.name}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="shopping-customer-phone">Teléfono</Label>
                      <Input
                        id="shopping-customer-phone"
                        name="customerPhone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Ej. 099 123 456"
                        value={customerPhone}
                        disabled={submitting}
                        aria-invalid={Boolean(showPhoneError)}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        onBlur={() =>
                          setTouched((prev) => ({ ...prev, phone: true }))
                        }
                      />
                      {showPhoneError ? (
                        <p className="text-destructive text-xs">
                          {errors.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4 pb-2">
                    <p className="text-sm font-medium">¿Cómo pagás?</p>
                    {paymentMethodsLoading ? (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Loader2 className="size-4 animate-spin" />
                        Cargando formas de pago…
                      </div>
                    ) : showPaymentPicker ? (
                      <RadioGroup
                        value={paymentMethod}
                        onValueChange={(v) =>
                          setPaymentMethod(v as PublicOrderPaymentMethod)
                        }
                        className="grid grid-cols-2 gap-2"
                        disabled={submitting}
                      >
                        {selectablePayments.map((method) => (
                          <PaymentModeOption
                            key={method.paymentMethod}
                            method={method}
                            selected={paymentMethod === method.paymentMethod}
                          />
                        ))}
                      </RadioGroup>
                    ) : onlyOnlinePayment ? (
                      <div className="bg-muted/40 rounded-lg border px-3 py-2.5 text-sm">
                        <p className="font-medium">
                          {selectedPaymentMeta?.label ?? "Pago online"}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Te redirigimos a Mercado Pago para pagar con tarjeta
                          o dinero en cuenta.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-muted/40 rounded-lg border px-3 py-2.5 text-sm">
                        <p className="font-medium">
                          {selectedPaymentMeta?.label ?? "Efectivo"}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {isDelivery
                            ? "Pagás al recibir el pedido."
                            : "Pagás en el mostrador al retirar."}
                        </p>
                      </div>
                    )}
                    {selectedPaymentMeta?.instructions ? (
                      <p className="text-muted-foreground text-xs">
                        {selectedPaymentMeta.instructions}
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {resolved.length > 0 ? (
              <SheetFooter className="border-t bg-background gap-3 p-4">
                <div className="w-full space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">
                      {formatMenuItemPrice(subtotal, currencyCode)}
                    </span>
                  </div>
                  {deliveryFeeDisplay != null ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Envío</span>
                      <span className="tabular-nums">
                        {formatMenuItemPrice(deliveryFeeDisplay, currencyCode)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total estimado</span>
                    <span className="tabular-nums">
                      {formatMenuItemPrice(estimatedTotal, currencyCode)}
                    </span>
                  </div>
                  {isDelivery ? (
                    <p className="text-muted-foreground text-xs">
                      El total final lo confirma el local al recibir el pedido.
                    </p>
                  ) : null}
                </div>
                <Separator />
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={!canConfirm}
                  onClick={() => void handleConfirm()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {paymentMethod === "online"
                        ? "Abriendo pago…"
                        : "Enviando…"}
                    </>
                  ) : paymentMethod === "online" ? (
                    "Pagar con Mercado Pago"
                  ) : (
                    "Confirmar pedido"
                  )}
                </Button>
                {!isContactValid ? (
                  <p className="text-muted-foreground text-center text-xs">
                    Completá nombre y teléfono para continuar.
                  </p>
                ) : isDelivery && quote && !quote.inCoverage ? (
                  <p className="text-muted-foreground text-center text-xs">
                    Mové el pin a una zona con cobertura para continuar.
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={submitting}
                  onClick={clear}
                >
                  Vaciar carrito
                </Button>
              </SheetFooter>
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ModeOption({
  value,
  label,
  description,
  selected,
}: {
  value: PublicFulfillmentType
  label: string
  description: string
  selected: boolean
}) {
  return (
    <Label
      htmlFor={`fulfillment-${value}`}
      className={cn(
        "flex min-h-16 cursor-pointer flex-col justify-center gap-0.5 rounded-lg border px-3 py-3 transition-colors",
        selected
          ? "border-foreground bg-muted/50 ring-1 ring-foreground"
          : "border-border hover:bg-muted/30",
      )}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem value={value} id={`fulfillment-${value}`} />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <span className="text-muted-foreground pl-6 text-xs">{description}</span>
    </Label>
  )
}

function PaymentModeOption({
  method,
  selected,
}: {
  method: PublicPaymentMethod
  selected: boolean
}) {
  const isOnline = method.paymentMethod === "online"
  return (
    <Label
      htmlFor={`payment-${method.paymentMethod}`}
      className={cn(
        "flex min-h-16 cursor-pointer flex-col justify-center gap-0.5 rounded-lg border px-3 py-3 transition-colors",
        selected
          ? "border-foreground bg-muted/50 ring-1 ring-foreground"
          : "border-border hover:bg-muted/30",
      )}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem
          value={method.paymentMethod}
          id={`payment-${method.paymentMethod}`}
        />
        <span className="text-sm font-semibold">{method.label}</span>
      </div>
      <span className="text-muted-foreground pl-6 text-xs">
        {isOnline
          ? "Mercado Pago ahora"
          : "En el local o al recibir"}
      </span>
    </Label>
  )
}

function QuoteFeedback({
  loading,
  error,
  quote,
  currencyCode,
}: {
  loading: boolean
  error: string | null
  quote: DeliveryQuoteResult | null
  currencyCode: string
}) {
  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Calculando envío…
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>
  }

  if (!quote) {
    return (
      <p className="text-muted-foreground text-xs">
        Marcá el destino en el mapa para cotizar el envío.
      </p>
    )
  }

  if (!quote.inCoverage) {
    return (
      <div className="rounded-lg border border-amber-600/30 bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-950/30">
        <p className="font-medium">Ups, no llegamos a esa zona</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Probá mover el pin más cerca del local.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-muted/40 space-y-1 rounded-lg border px-3 py-2.5 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Costo de envío</span>
        <span className="font-medium tabular-nums">
          {formatMenuItemPrice(quote.deliveryFee, currencyCode)}
        </span>
      </div>
      {quote.minOrderAmount ? (
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Pedido mínimo</span>
          <span
            className={cn(
              "tabular-nums",
              quote.minOrderMet === false && "text-destructive",
            )}
          >
            {formatMenuItemPrice(quote.minOrderAmount, currencyCode)}
            {quote.minOrderMet === false ? " · no alcanzado" : null}
          </span>
        </div>
      ) : null}
      {quote.estimatedMinutes != null ? (
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Tiempo estimado</span>
          <span className="tabular-nums">~{quote.estimatedMinutes} min</span>
        </div>
      ) : null}
      {quote.zoneName ? (
        <p className="text-muted-foreground text-xs">Zona: {quote.zoneName}</p>
      ) : null}
    </div>
  )
}
