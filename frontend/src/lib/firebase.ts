/**
 * Firebase client SDK initialization.
 *
 * Firebase Auth is always initialized. In local development the Firebase Auth
 * emulator is used (port 9099). In production the real Firebase project is
 * targeted via environment variables.
 *
 * App Check (reCAPTCHA Enterprise) and Firebase Cloud Messaging (FCM) are
 * conditionally initialized when the required configuration is available.
 * Both services are included in the Spark (free) plan.
 *
 * The caller must ensure that VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID
 * are set (via .env, Docker args, or CI secrets). If they are missing, Firebase
 * initialization will throw at import time — this is intentional: Firebase Auth
 * is the only authentication path.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

// Avoid double-initializing in HMR / React.StrictMode
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!
const authInstance: Auth = getAuth(app)

// Connect to the Firebase Auth emulator when VITE_FIREBASE_EMULATOR_HOST is
// set. In local Docker dev this points at http://127.0.0.1:9099 (the host-
// mapped port).  When unset (production) the real Firebase backend is used.
//
// The emulator serves the Identity Toolkit API under the
// /www.googleapis.com/ prefix. The SDK constructs URLs like
// {host}/identitytoolkit/v3/relyingparty/verifyPassword, so we append
// /www.googleapis.com to the host to match the expected route.
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST
if (emulatorHost) {
  const normalizedHost = emulatorHost.replace(/\/$/, '')
  connectAuthEmulator(authInstance, `${normalizedHost}/www.googleapis.com`, { disableWarnings: true })
}

// ───── App Check (reCAPTCHA Enterprise) ─────
//
// App Check protects backend endpoints from unauthorized access. It is
// initialized only when VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is set.
//
// To enable:
//   1. Create a reCAPTCHA Enterprise site key in Google Cloud Console
//   2. Enable the reCAPTCHA Enterprise API for the Firebase project
//   3. Set VITE_RECAPTCHA_ENTERPRISE_SITE_KEY in the frontend env
//
// The backend validates this token via the FirebaseAppCheckFilter.

let appCheckInstance: ReturnType<typeof import('firebase/app-check')['initializeAppCheck']> | null = null

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
if (recaptchaSiteKey) {
  // Dynamic import to avoid pulling in the app-check SDK when not configured
  import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
    if (!appCheckInstance) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      })
    }
  }).catch((err) => {
    // If app-check is unavailable in the SDK, silently skip
    console.debug('App Check initialization skipped:', err instanceof Error ? err.message : err)
  })
}

/**
 * Get the current App Check token for attaching to API requests.
 * Returns null when App Check is not configured.
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheckInstance) return null
  try {
    const { getToken } = await import('firebase/app-check')
    const tokenResult = await getToken(appCheckInstance, false)
    return tokenResult.token
  } catch {
    return null
  }
}

export { app }
/** Firebase Auth instance. */
export const auth = authInstance
