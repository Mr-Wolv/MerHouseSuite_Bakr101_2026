import { createContext } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export type ThemeState = {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  toggleTheme: () => void
}

const fallbackTheme: ThemeState = {
  preference: 'system',
  resolvedTheme: 'light',
  setPreference: () => {},
  toggleTheme: () => {},
}

export const ThemeContext = createContext<ThemeState>(fallbackTheme)
