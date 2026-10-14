export type BusinessCategoryOption = {
  value: string
  label: string
}

/**
 * Fallback si `GET /public/business-categories` falla (o durante SSR antes
 * de resolver el fetch). Debe reflejar lo que ya expone el backend
 * (`BUSINESS_CATEGORY_OPTIONS` en gesty-backend
 * `src/constants/businessCategory.ts`); si cambia ahí, actualizar acá.
 */
export const BUSINESS_CATEGORY_FALLBACK: BusinessCategoryOption[] = [
  { value: "BURGERS", label: "Hamburguesas" },
  { value: "PIZZA", label: "Pizza" },
  { value: "SUSHI", label: "Sushi" },
  { value: "HOME_MADE", label: "Comida casera" },
  { value: "EMPANADAS", label: "Empanadas" },
  { value: "HEALTHY", label: "Saludable" },
  { value: "OTHER", label: "Otra" },
]

export function businessCategoryLabel(
  options: BusinessCategoryOption[],
  value: string | null | undefined,
): string | null {
  if (!value) return null
  return options.find((opt) => opt.value === value)?.label ?? null
}
