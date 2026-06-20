import { createContext } from 'react'
import type { User } from '../api/types'

export type AuthState = {
  token: string | null
  user: User | null
  loading: boolean
  emailVerified: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  sendEmailVerification: () => Promise<void>
  refreshEmailVerified: () => Promise<boolean>
}

export const AuthContext = createContext<AuthState | null>(null)
