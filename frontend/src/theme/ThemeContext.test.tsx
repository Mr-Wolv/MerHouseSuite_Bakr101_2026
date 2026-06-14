import { act, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from './ThemeContext'
import { useTheme } from './useTheme'

const STORAGE_KEY = 'merhouse-theme-preference'

function ThemeProbe() {
  const { preference, resolvedTheme, setPreference, toggleTheme } = useTheme()

  return (
    <>
      <dl>
        <dt>Preference</dt>
        <dd>{preference}</dd>
        <dt>Resolved</dt>
        <dd>{resolvedTheme}</dd>
      </dl>
      <button type="button" onClick={() => setPreference('light')}>Set Light</button>
      <button type="button" onClick={() => setPreference('dark')}>Set Dark</button>
      <button type="button" onClick={() => setPreference('system')}>Set System</button>
      <button type="button" onClick={toggleTheme}>Toggle</button>
    </>
  )
}

describe('ThemeProvider comprehensive', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('defaults to system preference when localStorage is empty', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByText('Preference').nextElementSibling).toHaveTextContent('system')
    // System resolves to light when prefers-color-scheme is not dark
    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('light')
  })

  it('reads stored light preference from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'light')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByText('Preference').nextElementSibling).toHaveTextContent('light')
    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('light')
  })

  it('reads stored dark preference from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByText('Preference').nextElementSibling).toHaveTextContent('dark')
    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('dark')
  })

  it('falls back to system for invalid stored values', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-theme')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByText('Preference').nextElementSibling).toHaveTextContent('system')
  })

  it('persists preference changes to localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set Dark' }))

    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    expect(screen.getByText('Preference').nextElementSibling).toHaveTextContent('dark')
    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('dark')
  })

  it('updates document data-theme attribute on theme change', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set Dark' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('toggles between light and dark', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    // System resolves to light, toggle should go to dark
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }))

    expect(screen.getByText('Preference').nextElementSibling).toHaveTextContent('dark')
    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('dark')

    // Toggle again should go to light
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }))

    expect(screen.getByText('Preference').nextElementSibling).toHaveTextContent('light')
    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('light')
  })

  it('resolves system preference to dark when OS prefers dark', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByText('Preference').nextElementSibling).toHaveTextContent('system')
    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('dark')
  })

  it('responds to OS theme change events when preference is system', () => {
    let mediaChangeHandler: (() => void) | null = null
    let currentMatches = false
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        get matches() { return currentMatches },
        media: query,
        onchange: null,
        addEventListener: vi.fn().mockImplementation((_event: string, handler: () => void) => {
          mediaChangeHandler = () => {
            currentMatches = true
            handler()
          }
        }),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('light')

    // Simulate OS switching to dark mode
    act(() => {
      mediaChangeHandler?.()
    })

    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('dark')
  })

  it('does not respond to OS theme changes when preference is explicit', () => {
    let mediaChangeHandler: (() => void) | null = null
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn().mockImplementation((_event: string, handler: () => void) => {
          mediaChangeHandler = handler
        }),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    // Set explicit light preference
    fireEvent.click(screen.getByRole('button', { name: 'Set Light' }))
    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('light')

    // OS changes should not affect explicit preference
    act(() => {
      mediaChangeHandler?.()
    })

    expect(screen.getByText('Resolved').nextElementSibling).toHaveTextContent('light')
  })
})
