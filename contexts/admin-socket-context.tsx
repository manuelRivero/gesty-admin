"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { io, type Socket } from "socket.io-client"
import { toast } from "sonner"

import { getAuthCookie, getUserIdFromCookie } from "@/lib/auth"
import { getSocketBaseUrl } from "@/lib/socket-base-url"
import { cn } from "@/lib/utils"
import { getOrderStatusLabelEs } from "@/lib/constants/orderWorkflow"
import {
  startSupportAlertLoop,
  stopSupportAlertLoop,
} from "@/lib/support-alert-audio"
import {
  isAdminOrderRealtimePayload,
  isAdminReservationRealtimePayload,
  isAdminWhatsappMessageCreatedPayload,
  isAdminWhatsappSupportRequestedPayload,
  isAdminWhatsappBotAutoReactivatedPayload,
  isAdminConversationSentimentPayload,
  isAdminTableTabRealtimePayload,
  isAdminKitchenTicketItemReadyForPickupPayload,
  type AdminOrderRealtimePayload,
  type AdminReservationRealtimePayload,
  type AdminWhatsappRealtimePayload,
  type AdminConversationSentimentPayload,
  type AdminTableTabRealtimePayload,
} from "@/lib/types/admin-realtime"
import {
  getSentimentLabelEs,
  getSentimentVisualStyle,
  isNegativeConversationSentiment,
} from "@/lib/constants/conversationSentiment"

export type AdminNotificationKind =
  | "order"
  | "reservation"
  | "whatsapp_support"
  | "table_tab"
  | "kitchen_ready"

export interface AdminNotification {
  id: string
  kind: AdminNotificationKind
  resourceId: string
  at: string
  title: string
  subtitle?: string
  read: boolean
}

export type WhatsappSupportConversationMeta = {
  customerName: string
  customerPhone: string
  at: string
}

export type WhatsappSentimentConversationMeta = {
  sentiment: AdminConversationSentimentPayload["sentiment"]
  summary: string
  updatedAt: string
}

type AdminSocketContextValue = {
  isConnected: boolean
  notifications: AdminNotification[]
  badgeCount: number
  removeNotification: (id: string) => void
  /** Conversaciones con solicitud de soporte pendiente (badge listado / sidebar). */
  whatsappSupportByConversation: Record<string, WhatsappSupportConversationMeta>
  whatsappSupportPendingCount: number
  acknowledgeWhatsappSupportConversation: (conversationId: string) => void
  /** Evento `admin:order` con payload discriminado (created / status / payment proofs). */
  subscribeToOrderRealtime: (
    cb: (payload: AdminOrderRealtimePayload) => void,
  ) => () => void
  /** Evento `admin:reservation` con payload discriminado (created / cancelled / edit_started). */
  subscribeToReservationRealtime: (
    cb: (payload: AdminReservationRealtimePayload) => void,
  ) => () => void
  /** Evento `admin:whatsapp` (`whatsapp.message_created` | `whatsapp.support_requested`). */
  subscribeToWhatsappRealtime: (
    cb: (payload: AdminWhatsappRealtimePayload) => void,
  ) => () => void
  /** Evento `admin:conversation_sentiment` (`conversation.sentiment_updated`). */
  whatsappSentimentByConversation: Record<string, WhatsappSentimentConversationMeta>
  subscribeToConversationSentiment: (
    cb: (payload: AdminConversationSentimentPayload) => void,
  ) => () => void
  /** Evento `admin:table_tab` (`table_tab.closed`) — ciclo de vida de la cuenta de salón. */
  subscribeToTableTabRealtime: (
    cb: (payload: AdminTableTabRealtimePayload) => void,
  ) => () => void
}

function isMessagesPath(path: string): boolean {
  return path === "/messages" || path.startsWith("/messages/")
}

const AdminSocketContext = createContext<AdminSocketContextValue | null>(null)

function shouldNotifyBellForOrder(payload: AdminOrderRealtimePayload): boolean {
  return (
    payload.type === "order.created" ||
    payload.type === "order.status_changed" ||
    payload.type === "order.payment_status_changed" ||
    payload.type === "order.payment_proof_checked"
  )
}

