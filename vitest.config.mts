import path from "node:path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

/**
 * Setup mínimo de tests para el módulo de billing — no existía ningún
 * runner de tests en el proyecto. Se eligió `vitest` + `@testing-library/react`
 * porque no requieren configuración de Babel/Jest adicional sobre un
 * proyecto Next.js con Turbopack, y porque es el mismo runner que ya usa
 * `gesty-backend`. Alcance deliberadamente acotado al módulo de billing;
 * no se tocó nada de Next.js ni del build de producción.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
})
