export type ShoppingCategoryTag =
  | "STARTER"
  | "MAIN"
  | "DRINK"
  | "DESSERT"
  | "SIDE"
  | "SALAD"
  | "SNACK"
  | "SPECIAL"
  | (string & {})

export interface ShoppingMapCenter {
  latitude: number
  longitude: number
}

export interface ShoppingBusiness {
  id: string
  slug: string | null
  name: string
  tagline: string | null
  currencyCode: string
  imageUrl: string | null
  isOpen?: boolean
  nextOpenText?: string | null
  /** Solo para centrar el mapa de destino (no es la dirección del cliente). */
  mapCenter?: ShoppingMapCenter | null
}

export interface ShoppingCategory {
  id: string
  name: string
  tag: ShoppingCategoryTag
  position?: number
}

export interface ShoppingProduct {
  id: string
  name: string
  description: string | null
  price: number
  currencyCode: string
  imageUrl: string | null
  categoryId: string
  available: boolean
  /** Personas que alimenta la porción (si el menú público lo expone). */
  servesPeople?: number | null
  ingredients?: string | null
  ingredientsNotes?: string | null
  preparation?: string | null
  variations?: string[] | null
}

export interface ShoppingCatalog {
  business: ShoppingBusiness
  categories: ShoppingCategory[]
  products: ShoppingProduct[]
}

/** Entrada de la vitrina global (`/shopping`), antes de elegir un local. */
export interface ShoppingStorefrontSummary {
  id: string
  slug: string
  name: string
  tagline: string | null
  /** Código fijo (ver `BUSINESS_CATEGORY_OPTIONS`), null = sin categoría. */
  category: string | null
  imageUrl: string | null
  isOpen?: boolean
  nextOpenText?: string | null
}

export interface CartLine {
  productId: string
  quantity: number
}
