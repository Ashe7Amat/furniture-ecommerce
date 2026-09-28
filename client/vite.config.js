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
    // ni sus ayudas. Si una cifra baja de su umbral, el comando falla, y el CI con él. El 28 sep:
    // líneas 57,9%, ramas 89,3% y funciones 72,1% (ver la tarea 7 en docs/mejoras-tecnicas.md).
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/setupTests.js', 'src/pages/adminTestUtils.jsx'],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 50, statements: 50, functions: 60, branches: 60 },
    },
  },
})
