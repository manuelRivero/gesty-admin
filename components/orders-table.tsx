"use client"

import { useCallback, useEffect, useState } from "react"
import { isAxiosError } from "axios"
import { Eye, Package } from "lucide-react"
import { toast } from "sonner"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import {
  OrderPaymentStatusBadge,
  OrderStatusBadge,
} from "@/components/status-badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { OrderPaymentProofs } from "@/components/order-payment-proofs"
import { OrderDeliveryAssignmentField } from "@/components/orders/delivery-assignment-field"
import { cn } from "@/lib/utils"
import { getUserRoleFromCookie } from "@/lib/auth"
import { fetchAdminBusinessConfig } from "@/lib/requests/business-config"
import {
  ADMIN_PATCH_ORDER_LABEL_ES,
  getNextPatchableOrderStatus,
  type AdminPatchableOrderStatus,
} from "@/lib/constants/orderWorkflow"
import {
  fetchAdminOrderById,
  patchAdminOrderStatus,
} from "@/lib/requests/orders"
import {
  formatOrderMoney,
  formatShortOrderId,
  orderCustomerLabel,
  orderIsDeliveryFulfillment,
  summarizeDeliverySnapshot,
  type Order,
} from "@/lib/data"

interface OrdersTableProps {
  orders: Order[]
  isLoading?: boolean
  /** Filas recibidas por Socket.IO: fondo suave + badge “Nuevo”. */
  highlightOrderIds?: string[]
  /** Tras PATCH de estado operativo (lista alineada con la respuesta del API). */
  onOrderPatched?: (order: Order) => void
  /** Deep-link: `/orders?orderId=…&proofId=…` */
  deepLinkOrderId?: string | null
  deepLinkProofId?: string | null
  onDeepLinkConsumed?: () => void
}

function isTransferMethod(method: string | null | undefined): boolean {
  return (method ?? "").trim().toLowerCase() === "transfer"
}

