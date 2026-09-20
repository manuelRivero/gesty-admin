"use client"

import { cn } from "@/lib/utils"

import type { ShoppingCategory } from "./types"

type CategoryTagsProps = {
  categories: ShoppingCategory[]
  selectedId: string | null
  onSelect: (categoryId: string | null) => void
}

export function CategoryTags({
  categories,
  selectedId,
  onSelect,
}: CategoryTagsProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2 pb-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            selectedId === null
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:bg-accent",
          )}
        >
          Todos
        </button>
        {categories.map((category) => {
          const active = selectedId === category.id
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              {category.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
