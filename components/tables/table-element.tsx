import { Users } from "lucide-react"

import { cn } from "@/lib/utils"
import type { UiTable } from "@/lib/requests/admin-tables"

export type TableElementColor = "active" | "inactive" | "free" | "occupied" | "paid_pending_close"

const COLOR_CLASSES: Record<TableElementColor, string> = {
  active: "bg-emerald-500",
  inactive: "bg-gray-400",
  free: "bg-emerald-500",
  occupied: "bg-rose-500",
  /** Saldo en $0 pero la cuenta todavía no se cerró — alguien puede estar esperando sentado. */
  paid_pending_close: "bg-amber-500",
}

/**
 * Representación visual de una mesa sobre el plano — compartida entre el
 * editor (`/tables`, con drag) y las vistas de solo lectura (`/pos`, sin
 * drag). El color es parametrizable (`color`) porque cada vista lo deriva de
 * un estado distinto: activa/inactiva en el editor, libre/ocupada en `/pos`.
 */
export function TableElement({
  table,
  color,
  isSelected,
  highlighted = false,
  topLabel,
  topLabelTitle,
  subLabel,
  onMouseDown,
  onClick,
}: {
  table: UiTable
  color: TableElementColor
  isSelected: boolean
  /** Resalta la mesa (p. ej. reservas del día en el editor) sin seleccionarla. */
  highlighted?: boolean
  /** Línea corta sobre la capacidad — p. ej. horario de reserva. */
  topLabel?: string
  topLabelTitle?: string
  /** Línea debajo del nombre — p. ej. "Mozo: Juan" en `/pos`. */
  subLabel?: string
  onMouseDown?: (e: React.MouseEvent) => void
  onClick?: (e: React.MouseEvent) => void
}) {
  const baseClasses = cn(
    "absolute flex flex-col items-center justify-center border-2 transition-shadow",
    COLOR_CLASSES[color],
    onMouseDown ? "cursor-move" : "cursor-pointer",
    isSelected && "z-10 ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg",
    !isSelected && highlighted && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background shadow-md",
    !isSelected && !highlighted && "hover:shadow-md",
  )

  const size = table.shape === "circle" ? 64 : undefined
  const width = table.shape === "rect" ? (table.width ?? 100) : size
  const height = table.shape === "rect" ? (table.height ?? 60) : size

  return (
    <div
      className={cn(baseClasses, table.shape === "circle" ? "rounded-full" : "rounded-lg")}
      style={{
        left: table.x,
        top: table.y,
        width,
        height,
        transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <span className="text-center text-sm font-bold text-white drop-shadow-sm">
        {table.name}
      </span>
      {topLabel ? (
        <span
          className="mt-0.5 line-clamp-2 max-w-[95%] text-center text-[10px] font-medium leading-tight text-white drop-shadow"
          title={topLabelTitle}
        >
          {topLabel}
        </span>
      ) : null}
      {subLabel ? (
        <span className="line-clamp-1 max-w-[95%] text-center text-[10px] text-white/90">
          {subLabel}
        </span>
      ) : null}
      <span className="flex items-center gap-0.5 text-xs text-white/90">
        <Users className="h-3 w-3" />
        {table.capacity}
      </span>
    </div>
  )
}

/** Clase compartida del contenedor del plano (grilla punteada) — mismo fondo en `/tables` y `/pos`. */
export const FLOOR_PLAN_CANVAS_CLASSNAME = cn(
  "relative h-[600px] select-none overflow-hidden",
  "bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)]",
  "bg-[size:20px_20px]",
)
