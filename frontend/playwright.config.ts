import { defineConfig, devices } from '@playwright/test'

const usesExternalFrontendTour = Boolean(process.env.FRONTEND_TOUR_BASE_URL)
const frontendBaseUrl = process.env.FRONTEND_TOUR_BASE_URL ?? 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: frontendBaseUrl,
    trace: 'retain-on-failure',
  },
  webServer: usesExternalFrontendTour
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: frontendBaseUrl,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
