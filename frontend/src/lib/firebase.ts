/**
 * Firebase client SDK initialization.
 *
 * In local development the Firebase Auth emulator is used (port 9099).
 * In production the real Firebase project is targeted via environment variables.
 *
 * When no Firebase config is available (e.g. Docker builds without env vars),
 * Firebase is not initialized and `auth` is exported as `null`. Components
 * that depend on Firebase Auth must check for null before using it.
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

const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: FirebaseApp | null = null
let authInstance: Auth | null = null

if (hasConfig) {
  // Avoid double-initializing in HMR / React.StrictMode
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!
  authInstance = getAuth(app)

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
}

export { app }
/** Firebase Auth instance, or `null` when Firebase is not configured. */
export const auth = authInstance
