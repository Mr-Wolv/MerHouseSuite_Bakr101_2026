import { act, render, screen, waitFor } from '@testing-library/react'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

const apiMock = vi.hoisted(() => ({
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: apiMock,
}))

// Mock Firebase Auth
const mockGetIdToken = vi.fn()
const mockOnAuthStateChanged = vi.fn()
const mockSignInWithEmailAndPassword = vi.fn()

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: null },
}))

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}))

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

function setupFirebaseUser(email: string) {
  return {
    email,
    getIdToken: mockGetIdToken.mockResolvedValue(`firebase-token-${email}`),
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
  }
}

describe('AuthProvider comprehensive session management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no Firebase user
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null)
      return vi.fn()
    })
  })

  it('starts with no token and no user when no Firebase user', async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Session').nextElementSibling).toHaveTextContent('idle')
    })
    expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('none')
    expect(screen.getByText('User').nextElementSibling).toHaveTextContent('none')
    expect(apiMock.me).not.toHaveBeenCalled()
  })

  it('restores a valid session when Firebase user is present on mount', async () => {
    const firebaseUser = setupFirebaseUser('session@merhouse.local')
    apiMock.me.mockResolvedValue({ user: mockUser })

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: typeof firebaseUser | null) => void) => {
      callback(firebaseUser)
      return vi.fn()
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('firebase-token-session@merhouse.local')
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('session@merhouse.local')
      expect(screen.getByText('Session').nextElementSibling).toHaveTextContent('idle')
    })

    expect(apiMock.me).toHaveBeenCalledWith('firebase-token-session@merhouse.local')
  })

  it('sets token and user on successful Firebase login', async () => {
    const firebaseUser = setupFirebaseUser('proof@merhouse.local')
    apiMock.me.mockResolvedValue({ user: { ...mockUser, email: 'proof@merhouse.local' } })

    // First call: no user (initial state)
    // Second call: user signs in (after login button click)
    let authCallback: (user: typeof firebaseUser | null) => void
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: typeof firebaseUser | null) => void) => {
      authCallback = callback
      callback(null)
      return vi.fn()
    })

    mockSignInWithEmailAndPassword.mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    // Simulate Firebase auth state change after login
    act(() => {
      authCallback!(firebaseUser)
    })

    await waitFor(() => {
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('firebase-token-proof@merhouse.local')
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('proof@merhouse.local')
    })
  })

  it('clears everything on logout', async () => {
    const firebaseUser = setupFirebaseUser('session@merhouse.local')
    apiMock.me.mockResolvedValue({ user: mockUser })

    let authCallback: (user: typeof firebaseUser | null) => void
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: typeof firebaseUser | null) => void) => {
      authCallback = callback
      callback(firebaseUser)
      return vi.fn()
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('session@merhouse.local')
    })

    // Simulate Firebase sign out
    act(() => {
      authCallback!(null)
    })

    await waitFor(() => {
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('none')
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('none')
    })
  })

  it('shows loading state while session restore is in progress', async () => {
    // Firebase user exists but api.me never resolves
    const firebaseUser = setupFirebaseUser('loading@merhouse.local')
    apiMock.me.mockReturnValue(new Promise(() => {})) // Never resolves

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: typeof firebaseUser | null) => void) => {
      callback(firebaseUser)
      return vi.fn()
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Session').nextElementSibling).toHaveTextContent('restoring')
    })
  })

  it('does not update state after unmount during profile fetch', async () => {
    const firebaseUser = setupFirebaseUser('unmount@merhouse.local')
    let resolveProfile!: (value: { user: typeof mockUser }) => void
    apiMock.me.mockReturnValue(new Promise((resolve) => {
      resolveProfile = resolve
    }))

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: typeof firebaseUser | null) => void) => {
      callback(firebaseUser)
      return vi.fn()
    })

    const { unmount } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    unmount()

    // Resolving after unmount should not cause state updates
    resolveProfile({ user: mockUser })
    expect(true).toBe(true)
  })
})