function notificationTitleForOrder(payload: AdminOrderRealtimePayload): string {
  switch (payload.type) {
    case "order.created":
      return "Nuevo pedido"
    case "order.status_changed":
      return "Estado del pedido actualizado"
    case "order.payment_status_changed":
      return "Estado de pago actualizado"
    case "order.payment_proof_checked":
      return "Comprobante de transferencia"
    case "order.payment_proof_received":
      return "Comprobante recibido"
    default:
      return "Pedido"
  }
}

function notificationSubtitleForOrder(
  payload: AdminOrderRealtimePayload,
): string | undefined {
  switch (payload.type) {
    case "order.created":
      if (payload.total != null && payload.currency) {
        return `${payload.total} ${payload.currency}`
      }
      return payload.total != null ? String(payload.total) : undefined
    case "order.status_changed":
      return getOrderStatusLabelEs(payload.status)
    case "order.payment_status_changed":
      return payload.payment_status
    case "order.payment_proof_checked":
      return payload.message
    default:
      return undefined
  }
}

function notificationTitleForReservation(
  payload: AdminReservationRealtimePayload,
): string {
  switch (payload.type) {
    case "reservation.created":
      return "Nueva reserva"
    case "reservation.cancelled":
      return "Reserva cancelada"
    case "reservation.edit_started":
      return "Edición de reserva"
    default:
      return "Reserva"
  }
}

