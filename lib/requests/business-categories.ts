import { publicApi } from "@/lib/api"
import {
  BUSINESS_CATEGORY_FALLBACK,
  type BusinessCategoryOption,
} from "@/lib/business-categories"

type BusinessCategoriesRaw = {
  categories?: Array<{ value?: string | null; label?: string | null }>
}

/**
 * Catálogo fijo de rubros gastronómicos.
 * `GET /public/business-categories`
 * Usado tanto por el dropdown de "Mi negocio" (admin) como por los
 * chips de filtro del home de Shopping. Si el fetch falla, se usa el
 * fallback local para no romper esas pantallas.
 */
export async function fetchBusinessCategories(): Promise<
  BusinessCategoryOption[]
> {
  try {
    const { data } = await publicApi.get<BusinessCategoriesRaw>(
      "/public/business-categories",
    )
    const options = (data.categories ?? [])
      .map((c) => ({
        value: c.value?.trim() ?? "",
        label: c.label?.trim() ?? "",
      }))
      .filter((c) => c.value && c.label)

    return options.length > 0 ? options : BUSINESS_CATEGORY_FALLBACK
  } catch {
    return BUSINESS_CATEGORY_FALLBACK
  }
}
