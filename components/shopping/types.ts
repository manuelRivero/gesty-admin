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
}

export interface ShoppingCatalog {
  business: ShoppingBusiness
  categories: ShoppingCategory[]
  products: ShoppingProduct[]
}

export interface CartLine {
  productId: string
  quantity: number
}
