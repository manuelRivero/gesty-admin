"use client"

import { Toaster } from "sonner"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { BillingPaywallBanner } from "@/components/billing/paywall-banner"
import { SuperAdminSidebar } from "@/components/super-admin/super-admin-sidebar"
import { Header } from "@/components/header"
import { AdminSocketProvider } from "@/contexts/admin-socket-context"
import { AnnouncementsInboxProvider } from "@/contexts/announcements-inbox-context"
import { AnnouncementsInboxModal } from "@/components/announcements/announcements-inbox-modal"

export function DashboardLayoutClient({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: "default" | "super-admin"
}) {
  const shell = (
    <>
      {variant === "super-admin" ? <SuperAdminSidebar /> : <AppSidebar />}
      <SidebarInset>
        <Toaster richColors closeButton position="top-right" />
        <Header />
        {variant === "default" ? <BillingPaywallBanner /> : null}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  )

  return (
    <SidebarProvider>
      <AdminSocketProvider>
        {variant === "default" ? (
          <AnnouncementsInboxProvider>
            {shell}
            <AnnouncementsInboxModal />
          </AnnouncementsInboxProvider>
        ) : (
          shell
        )}
      </AdminSocketProvider>
    </SidebarProvider>
  )
}
