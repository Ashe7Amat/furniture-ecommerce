/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
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
      thresholds: { lines: 64, statements: 64, functions: 80, branches: 91 },
    },
  },
})
