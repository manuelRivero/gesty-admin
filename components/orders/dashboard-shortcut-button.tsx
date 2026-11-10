import Link from "next/link"
import { LayoutDashboard } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Acceso directo al Dashboard — ya no vive en el sidebar (ver app-sidebar.tsx). */
export function DashboardShortcutButton() {
  return (
    <Button variant="outline" asChild>
      <Link href="/">
        <LayoutDashboard className="size-4" />
        Dashboard
      </Link>
    </Button>
  )
}
