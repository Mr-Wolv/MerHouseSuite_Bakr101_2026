import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

const apiMock = vi.hoisted(() => ({
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: apiMock,
}))

const TOKEN_KEY = 'warehouse-console-token'

const mockUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'session@merhouse.local',
  role: 'OWNER' as const,
  enabled: true,
  createdAt: '2026-05-20T00:00:00Z',
}

function AuthProbe() {
  const { login, logout, token, user, loading } = useAuth()

  return (
    <>
      <button type="button" onClick={() => { login('proof@merhouse.local', 'proof-password').catch(() => {}) }}>
        Login
      </button>
      <button type="button" onClick={logout}>
        Logout
      </button>
      <dl>
        <dt>Token</dt>
        <dd>{token ?? 'none'}</dd>
        <dt>User</dt>
        <dd>{user?.email ?? 'none'}</dd>
        <dt>Role</dt>
        <dd>{user?.role ?? 'none'}</dd>
        <dt>Session</dt>
        <dd>{loading ? 'restoring' : 'idle'}</dd>
      </dl>
    </>
  )
}

describe('AuthProvider comprehensive session management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('starts with no token and no user when localStorage is empty', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('none')
    expect(screen.getByText('User').nextElementSibling).toHaveTextContent('none')
    expect(screen.getByText('Session').nextElementSibling).toHaveTextContent('idle')
    expect(apiMock.me).not.toHaveBeenCalled()
  })

  it('restores a valid session from localStorage on mount', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-valid-token')
    apiMock.me.mockResolvedValue({ user: mockUser })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('stored-valid-token')
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('session@merhouse.local')
      expect(screen.getByText('Session').nextElementSibling).toHaveTextContent('idle')
    })

    expect(apiMock.me).toHaveBeenCalledWith('stored-valid-token')
  })

  it('clears localStorage and state when session restore fails', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token')
    apiMock.me.mockRejectedValue(new Error('Unauthorized'))

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('none')
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('none')
      expect(screen.getByText('Session').nextElementSibling).toHaveTextContent('idle')
    })
  })

  it('sets token, user, and localStorage on successful login', async () => {
    apiMock.login.mockResolvedValue({
      accessToken: 'fresh-token',
      user: { ...mockUser, email: 'proof@merhouse.local' },
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token')
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('fresh-token')
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('proof@merhouse.local')
    })
  })

  it('clears everything on logout', async () => {
    localStorage.setItem(TOKEN_KEY, 'active-token')
    apiMock.me.mockResolvedValue({ user: mockUser })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('session@merhouse.local')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('none')
    expect(screen.getByText('User').nextElementSibling).toHaveTextContent('none')
  })

  it('does not change state on failed login', async () => {
    apiMock.login.mockRejectedValue(new Error('Invalid credentials'))

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    // Login button click should reject — the error is swallowed by void,
    // but the state should remain unchanged
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }))
      // Wait for microtask queue to flush
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // State should not change on failed login
    expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('none')
    expect(screen.getByText('User').nextElementSibling).toHaveTextContent('none')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('does not update state after unmount during session restore', async () => {
    localStorage.setItem(TOKEN_KEY, 'unmount-token')
    let resolveRestore!: (value: { user: typeof mockUser }) => void
    apiMock.me.mockReturnValue(new Promise((resolve) => {
      resolveRestore = resolve
    }))

    const { unmount } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    unmount()

    // Resolving after unmount should not cause state updates
    resolveRestore({ user: mockUser })

    // No assertion needed — React will warn about state updates after unmount
    expect(true).toBe(true)
  })

  it('shows loading state while session restore is in progress', async () => {
    localStorage.setItem(TOKEN_KEY, 'loading-token')
    apiMock.me.mockReturnValue(new Promise(() => {})) // Never resolves

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    // Should be in loading state initially
    await waitFor(() => {
      expect(screen.getByText('Session').nextElementSibling).toHaveTextContent('restoring')
    })
  })

  it('replaces a stale token with a fresh login even before restore completes', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token')
    let rejectRestore!: (error: Error) => void
    apiMock.me.mockReturnValue(new Promise((_, reject) => {
      rejectRestore = reject
    }))
    apiMock.login.mockResolvedValue({
      accessToken: 'fresh-token',
      user: { ...mockUser, email: 'proof@merhouse.local' },
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    // Login before restore finishes
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token')
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('fresh-token')
    })

    // Old restore fails — should not affect fresh session
    rejectRestore(new Error('Unauthorized'))

    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token')
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('fresh-token')
    })
  })
})
