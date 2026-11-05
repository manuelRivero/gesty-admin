"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Megaphone, Receipt, Shield } from "lucide-react"

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

const BUSINESSES_HREF = "/super-admin/businesses"
const ANNOUNCEMENTS_HREF = "/super-admin/announcements"
const INVOICING_HREF = "/super-admin/invoicing"

export function SuperAdminSidebar() {
  const pathname = usePathname()
  const businessesActive =
    pathname === BUSINESSES_HREF || pathname.startsWith(`${BUSINESSES_HREF}/`)
  const announcementsActive =
    pathname === ANNOUNCEMENTS_HREF || pathname.startsWith(`${ANNOUNCEMENTS_HREF}/`)
  const invoicingActive =
    pathname === INVOICING_HREF || pathname.startsWith(`${INVOICING_HREF}/`)

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href={BUSINESSES_HREF} className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
            <Shield className="size-4" />
          </div>
          <span className="text-lg font-semibold">Superadministración</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={businessesActive}>
                  <Link href={BUSINESSES_HREF}>
                    <Building2 className="size-4" />
                    <span>Negocios</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={announcementsActive}>
                  <Link href={ANNOUNCEMENTS_HREF}>
                    <Megaphone className="size-4" />
                    <span>Anuncios</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={invoicingActive}>
                  <Link href={INVOICING_HREF}>
                    <Receipt className="size-4" />
                    <span>Facturación</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
