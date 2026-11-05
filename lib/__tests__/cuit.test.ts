import { describe, expect, it } from "vitest"

import { isValidCuit, normalizeCuit } from "../cuit"

describe("normalizeCuit", () => {
  it("elimina guiones y espacios, deja solo dígitos", () => {
    expect(normalizeCuit("20-12345678-6")).toBe("20123456786")
    expect(normalizeCuit(" 20 12345678 6 ")).toBe("20123456786")
  })
})

describe("isValidCuit", () => {
  it("acepta un CUIT con dígito verificador correcto, con o sin guiones", () => {
    expect(isValidCuit("20123456786")).toBe(true)
    expect(isValidCuit("20-12345678-6")).toBe(true)
  })

  it("rechaza un CUIT con longitud incorrecta", () => {
    expect(isValidCuit("123")).toBe(false)
    expect(isValidCuit("")).toBe(false)
  })

  it("rechaza un CUIT con dígito verificador incorrecto", () => {
    expect(isValidCuit("20123456780")).toBe(false)
  })
})
