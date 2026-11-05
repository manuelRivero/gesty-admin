import { ShieldAlert } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function EmissionDisabledNotice() {
  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <ShieldAlert className="text-amber-600" />
      <AlertTitle>Emisión real deshabilitada</AlertTitle>
      <AlertDescription>
        Esta sección está preparada para configurar y revisar la facturación electrónica, pero
        la emisión de comprobantes todavía no está habilitada para operar con una cuenta real.
        La habilitación depende de que se complete la configuración y validación operativa
        correspondiente. Ningún botón de esta sección genera comprobantes fiscales.
      </AlertDescription>
    </Alert>
  )
}
