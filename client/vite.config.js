/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { BRAND } from './src/theme/brand.config.js'

// index.html lleva marcadores %BRAND_...% en vez del nombre y la web de la marca: se rellenan aquí con
// src/theme/brand.config.js, en `vite` y en `vite build`. Un marcador sin valor rompe el build, para
// que no llegue nunca a la web un título con "%BRAND_NOMBRE%".
// El color de la barra del navegador en el móvil es el primario del modo claro de tokens.css.
const colorPrimario = () => {
  const tokens = readFileSync(new URL('./src/theme/tokens.css', import.meta.url), 'utf8')
  const claro = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('}', tokens.indexOf(':root {')))
  const color = claro.match(/--color-primary:\s*(#[0-9a-fA-F]{3,8});/)
  if (!color) throw new Error('tokens.css: no encuentro --color-primary en :root')
  return color[1]
}
const MARCADORES_MARCA = {
  BRAND_NOMBRE: BRAND.nombre,
  BRAND_DESCRIPCION: BRAND.descripcion,
  BRAND_WEB: BRAND.web,
  BRAND_COLOR_TEMA: colorPrimario(),
}
const marcaEnIndexHtml = () => ({
  name: 'marca-en-index-html',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) =>
      html.replace(/%(BRAND_[A-Z_]+)%/g, (marcador, nombre) => {
        if (!(nombre in MARCADORES_MARCA)) throw new Error(`index.html: marcador sin valor ${marcador}`)
        return MARCADORES_MARCA[nombre]
      }),
  },
})

export default defineConfig({
  plugins: [react(), marcaEnIndexHtml()],
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 30000,
    setupFiles: './src/setupTests.js',
    // e2e/ son los tests de Playwright (npm run test:e2e), no de Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Cobertura (tarea 7): solo con `npm run test:coverage`. Cuenta el código de src/, sin los tests
    // ni sus ayudas. Si una cifra baja de su umbral, el comando falla, y el CI con él.
    // Los umbrales solo suben: tras cada tanda de tests se ponen en lo medido menos medio punto (margen
    // para las pequeñas diferencias entre versiones de Node: el CI usa la 22), y no se bajan nunca.
    // Historial en la tarea 7 de docs/mejoras-tecnicas.md.
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/setupTests.js', 'src/pages/adminTestUtils.jsx'],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 97, statements: 97, functions: 92, branches: 95 },
    },
  },
})
