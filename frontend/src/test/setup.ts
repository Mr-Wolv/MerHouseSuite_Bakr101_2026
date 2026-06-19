import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

/**
 * Mock Firebase Auth modules so tests never attempt real Firebase
 * initialization. In CI no VITE_FIREBASE_* env vars are set, which would
 * cause Firebase's initializeApp to throw auth/invalid-api-key.
 *
 * The mocks return inert stubs that let AuthContext and other Firebase-
 * dependent modules construct themselves without a real backend or API key.
 */
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn(() => []),
}))

const mockAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithEmailAndPassword: vi.fn(() => Promise.reject(new Error('mock'))),
  signOut: vi.fn(() => Promise.resolve()),
  updateCurrentUser: vi.fn(),
  useDeviceLanguage: vi.fn(),
}

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => mockAuth),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithEmailAndPassword: vi.fn(() => Promise.reject(new Error('mock'))),
  signOut: vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  verifyPasswordResetCode: vi.fn(() => Promise.resolve('test@example.com')),
  confirmPasswordReset: vi.fn(() => Promise.resolve()),
}))
