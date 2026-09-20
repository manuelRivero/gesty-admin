export type ShoppingCustomerContact = {
  name: string
  phone: string
}

export type ShoppingCustomerContactErrors = {
  name?: string
  phone?: string
}

const NAME_MIN = 2
const NAME_MAX = 80
const PHONE_DIGITS_MIN = 8
const PHONE_DIGITS_MAX = 15

/** Deja solo dígitos (útil para validar y para el POST). */
export function digitsOnlyPhone(value: string): string {
  return value.replace(/\D/g, "")
}

export function validateCustomerName(name: string): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return "Ingresá tu nombre"
  if (trimmed.length < NAME_MIN) return "El nombre es muy corto"
  if (trimmed.length > NAME_MAX) return "El nombre es muy largo"
  return undefined
}

export function validateCustomerPhone(phone: string): string | undefined {
  const digits = digitsOnlyPhone(phone)
  if (!digits) return "Ingresá tu teléfono"
  if (digits.length < PHONE_DIGITS_MIN) return "El teléfono es muy corto"
  if (digits.length > PHONE_DIGITS_MAX) return "El teléfono es muy largo"
  return undefined
}

export function validateCustomerContact(
  contact: ShoppingCustomerContact,
): ShoppingCustomerContactErrors {
  return {
    name: validateCustomerName(contact.name),
    phone: validateCustomerPhone(contact.phone),
  }
}

export function isCustomerContactValid(
  contact: ShoppingCustomerContact,
): boolean {
  const errors = validateCustomerContact(contact)
  return !errors.name && !errors.phone
}

/** Payload de contacto para `POST …/orders`. */
export function toCustomerContactPayload(contact: ShoppingCustomerContact): {
  name: string
  phone: string
} {
  return {
    name: contact.name.trim(),
    phone: digitsOnlyPhone(contact.phone),
  }
}
