/**
 * Validación local de CUIT, antes de gastar una consulta al padrón. Mismo algoritmo que
 * `gesty-backend/src/services/invoicing/cuitValidator.ts` (11 dígitos + dígito verificador
 * módulo 11) — se duplica a propósito porque es una validación pura sin estado, no justifica un
 * roundtrip al backend solo para validar formato.
 */
export function normalizeCuit(cuit: string): string {
  return cuit.replace(/\D/g, "")
}

export function isValidCuit(cuit: string): boolean {
  const digits = normalizeCuit(cuit)
  if (digits.length !== 11) return false

  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = multipliers.reduce((acc, m, i) => acc + m * Number(digits[i]), 0)
  const mod = sum % 11
  const expected = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod

  return expected === Number(digits[10])
}
