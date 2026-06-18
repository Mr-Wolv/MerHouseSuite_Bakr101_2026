import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api/client'
import type { User } from '../api/types'
import { AuthContext } from './AuthContextValue'
import { auth } from '../lib/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth'

const LEGACY_TOKEN_KEY = 'warehouse-console-token'

/**
 * During the Firebase migration period we support two auth paths:
 *
 * 1. **Firebase Auth** — When Firebase is configured, `onAuthStateChanged`
 *    fires when a user signs in via `signInWithEmailAndPassword`. We fetch
 *    a Firebase ID token and call `api.me()` to get the backend user profile.
 *
 * 2. **Legacy localStorage** — E2E tests and existing sessions inject a
 *    custom JWT into `localStorage` under `warehouse-console-token`. When
 *    no Firebase user is present (or Firebase is not configured) we fall
 *    back to this token and call `api.me()` to restore the session.
 *
 * Once Firebase Auth is fully activated in production the legacy fallback
 * can be removed.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)


  const logout = useCallback(async () => {
    try { localStorage.removeItem(LEGACY_TOKEN_KEY) } catch { /* noop */ }
    if (auth) {
      await signOut(auth)
      // onAuthStateChanged will fire with null and clear state.
    } else {
      setToken(null)
      setUser(null)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (cancelled) return

        if (!firebaseUser) {
          // --- Legacy localStorage fallback ---
          try {
            const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
            if (legacyToken) {
              setToken(legacyToken)
              const response = await api.me(legacyToken)
              if (!cancelled) {
                setUser(response.user)
                setLoading(false)
              }
              return
            }
          } catch {
            try { localStorage.removeItem(LEGACY_TOKEN_KEY) } catch { /* noop */ }
          }

          if (!cancelled) {
            setToken(null)
            setUser(null)
            setLoading(false)
          }
          return
        }

        // --- Firebase Auth path ---
        try {
          const idToken = await firebaseUser.getIdToken()
          if (cancelled) return
          setToken(idToken)
          const response = await api.me(idToken)
          if (!cancelled) {
            setUser(response.user)
          }
        } catch {
          if (!cancelled) {
            setToken(null)
            setUser(null)
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })
      return () => { cancelled = true; unsubscribe() }
    }

    // --- No Firebase configured: legacy localStorage only ---
    void (async () => {
      try {
        const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
        if (legacyToken) {
          const response = await api.me(legacyToken)
          if (!cancelled) {
            setToken(legacyToken)
            setUser(response.user)
            setLoading(false)
          }
          return
        }
      } catch {
        try { localStorage.removeItem(LEGACY_TOKEN_KEY) } catch { /* noop */ }
      }

      if (!cancelled) {
        setToken(null)
        setUser(null)
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (auth) {
      // Firebase Auth path — signInWithEmailAndPassword triggers
      // onAuthStateChanged which handles token storage and profile fetch.
      await signInWithEmailAndPassword(auth, email, password)
      return
    }

    // Legacy API login — used when Firebase is not configured (e.g. CI,
    // Docker without Firebase, or pre-Firebase-prod migration).
    const response = await api.login(email, password)
    const accessToken = response.accessToken
    try {
      localStorage.setItem(LEGACY_TOKEN_KEY, accessToken)
      setToken(accessToken)
      const meResponse = await api.me(accessToken)
      setUser(meResponse.user)
    } catch {
      try { localStorage.removeItem(LEGACY_TOKEN_KEY) } catch { /* noop */ }
      setToken(null)
      setUser(null)
      throw new Error('Unable to load user profile after login.')
    } finally {
      setLoading(false)
    }
  }, [])

  const value = useMemo(
    () => ({ token, user, loading, login, logout }),
    [loading, login, logout, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
