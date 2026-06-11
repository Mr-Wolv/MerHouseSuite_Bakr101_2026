import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext } from './ThemeContextValue'
import type { ResolvedTheme, ThemePreference } from './ThemeContextValue'

const storageKey = 'merhouse-theme-preference'

function validPreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  return validPreference(window.localStorage.getItem(storageKey))
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredPreference()))

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference)
    window.localStorage.setItem(storageKey, nextPreference)
  }, [])

  const toggleTheme = useCallback(() => {
    setPreference(resolveTheme(preference) === 'dark' ? 'light' : 'dark')
  }, [preference, setPreference])

  useEffect(() => {
    const updateResolvedTheme = () => setResolvedTheme(resolveTheme(preference))
    updateResolvedTheme()

    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    if (typeof media.addEventListener !== 'function') return undefined
    media.addEventListener('change', updateResolvedTheme)
    return () => media.removeEventListener('change', updateResolvedTheme)
  }, [preference])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference, toggleTheme }),
    [preference, resolvedTheme, setPreference, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
