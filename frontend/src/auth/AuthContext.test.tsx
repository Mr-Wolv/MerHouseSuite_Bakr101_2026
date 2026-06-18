import { render, screen, waitFor } from '@testing-library/react'
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

function AuthProbe() {
  const { login, token, user, loading } = useAuth()

  return (
    <>
      <button type="button" onClick={() => void login('proof@merhouse.local', 'proof-password')}>
        Login
      </button>
      <dl>
        <dt>Token</dt>
        <dd>{token ?? 'none'}</dd>
        <dt>User</dt>
        <dd>{user?.email ?? 'none'}</dd>
        <dt>Session</dt>
        <dd>{loading ? 'restoring' : 'idle'}</dd>
      </dl>
    </>
  )
}

function setupAuthStateUser(email: string, getIdTokenResult: Record<string, unknown> = {}) {
  return {
    email,
    getIdToken: mockGetIdToken.mockResolvedValue(`firebase-token-${email}`),
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: getIdTokenResult }),
  }
}

describe('AuthProvider session restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: onAuthStateChanged fires with null (no user)
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null)
      return vi.fn()
    })
  })

  it('shows loading then idle when no Firebase user', async () => {
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

  it('fetches backend user profile when Firebase user signs in', async () => {
    const firebaseUser = setupAuthStateUser('proof@merhouse.local')
    apiMock.me.mockResolvedValue({
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'proof@merhouse.local',
        role: 'OWNER',
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    })

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
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('proof@merhouse.local')
    })
    expect(apiMock.me).toHaveBeenCalledWith('firebase-token-proof@merhouse.local')
    expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('firebase-token-proof@merhouse.local')
  })

  it('clears state when backend profile fetch fails', async () => {
    const firebaseUser = setupAuthStateUser('unknown@merhouse.local')
    apiMock.me.mockRejectedValue(new Error('Unauthorized'))

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
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('none')
    })
    expect(screen.getByText('User').nextElementSibling).toHaveTextContent('none')
  })
})
