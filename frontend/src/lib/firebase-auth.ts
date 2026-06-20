/**
 * Firebase Auth helper utilities for the React frontend.
 *
 * Login and logout are handled directly by AuthContext using the Firebase SDK.
 * This module exports error-message mappings and reusable helpers for:
 * - Password reset
 * - Passwordless sign-in (magic links)
 * - Email verification
 */
import { auth } from './firebase'
import {
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendEmailVerification as firebaseSendEmailVerification,
  applyActionCode,
  checkActionCode,
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
  'auth/invalid-oob-code': 'This link is invalid or has expired.',
  'auth/expired-oob-code': 'This link has expired. Please request a new one.',
}

// ───── Local storage key for passwordless sign-in ─────

const EMAIL_FOR_SIGN_IN_KEY = 'merhouse_email_for_sign_in'

/**
 * Save the email address the user used to request a passwordless sign-in link.
 * Firebase requires this email to complete the sign-in via `signInWithEmailLink`.
 */
export function saveEmailForSignIn(email: string): void {
  try {
    localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email.trim().toLowerCase())
  } catch {
    // localStorage may be unavailable (SSR, private browsing); silently skip.
  }
}

/**
 * Retrieve the email address saved by a previous `saveEmailForSignIn` call.
 * Returns `null` when no email is stored.
 */
export function getEmailForSignIn(): string | null {
  try {
    return localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)
  } catch {
    return null
  }
}

/**
 * Clear the saved sign-in email from localStorage.
 */
export function clearEmailForSignIn(): void {
  try {
    localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY)
  } catch {
    // silently skip
  }
}

// ───── Action-code settings builder ─────

function buildActionCodeSettings(redirectPath: string, handleInApp = true) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    url: `${origin}${redirectPath}`,
    handleCodeInApp: handleInApp,
  }
}

// ───── Password Reset ─────

/**
 * Send a Firebase password-reset email. Firebase generates the out-of-band
 * (oob) code and emails a link that lands on `/reset-password?oobCode=...`.
 *
 * Throws when the SDK returns an error (e.g. `auth/user-not-found`,
 * `auth/invalid-email`).
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email, buildActionCodeSettings('/reset-password'))
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

// ───── Passwordless Sign-In (Magic Links) ─────

/**
 * Send a Firebase passwordless sign-in link (magic link / OTP login link)
 * to the given email address. The link lands on `/sign-in/complete?…`.
 *
 * Call {@link saveEmailForSignIn} before this so the email is available
 * when the user returns via the link.
 *
 * Throws when the SDK returns an error (e.g. `auth/invalid-email`,
 * `auth/too-many-requests`).
 */
export async function sendSignInLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email.trim().toLowerCase(), buildActionCodeSettings('/sign-in/complete'))
}

/**
 * Check whether the current page URL contains a Firebase passwordless
 * sign-in link (magic link). Call this on routes that handle sign-in
 * completion.
 */
export function isMagicSignInLink(): boolean {
  if (typeof window === 'undefined') return false
  return isSignInWithEmailLink(auth, window.location.href)
}

/**
 * Complete a passwordless sign-in for the given email. The current page URL
 * must contain a valid Firebase sign-in link (check with {@link isMagicSignInLink}
 * first). Clears the saved email on success.
 *
 * Throws when the link is invalid, expired, or already used.
 */
export async function completeSignInWithLink(email: string): Promise<void> {
  await signInWithEmailLink(auth, email.trim().toLowerCase(), window.location.href)
  clearEmailForSignIn()
}

// ───── Email Verification ─────

/**
 * Send a Firebase email-verification link to the currently signed-in user.
 * The link lands on `/verify-email?oobCode=…&mode=verifyEmail&…`.
 *
 * Throws when the user is not signed in or the SDK returns an error.
 */
export async function sendEmailVerificationLink(): Promise<void> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('auth/requires-recent-login')
  }
  await firebaseSendEmailVerification(user, buildActionCodeSettings('/verify-email'))
}

/**
 * Check whether the current page URL contains a Firebase email-verification
 * link (mode=verifyEmail).
 */
export function isEmailVerificationLink(): boolean {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  return url.searchParams.get('mode') === 'verifyEmail' && Boolean(url.searchParams.get('oobCode'))
}

/**
 * Apply a Firebase out-of-band code to confirm email verification.
 * This is called when the user lands from an email-verification link.
 *
 * Throws when the code is invalid, expired, or already used.
 */
export async function applyEmailVerificationCode(oobCode: string): Promise<void> {
  await checkActionCode(auth, oobCode)
  await applyActionCode(auth, oobCode)
}

/**
 * Refresh the currently signed-in Firebase user and return the updated
 * `emailVerified` value. Useful after the user clicks a verification link.
 */
export async function refreshEmailVerified(): Promise<boolean> {
  const user = auth.currentUser
  if (!user) return false
  await user.reload()
  return auth.currentUser?.emailVerified ?? false
}

// ───── Error Handling ─────

/** Translate a Firebase error code into a user-friendly message. */
export function friendlyAuthError(caught: unknown): string {
  const code = (caught as { code?: string })?.code
  if (code && code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[code]
  }
  const message = (caught as { message?: string })?.message
  return message ?? 'An unexpected error occurred.'
}
