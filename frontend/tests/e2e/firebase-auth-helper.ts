/**
 * Shared Firebase Auth helper for Playwright e2e tests.
 *
 * Uses the Firebase Auth REST API (emulator or production) to sign in and
 * return an ID token for use as the Bearer token in backend API calls.
 */
import type { APIRequestContext } from '@playwright/test'

export const FIREBASE_EMULATOR = (process.env.E2E_FIREBASE_EMULATOR ?? 'http://127.0.0.1:9099').replace(/\/+$/, '')
export const FIREBASE_API_KEY = process.env.E2E_FIREBASE_API_KEY ?? 'emulator-api-key'

/**
 * Authenticate via Firebase Auth REST API and return an ID token
 * suitable for use as `Authorization: Bearer <token>` in backend API calls.
 */
export async function firebaseLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(
    `${FIREBASE_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    { data: { email, password, returnSecureToken: true } },
  )
  const body = await response.json() as { idToken?: string; error?: { message: string } }
  if (!body.idToken) {
    throw new Error(`Firebase login failed for ${email}: ${response.status()} ${body.error?.message ?? JSON.stringify(body)}`)
  }
  return body.idToken
}

/**
 * Create a user in the Firebase Auth emulator so Firebase password reset works.
 * Accepts both 200 (created) and 400 (already exists) — idempotent.
 */
export async function createFirebaseUser(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(
    `${FIREBASE_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    { data: { email, password, returnSecureToken: true } },
  )
  if (!response.ok()) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
    if (body.error?.message !== 'EMAIL_EXISTS') {
      throw new Error(`Firebase user creation failed for ${email}: ${response.status()} ${JSON.stringify(body)}`)
    }
  }
}

/**
 * Update a Firebase Auth user's password by signing in with the old password
 * to get an ID token, then calling the accounts:update endpoint.
 */
export async function updateFirebasePassword(request: APIRequestContext, email: string, oldPassword: string, newPassword: string) {
  const signIn = await request.post(
    `${FIREBASE_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    { data: { email, password: oldPassword, returnSecureToken: true } },
  )
  if (!signIn.ok()) {
    throw new Error(`Firebase sign-in failed for ${email} during password update: ${signIn.status()}`)
  }
  const body = await signIn.json() as { idToken: string }
  const idToken = body.idToken

  const update = await request.post(
    `${FIREBASE_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
    { data: { idToken, password: newPassword, returnSecureToken: true } },
  )
  if (!update.ok()) {
    throw new Error(`Firebase password update failed for ${email}: ${update.status()}`)
  }
}
