import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api/client'
import type { User } from '../api/types'
import { AuthContext } from './AuthContextValue'
import { auth } from '../lib/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification as firebaseSendEmailVerification,
  type User as FirebaseUser,
} from 'firebase/auth'

/**
 * The only authentication path is Firebase Auth. `onAuthStateChanged` fires
 * when a user signs in via `signInWithEmailAndPassword`. We fetch a Firebase
 * ID token and call `api.me()` to get the backend user profile.
 *
 * `emailVerified` is tracked from the Firebase user object so the Account
 * page and other components can show email verification status.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailVerified, setEmailVerified] = useState(false)

  const logout = useCallback(async () => {
    await signOut(auth)
    // onAuthStateChanged will fire with null and clear state.
  }, [])

  const sendEmailVerification = useCallback(async () => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('No authenticated user.')
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    await firebaseSendEmailVerification(currentUser, {
      url: `${origin}/verify-email`,
      handleCodeInApp: true,
    })
  }, [])

  const refreshEmailVerified = useCallback(async (): Promise<boolean> => {
    const currentUser = auth.currentUser
    if (!currentUser) return false
    await currentUser.reload()
    const verified = auth.currentUser?.emailVerified ?? false
    setEmailVerified(verified)
    return verified
  }, [])

  useEffect(() => {
    let cancelled = false

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (cancelled) return

      if (!firebaseUser) {
        if (!cancelled) {
          setToken(null)
          setUser(null)
          setEmailVerified(false)
          setLoading(false)
        }
        return
      }

      try {
        const idToken = await firebaseUser.getIdToken()
        if (cancelled) return
        setToken(idToken)
        setEmailVerified(firebaseUser.emailVerified)
        const response = await api.me(idToken)
        if (!cancelled) {
          setUser(response.user)
        }
      } catch {
        if (!cancelled) {
          setToken(null)
          setUser(null)
          setEmailVerified(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => { cancelled = true; unsubscribe() }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Firebase Auth path — signInWithEmailAndPassword triggers
    // onAuthStateChanged which handles token storage and profile fetch.
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const value = useMemo(
    () => ({ token, user, loading, emailVerified, login, logout, sendEmailVerification, refreshEmailVerified }),
    [emailVerified, loading, login, logout, refreshEmailVerified, sendEmailVerification, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