export function AdminSocketProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [whatsappSupportByConversation, setWhatsappSupportByConversation] =
    useState<Record<string, WhatsappSupportConversationMeta>>({})
  const [whatsappSentimentByConversation, setWhatsappSentimentByConversation] =
    useState<Record<string, WhatsappSentimentConversationMeta>>({})

  const orderRealtimeListenersRef = useRef(
    new Set<(payload: AdminOrderRealtimePayload) => void>(),
  )
  const reservationRealtimeListenersRef = useRef(
    new Set<(payload: AdminReservationRealtimePayload) => void>(),
  )
  const whatsappRealtimeListenersRef = useRef(
    new Set<(payload: AdminWhatsappRealtimePayload) => void>(),
  )
  const conversationSentimentListenersRef = useRef(
    new Set<(payload: AdminConversationSentimentPayload) => void>(),
  )
  const tableTabRealtimeListenersRef = useRef(
    new Set<(payload: AdminTableTabRealtimePayload) => void>(),
  )
  const socketRef = useRef<Socket | null>(null)

  const subscribeToOrderRealtime = useCallback(
    (cb: (payload: AdminOrderRealtimePayload) => void) => {
      orderRealtimeListenersRef.current.add(cb)
      return () => {
        orderRealtimeListenersRef.current.delete(cb)
      }
    },
    [],
  )

  const subscribeToReservationRealtime = useCallback(
    (cb: (payload: AdminReservationRealtimePayload) => void) => {
      reservationRealtimeListenersRef.current.add(cb)
      return () => {
        reservationRealtimeListenersRef.current.delete(cb)
      }
    },
    [],
  )

  const subscribeToWhatsappRealtime = useCallback(
    (cb: (payload: AdminWhatsappRealtimePayload) => void) => {
      whatsappRealtimeListenersRef.current.add(cb)
      return () => {
        whatsappRealtimeListenersRef.current.delete(cb)
      }
    },
    [],
  )

  const subscribeToConversationSentiment = useCallback(
    (cb: (payload: AdminConversationSentimentPayload) => void) => {
      conversationSentimentListenersRef.current.add(cb)
      return () => {
        conversationSentimentListenersRef.current.delete(cb)
      }
    },
    [],
  )

  const subscribeToTableTabRealtime = useCallback(
    (cb: (payload: AdminTableTabRealtimePayload) => void) => {
      tableTabRealtimeListenersRef.current.add(cb)
      return () => {
        tableTabRealtimeListenersRef.current.delete(cb)
      }
    },
    [],
  )

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const acknowledgeWhatsappSupportConversation = useCallback(
    (conversationId: string) => {
      setWhatsappSupportByConversation((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, conversationId)) {
          return prev
        }
        const { [conversationId]: _removed, ...rest } = prev
        return rest
      })
      setNotifications((prev) =>
        prev.filter(
          (n) =>
            !(
              n.kind === "whatsapp_support" &&
              n.resourceId === conversationId
            ),
        ),
      )
    },
    [],
  )

  const whatsappSupportPendingCount = useMemo(
    () => Object.keys(whatsappSupportByConversation).length,
    [whatsappSupportByConversation],
  )

  useEffect(() => {
    if (isMessagesPath(pathname)) {
      stopSupportAlertLoop()
    }
  }, [pathname])

  useEffect(() => {
    if (pathname === "/orders") {
      setNotifications((prev) =>
        prev.map((n) => (n.kind === "order" ? { ...n, read: true } : n)),
      )
    }
  }, [pathname])

  useEffect(() => {
    if (pathname === "/reservations") {
      setNotifications((prev) =>
        prev.map((n) =>
          n.kind === "reservation" ? { ...n, read: true } : n,
        ),
      )
    }
  }, [pathname])

  useEffect(() => {
    if (pathname === "/pos") {
      setNotifications((prev) =>
        prev.map((n) =>
          n.kind === "table_tab" || n.kind === "kitchen_ready" ? { ...n, read: true } : n,
        ),
      )
    }
  }, [pathname])

  const badgeCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  useEffect(() => {
    const token = getAuthCookie()
    const base = getSocketBaseUrl()
    if (!token || !base) {
      return
    }

    const socket = io(base, {
      path: "/socket.io",
      auth: { token },
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    })

    socketRef.current = socket

    socket.on("connect", () => setIsConnected(true))
    socket.on("disconnect", () => setIsConnected(false))
    socket.on("connect_error", () => setIsConnected(false))

    socket.on("admin:order", (raw: unknown) => {
      if (!isAdminOrderRealtimePayload(raw)) {
        return
      }
      const p = raw
      orderRealtimeListenersRef.current.forEach((fn) => {
        try {
          fn(p)
        } catch {
          /* noop */
        }
      })

      if (p.type === "order.payment_proof_checked") {
        const orderQuery = encodeURIComponent(p.orderId)
        const proofQuery = encodeURIComponent(p.proofId)
        const openOrder = () => {
          routerRef.current.push(
            `/orders?orderId=${orderQuery}&proofId=${proofQuery}`,
          )
        }

        toast.custom(
          (tid) => (
            <button
              type="button"
              className="group flex w-full max-w-sm flex-col gap-0.5 rounded-lg border border-emerald-400/70 bg-emerald-50 px-3 py-3 text-left text-emerald-950 shadow-md transition hover:bg-emerald-100/90"
              onClick={() => {
                toast.dismiss(tid)
                openOrder()
              }}
            >
              <span className="text-sm font-semibold leading-snug">
                Comprobante de transferencia
              </span>
              <span className="text-xs leading-snug text-emerald-900/90">
                {p.message}
              </span>
              <span className="pt-0.5 text-[11px] font-medium text-emerald-800 underline-offset-2 group-hover:underline">
                Tocar para abrir el pedido #{p.orderRef}
              </span>
            </button>
          ),
          { duration: 60_000 },
        )
      }

      // `payment_proof_received`: solo listeners (refetch). Sin toast ni campana.
      if (!shouldNotifyBellForOrder(p)) {
        return
      }

      const path = pathnameRef.current
      const read = path === "/orders"
      const orderId = p.orderId
      const title = notificationTitleForOrder(p)
      const subtitle = notificationSubtitleForOrder(p)

      setNotifications((prev) => {
        const next: AdminNotification = {
          id: `${p.type}-${orderId}-${Date.now()}`,
          kind: "order",
          resourceId: orderId,
          at: p.at,
          title,
          subtitle,
          read,
        }
        return [next, ...prev].slice(0, 40)
      })
    })

    socket.on("admin:reservation", (raw: unknown) => {
      if (!isAdminReservationRealtimePayload(raw)) {
        return
      }
      const p = raw
      reservationRealtimeListenersRef.current.forEach((fn) => {
        try {
          fn(p)
        } catch {
          /* noop */
        }
      })

      const path = pathnameRef.current
      const read = path === "/reservations"
      const title = notificationTitleForReservation(p)
      const subtitle =
        p.type === "reservation.cancelled" ? `Estado: ${p.status}` : undefined

      setNotifications((prev) => {
        const next: AdminNotification = {
          id: `${p.type}-${p.reservationId}-${Date.now()}`,
          kind: "reservation",
          resourceId: p.reservationId,
          at: p.at,
          title,
          subtitle,
          read,
        }
        return [next, ...prev].slice(0, 40)
      })
    })

    socket.on("admin:whatsapp", (raw: unknown) => {
      if (isAdminWhatsappMessageCreatedPayload(raw)) {
        const p = raw
        whatsappRealtimeListenersRef.current.forEach((fn) => {
          try {
            fn(p)
          } catch {
            /* noop */
          }
        })
        return
      }

      if (isAdminWhatsappBotAutoReactivatedPayload(raw)) {
        const p = raw
        whatsappRealtimeListenersRef.current.forEach((fn) => {
          try {
            fn(p)
          } catch {
            /* noop */
          }
        })
        return
      }

      if (isAdminWhatsappSupportRequestedPayload(raw)) {
        const p = raw
        whatsappRealtimeListenersRef.current.forEach((fn) => {
          try {
            fn(p)
          } catch {
            /* noop */
          }
        })

        const trimmedName = (p.customerName ?? "").trim()
        const contactLabel =
          trimmedName.length > 0 ? trimmedName : "Usuario no agendado"
        const subtitle = `${contactLabel} · ${p.customerPhone}`

        setWhatsappSupportByConversation((prev) => ({
          ...prev,
          [p.conversationId]: {
            customerName: contactLabel,
            customerPhone: p.customerPhone,
            at: p.at,
          },
        }))

        setNotifications((prev) => {
          const next: AdminNotification = {
            id: `${p.type}-${p.conversationId}-${Date.now()}`,
            kind: "whatsapp_support",
            resourceId: p.conversationId,
            at: p.at,
            title: "Cliente necesita atención (WhatsApp)",
            subtitle,
            read: false,
          }
          return [next, ...prev].slice(0, 40)
        })

        const path = pathnameRef.current
        const onMessages = isMessagesPath(path)
        if (!onMessages) {
          startSupportAlertLoop()
        }

        const conversationQuery = encodeURIComponent(p.conversationId)
        const openChat = () => {
          routerRef.current.push(`/messages?conversation=${conversationQuery}`)
        }

        toast.custom(
          (tid) => (
            <button
              type="button"
              className="group flex w-full max-w-sm flex-col gap-0.5 rounded-lg border border-amber-400/70 bg-amber-50 px-3 py-3 text-left text-amber-950 shadow-md transition hover:bg-amber-100/90"
              onClick={() => {
                toast.dismiss(tid)
                openChat()
              }}
            >
              <span className="text-sm font-semibold leading-snug">
                Un cliente necesita atención en WhatsApp
              </span>
              <span className="text-xs leading-snug text-amber-900/90">
                {subtitle}
              </span>
              <span className="pt-0.5 text-[11px] font-medium text-amber-800 underline-offset-2 group-hover:underline">
                Tocar para abrir la conversación
              </span>
            </button>
          ),
          { duration: 60_000 },
        )

        return
      }
    })

    socket.on("admin:conversation_sentiment", (raw: unknown) => {
      if (!isAdminConversationSentimentPayload(raw)) {
        return
      }
      const p = raw

      setWhatsappSentimentByConversation((prev) => ({
        ...prev,
        [p.conversationId]: {
          sentiment: p.sentiment,
          summary: p.summary,
          updatedAt: p.updatedAt,
        },
      }))

      conversationSentimentListenersRef.current.forEach((fn) => {
        try {
          fn(p)
        } catch {
          /* noop */
        }
      })

      const isNegative = isNegativeConversationSentiment(p.sentiment)
      const onMessages = isMessagesPath(pathnameRef.current)

      if (!isNegative || onMessages) {
        return
      }

      const sentimentLabel = getSentimentLabelEs(p.sentiment)
      const sentimentStyle = getSentimentVisualStyle(p.sentiment)
      const conversationQuery = encodeURIComponent(p.conversationId)
      const openChat = () => {
        routerRef.current.push(`/messages?conversation=${conversationQuery}`)
      }

      toast.custom(
        (tid) => (
          <button
            type="button"
            className={cn(
              "group flex w-full max-w-sm flex-col gap-1 rounded-lg border px-3 py-3 text-left shadow-md transition hover:opacity-95",
              sentimentStyle.banner,
            )}
            onClick={() => {
              toast.dismiss(tid)
              openChat()
            }}
          >
            <span className="text-sm font-semibold leading-snug">
              Sentimiento detectado: {sentimentLabel}
            </span>
            <span className="text-xs leading-snug opacity-90">{p.summary}</span>
            <span className="pt-0.5 text-[11px] font-medium underline-offset-2 group-hover:underline">
              Tocar para abrir la conversación
            </span>
          </button>
        ),
        { duration: 60_000 },
      )
    })

    socket.on("admin:table_tab", (raw: unknown) => {
      if (!isAdminTableTabRealtimePayload(raw)) {
        return
      }
      const p = raw
      tableTabRealtimeListenersRef.current.forEach((fn) => {
        try {
          fn(p)
        } catch {
          /* noop */
        }
      })

      // Aviso al mozo responsable de que ADMIN/OWNER cerraron su mesa — a
      // nivel de contexto (no de la página `/pos`) para que llegue aunque el
      // mozo esté en `/kds` u otra pantalla en ese momento, y quede además en
      // la campana para el caso de que no lo haya visto en el momento (el
      // mozo hoy no tiene forma de verlo si no es por acá, ver §4.F).
      if (p.type === "table_tab.closed" && p.assignedUserAppUserId === getUserIdFromCookie()) {
        const tableLabel = p.tableNames.length > 0 ? p.tableNames.join(", ") : "Tu mesa"
        toast.success(`${tableLabel}: la cuenta fue cerrada.`)

        const read = pathnameRef.current === "/pos"
        setNotifications((prev) => {
          const next: AdminNotification = {
            id: `${p.type}-${p.tableTabId}-${Date.now()}`,
            kind: "table_tab",
            resourceId: p.tableTabId,
            at: p.at,
            title: `${tableLabel}: cuenta cerrada`,
            subtitle: "Ya podés atender otra mesa.",
            read,
          }
          return [next, ...prev].slice(0, 40)
        })
      }
    })

    // Aviso al mozo de que su comanda está lista para retirar — mismo criterio
    // que `table_tab.closed`: llega aunque esté en `/kds` u otra pantalla, y
    // queda en la campana si no lo vio en el momento.
    socket.on("admin:kitchen", (raw: unknown) => {
      if (!isAdminKitchenTicketItemReadyForPickupPayload(raw)) {
        return
      }
      const p = raw
      if (p.assignedUserAppUserId !== getUserIdFromCookie()) {
        return
      }

      const tableLabel = p.tableNames.length > 0 ? p.tableNames.join(", ") : "tu mesa"
      toast.success(`Listo para retirar: ${p.quantity}× ${p.menuItemName} (${tableLabel})`)

      const read = pathnameRef.current === "/pos"
      setNotifications((prev) => {
        const next: AdminNotification = {
          id: `${p.type}-${p.kitchenTicketItemId}-${Date.now()}`,
          kind: "kitchen_ready",
          resourceId: p.kitchenTicketItemId,
          at: p.at,
          title: `${p.quantity}× ${p.menuItemName} listo`,
          subtitle: tableLabel,
          read,
        }
        return [next, ...prev].slice(0, 40)
      })
    })

    return () => {
      stopSupportAlertLoop()
      socket.removeAllListeners()
      socket.close()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [])

  const value = useMemo<AdminSocketContextValue>(
    () => ({
      isConnected,
      notifications,
      badgeCount,
      removeNotification,
      whatsappSupportByConversation,
      whatsappSupportPendingCount,
      acknowledgeWhatsappSupportConversation,
      subscribeToOrderRealtime,
      subscribeToReservationRealtime,
      subscribeToWhatsappRealtime,
      subscribeToConversationSentiment,
      whatsappSentimentByConversation,
      subscribeToTableTabRealtime,
    }),
    [
      isConnected,
      notifications,
      badgeCount,
      removeNotification,
      whatsappSupportByConversation,
      whatsappSupportPendingCount,
      acknowledgeWhatsappSupportConversation,
      subscribeToOrderRealtime,
      subscribeToReservationRealtime,
      subscribeToWhatsappRealtime,
      subscribeToConversationSentiment,
      whatsappSentimentByConversation,
      subscribeToTableTabRealtime,
    ],
  )

  return (
    <AdminSocketContext.Provider value={value}>
      {children}
    </AdminSocketContext.Provider>
  )
}

export function useAdminSocket() {
  const ctx = useContext(AdminSocketContext)
  if (!ctx) {
    throw new Error("useAdminSocket debe usarse dentro de AdminSocketProvider")
  }
  return ctx
}
