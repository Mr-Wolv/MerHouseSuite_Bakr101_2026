/**
 * Firebase Auth helper utilities for the React frontend.
 *
 * Login and logout are handled directly by AuthContext using the Firebase SDK.
 * This module exports error-message mappings and reusable helpers.
 */
import { auth } from './firebase'
import {
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
} from 'firebase/auth'

/** Firebase Auth error codes we care about, mapped to user-friendly messages. */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/invalid-oob-code': 'This reset link is invalid or has expired.',
  'auth/expired-oob-code': 'This reset link has expired. Please request a new one.',
}

/**
 * Build action-code settings so the Firebase reset email links back to the
 * app's `/reset-password` page rather than the default Firebase-hosted page.
 */
function buildActionCodeSettings() {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    url: `${origin}/reset-password`,
    handleCodeInApp: false,
  }
}

/**
 * Send a Firebase password-reset email. Firebase generates the out-of-band
 * (oob) code and emails a link that lands on `/reset-password?oobCode=...`.
 *
 * Throws when the SDK returns an error (e.g. `auth/user-not-found`,
 * `auth/invalid-email`).
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email, buildActionCodeSettings())
}

/**
 * Verify a Firebase out-of-band code and return the email address it was
 * issued for. Throws `auth/invalid-oob-code` when the code is expired,
 * already used, or malformed.
 */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode)
}

/**
 * Confirm a Firebase password reset using a verified out-of-band code and
 * the user's new password.
 */
export async function confirmFirebasePasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await firebaseConfirmPasswordReset(auth, oobCode, newPassword)
}

/** Translate a Firebase error code into a user-friendly message. */
export function friendlyAuthError(caught: unknown): string {
  const code = (caught as { code?: string })?.code
  if (code && code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[code]
  }
  const message = (caught as { message?: string })?.message
  return message ?? 'An unexpected error occurred.'
}
