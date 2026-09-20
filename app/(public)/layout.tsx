import { Toaster } from "sonner"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background min-h-dvh">
      <Toaster richColors closeButton position="top-center" />
      {children}
    </div>
  )
}
