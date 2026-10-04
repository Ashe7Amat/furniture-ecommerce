// Tests E2E con Playwright (ver docs/testing-e2e.md). Arranca la web con Vite y la recorre en
// Chromium. La API no se arranca: cada test la simula interceptando las peticiones del navegador
// (e2e/apiSimulada.js), así que no hace falta servidor, base de datos ni conexión.
import { defineConfig, devices } from '@playwright/test';

const PUERTO = 5173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // La API "de verdad" a la que apuntaría la web; los tests interceptan todo lo que va ahí.
    env: { VITE_API_URL: 'http://localhost:5000/api', VITE_GOOGLE_CLIENT_ID: '' }
  }
});
