"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ShoppingCart,
  CalendarDays,
  CalendarClock,
  LayoutDashboard,
  QrCode,
  Truck,
  MessageSquare,
  UtensilsCrossed,
  MapPin,
  Settings,
  Armchair,
  Clock3,
  Building2,
  CreditCard,
  BadgePercent,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getUserRoleFromCookie } from "@/lib/auth"
import { canAccessPath, type UserRole } from "@/lib/access-control"
import { useAdminSocket } from "@/contexts/admin-socket-context"

const navItems: {
  title: string
  href: string
  icon: typeof LayoutDashboard
  allowedRoles?: UserRole[]
}[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Pedidos",
    href: "/orders",
    icon: ShoppingCart,
  },
  {
    title: "Menú",
    href: "/menu-items",
    icon: UtensilsCrossed,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Promociones",
    href: "/promotions",
    icon: Sparkles,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Reservas",
    href: "/reservations",
    icon: CalendarDays,
  },
  {
    title: "Mesas",
    href: "/tables",
    icon: Armchair,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Horarios",
    href: "/hours",
    icon: Clock3,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Slots de reserva",
    href: "/reservation-slots",
    icon: CalendarClock,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Mensajes",
    href: "/messages",
    icon: MessageSquare,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Check-in",
    href: "/check-in",
    icon: QrCode,
    allowedRoles: ["STAFF"],
  },
  {
    title: "Entregas",
    href: "/delivery",
    icon: Truck,
    allowedRoles: ["DELIVERY"],
  },
  {
    title: "Zonas de entrega",
    href: "/delivery-zones",
    icon: MapPin,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Pagos online",
    href: "/online-payments",
    icon: CreditCard,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Ajustes de pago",
    href: "/payment-method-configs",
    icon: BadgePercent,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Usuarios",
    href: "/users",
    icon: Users,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Mi negocio",
    href: "/my-business",
    icon: Building2,
    allowedRoles: ["OWNER"],
  },
  {
    title: "Facturación",
    href: "/billing",
    icon: Wallet,
    allowedRoles: ["ADMIN", "OWNER"],
  },
  {
    title: "Configuración",
    href: "/settings",
    icon: Settings,
    allowedRoles: ["ADMIN", "OWNER"],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<UserRole>("UNKNOWN")
  const { whatsappSupportPendingCount } = useAdminSocket()

  useEffect(() => {
    setRole(getUserRoleFromCookie())
  }, [])

  const visibleItems = navItems.filter((item) =>
    item.allowedRoles ? item.allowedRoles.includes(role) : canAccessPath(role, item.href)
  )

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
            <LayoutDashboard className="size-4" />
          </div>
          <span className="text-lg font-semibold">Admin</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname === item.href ||
                          pathname.startsWith(`${item.href}/`)
                    }
                  >
                    <Link
                      href={item.href}
                      className="flex min-w-0 w-full items-center gap-2"
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.href === "/messages" && whatsappSupportPendingCount > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-semibold text-white">
                          {whatsappSupportPendingCount > 9
                            ? "9+"
                            : whatsappSupportPendingCount}
                        </span>
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