export function OrdersTable({
  orders,
  isLoading,
  highlightOrderIds = [],
  onOrderPatched,
  deepLinkOrderId = null,
  deepLinkProofId = null,
  onDeepLinkConsumed,
}: OrdersTableProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [highlightProofId, setHighlightProofId] = useState<string | null>(null)
  const [deepLinkLoading, setDeepLinkLoading] = useState(false)
  const [canAssignDelivery, setCanAssignDelivery] = useState(false)
  /** Delivery externo: no se asigna flota propia del local. */
  const [ownFleetAssignment, setOwnFleetAssignment] = useState(true)

  useEffect(() => {
    const role = getUserRoleFromCookie()
    setCanAssignDelivery(role === "OWNER" || role === "ADMIN")
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const cfg = await fetchAdminBusinessConfig()
        if (cancelled) return
        // Externo excluye propio: sin UI de asignar repartidor local.
        setOwnFleetAssignment(!cfg.external_delivery_enabled)
      } catch {
        if (!cancelled) setOwnFleetAssignment(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleViewDetails = (order: Order, proofId?: string | null) => {
    setSelectedOrder(order)
    setHighlightProofId(proofId ?? null)
    setDetailsOpen(true)
  }

  const refreshSelectedOrder = useCallback(async () => {
    if (!selectedOrder) return
    try {
      const fresh = await fetchAdminOrderById(selectedOrder.id)
      setSelectedOrder(fresh)
      onOrderPatched?.(fresh)
    } catch {
      /* noop */
    }
  }, [selectedOrder, onOrderPatched])

  useEffect(() => {
    if (!deepLinkOrderId) return

    const fromList = orders.find((o) => o.id === deepLinkOrderId)
    if (fromList) {
      handleViewDetails(fromList, deepLinkProofId)
      onDeepLinkConsumed?.()
      return
    }

    let cancelled = false
    setDeepLinkLoading(true)
    void (async () => {
      try {
        const order = await fetchAdminOrderById(deepLinkOrderId)
        if (cancelled) return
        onOrderPatched?.(order)
        handleViewDetails(order, deepLinkProofId)
      } catch {
        if (!cancelled) {
          toast.error("No se pudo abrir el pedido del comprobante")
        }
      } finally {
        if (!cancelled) {
          setDeepLinkLoading(false)
          onDeepLinkConsumed?.()
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // Solo reaccionar al deep-link, no a cada refresh de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkOrderId, deepLinkProofId])

  const handleDeliveryStatusChange = async (
    order: Order,
    newStatus: AdminPatchableOrderStatus,
  ) => {
    if (order.status.toLowerCase() === newStatus) {
      return
    }
    setUpdatingOrderId(order.id)
    try {
      const result = await patchAdminOrderStatus(order.id, newStatus)
      onOrderPatched?.(result.order)
      setSelectedOrder((prev) =>
        prev?.id === result.order.id ? result.order : prev,
      )
      toast.success("Estado de envío actualizado")
      if (
        newStatus === "shipped" &&
        orderIsDeliveryFulfillment(result.order) &&
        ownFleetAssignment &&
        !result.order.assignedDeliveryUser
      ) {
        setSelectedOrder(result.order)
        setDetailsOpen(true)
        toast.info("Asigná un repartidor para este pedido de delivery.")
      }
      if (!result.customerNotified) {
        toast.warning(
          result.notificationReason
            ? `No se notificó al cliente por WhatsApp: ${result.notificationReason}`
            : "No se pudo notificar al cliente por WhatsApp.",
        )
      }
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string })?.message ?? e.message
        : "Error al actualizar el estado"
      toast.error(typeof msg === "string" ? msg : "Error al actualizar el estado")
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const formatMoney = (amount: number | null, currencyCode: string) =>
    formatOrderMoney(amount, currencyCode)

  useEffect(() => {
    if (!detailsOpen) return
    setSelectedOrder((prev) => {
      if (!prev) return prev
      const fresh = orders.find((o) => o.id === prev.id)
      return fresh ?? prev
    })
  }, [orders, detailsOpen])

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("es-AR", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  }

  if (isLoading || deepLinkLoading) {
    return <OrdersTableSkeleton />
  }

  return (
    <>
      {orders.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>No hay pedidos</EmptyTitle>
            <EmptyDescription>
              No hay pedidos que coincidan con tu búsqueda.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N.º de pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Logística</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="min-w-[11rem] text-right">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const isNew = highlightOrderIds.includes(order.id)
                const nextPatchStatus = getNextPatchableOrderStatus(order.status)
                return (
                  <TableRow
                    key={order.id}
                    className={cn(
                      isNew &&
                        "bg-emerald-500/[0.07] transition-colors dark:bg-emerald-500/10",
                    )}
                  >
                    <TableCell className="max-w-[9rem] font-mono text-xs font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span title={order.id}>
                          {formatShortOrderId(order.id)}
                        </span>
                        {isNew ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-normal"
                          >
                            Nuevo
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{orderCustomerLabel(order.customer)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <OrderStatusBadge status={order.status} />
                        {order.assignedDeliveryUser ? (
                          <span className="text-xs text-muted-foreground">
                            {order.assignedDeliveryUser.name?.trim() ||
                              order.assignedDeliveryUser.email}
                          </span>
                        ) : ownFleetAssignment &&
                          orderIsDeliveryFulfillment(order) &&
                          order.status === "shipped" ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Sin repartidor
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <OrderPaymentStatusBadge
                        paymentStatus={order.paymentStatus}
                      />
                    </TableCell>
                    <TableCell>
                      {formatMoney(order.totalAmount, order.currencyCode)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(order)}
                        >
                          <Eye className="mr-1.5 size-3.5" />
                          Ver detalle
                        </Button>
                        {nextPatchStatus ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={updatingOrderId === order.id}
                            onClick={() =>
                              void handleDeliveryStatusChange(
                                order,
                                nextPatchStatus,
                              )
                            }
                          >
                            Cambiar a{" "}
                            {ADMIN_PATCH_ORDER_LABEL_ES[nextPatchStatus]}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) setHighlightProofId(null)
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Detalle del pedido</DialogTitle>
            <DialogDescription>
              Información completa de este pedido.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="grid gap-6 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-sm text-muted-foreground">N.º de pedido</p>
                  <p className="break-all font-mono text-sm font-medium">
                    {selectedOrder.id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Logística</p>
                  <OrderStatusBadge status={selectedOrder.status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pago</p>
                  <OrderPaymentStatusBadge
                    paymentStatus={selectedOrder.paymentStatus}
                  />
                </div>
                {selectedOrder.paymentMethod ? (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Método de pago
                    </p>
                    <p className="font-medium capitalize">
                      {selectedOrder.paymentMethod}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">
                    {orderCustomerLabel(selectedOrder.customer)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.customer.phoneNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-medium">
                    {formatMoney(
                      selectedOrder.totalAmount,
                      selectedOrder.currencyCode,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedOrder.currencyCode}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Fecha de creación
                  </p>
                  <p className="font-medium">
                    {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>
              </div>

              {summarizeDeliverySnapshot(
                selectedOrder.deliveryAddressSnapshot,
              ) ? (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium leading-none">
                      Dirección de entrega
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {summarizeDeliverySnapshot(
                        selectedOrder.deliveryAddressSnapshot,
                      )}
                    </p>
                  </div>
                </>
              ) : null}

              {orderIsDeliveryFulfillment(selectedOrder) &&
              ownFleetAssignment &&
              (selectedOrder.status === "shipped" ||
                selectedOrder.status === "delivered") ? (
                <>
                  <Separator />
                  <OrderDeliveryAssignmentField
                    order={selectedOrder}
                    canAssign={canAssignDelivery}
                    onOrderPatched={(order) => {
                      setSelectedOrder(order)
                      onOrderPatched?.(order)
                    }}
                  />
                </>
              ) : null}

              <Separator />

              <div className="space-y-3">
                <h4 className="text-sm font-medium leading-none">
                  Ítems del pedido
                </h4>
                {selectedOrder.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay ítems en este pedido.
                  </p>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-10">Producto</TableHead>
                          <TableHead className="h-10 w-16 text-right">
                            Cant.
                          </TableHead>
                          <TableHead className="h-10 w-14 text-right">
                            Porciones
                          </TableHead>
                          <TableHead className="h-10 w-28 text-right">
                            Precio unit.
                          </TableHead>
                          <TableHead className="h-10 w-28 text-right">
                            Subtotal
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <span className="text-sm font-medium">
                                {item.name}
                              </span>
                              {item.notes ? (
                                <p className="mt-0.5 text-xs italic text-muted-foreground">
                                  {item.notes}
                                </p>
                              ) : null}
                              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                {item.menuItemId}
                              </p>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                              {item.servesPeople != null
                                ? item.servesPeople
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {item.listPrice != null ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-xs text-muted-foreground line-through">
                                    {formatMoney(
                                      item.listPrice,
                                      selectedOrder.currencyCode,
                                    )}
                                  </span>
                                  <span className="font-medium text-green-700 dark:text-green-400">
                                    {formatMoney(
                                      item.unitPrice,
                                      selectedOrder.currencyCode,
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">
                                  {formatMoney(
                                    item.unitPrice,
                                    selectedOrder.currencyCode,
                                  )}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium tabular-nums">
                              {formatMoney(
                                item.lineTotal,
                                selectedOrder.currencyCode,
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {(() => {
                const {
                  deliveryFee,
                  paymentAdjustment,
                  totalAmount,
                  currencyCode,
                  items,
                } = selectedOrder
                const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0)
                const totalItemDiscount = items.reduce((sum, it) => {
                  if (it.listPrice != null && it.discountAmount != null) {
                    return sum + it.discountAmount * it.quantity
                  }
                  return sum
                }, 0)
                const hasBreakdown =
                  totalItemDiscount > 0 ||
                  deliveryFee != null ||
                  paymentAdjustment != null

                if (!hasBreakdown) return null

                return (
                  <>
                    <Separator />
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Subtotal productos
                        </span>
                        <span className="tabular-nums">
                          {formatMoney(subtotal, currencyCode)}
                        </span>
                      </div>
                      {totalItemDiscount > 0 && (
                        <div className="flex justify-between text-green-700 dark:text-green-400">
                          <span>Descuentos en ítems</span>
                          <span className="tabular-nums">
                            −{formatMoney(totalItemDiscount, currencyCode)}
                          </span>
                        </div>
                      )}
                      {deliveryFee != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Envío</span>
                          <span className="tabular-nums">
                            +{formatMoney(deliveryFee, currencyCode)}
                          </span>
                        </div>
                      )}
                      {paymentAdjustment != null && (
                        <div
                          className={`flex justify-between ${
                            paymentAdjustment < 0
                              ? "text-green-700 dark:text-green-400"
                              : "text-orange-600 dark:text-orange-400"
                          }`}
                        >
                          <span>
                            {paymentAdjustment < 0
                              ? "Descuento efectivo"
                              : "Recargo online"}
                          </span>
                          <span className="tabular-nums">
                            {paymentAdjustment < 0
                              ? `−${formatMoney(Math.abs(paymentAdjustment), currencyCode)}`
                              : `+${formatMoney(paymentAdjustment, currencyCode)}`}
                          </span>
                        </div>
                      )}
                      <Separator className="my-1" />
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {formatMoney(totalAmount, currencyCode)}
                        </span>
                      </div>
                    </div>
                  </>
                )
              })()}

              <OrderPaymentProofs
                orderId={selectedOrder.id}
                orderCurrency={selectedOrder.currencyCode}
                forceShow={
                  isTransferMethod(selectedOrder.paymentMethod) ||
                  Boolean(highlightProofId)
                }
                highlightProofId={highlightProofId}
                onPaymentPossiblyChanged={() => {
                  void refreshSelectedOrder()
                }}
              />

              {(() => {
                const next = getNextPatchableOrderStatus(selectedOrder.status)
                if (!next) return null
                return (
                  <>
                    <Separator />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        disabled={updatingOrderId === selectedOrder.id}
                        onClick={() =>
                          void handleDeliveryStatusChange(selectedOrder, next)
                        }
                      >
                        Cambiar a {ADMIN_PATCH_ORDER_LABEL_ES[next]}
                      </Button>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function OrdersTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N.º de pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Logística</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="min-w-[11rem] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-8 w-[12rem] max-w-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
