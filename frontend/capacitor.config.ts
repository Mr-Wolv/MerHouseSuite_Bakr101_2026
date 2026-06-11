import type { CapacitorConfig } from '@capacitor/cli'

const deployedFrontendUrl = process.env.MERHOUSE_ANDROID_FRONTEND_URL?.trim()

const config: CapacitorConfig = {
  appId: 'com.merhouse.operations',
  appName: 'MerHouse',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    ...(deployedFrontendUrl ? { url: deployedFrontendUrl } : {}),
    androidScheme: 'http',
    cleartext: true,
  },
}

export default config
