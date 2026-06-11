import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

const apiMock = vi.hoisted(() => ({
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: apiMock,
}))

const tokenKey = 'warehouse-console-token'

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

describe('AuthProvider session restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('clears a stale stored token when session restore fails', async () => {
    localStorage.setItem(tokenKey, 'stale-token')
    apiMock.me.mockRejectedValue(new Error('Unauthorized'))

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(localStorage.getItem(tokenKey)).toBeNull()
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('none')
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('none')
      expect(screen.getByText('Session').nextElementSibling).toHaveTextContent('idle')
    })

    expect(apiMock.me).toHaveBeenCalledWith('stale-token')
  })

  it('keeps a fresh login when an older session restore fails later', async () => {
    localStorage.setItem(tokenKey, 'stale-token')
    let rejectRestore!: (error: Error) => void
    apiMock.me.mockReturnValue(new Promise((_, reject) => {
      rejectRestore = reject
    }))
    apiMock.login.mockResolvedValue({
      accessToken: 'fresh-token',
      user: {
        id: 'proof-user',
        tenantId: 'proof-tenant',
        email: 'proof@merhouse.local',
        role: 'OWNER',
        enabled: true,
        createdAt: '2026-06-11T00:00:00Z',
      },
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(localStorage.getItem(tokenKey)).toBe('fresh-token')
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('fresh-token')
    })

    rejectRestore(new Error('Unauthorized'))

    await waitFor(() => {
      expect(localStorage.getItem(tokenKey)).toBe('fresh-token')
      expect(screen.getByText('Token').nextElementSibling).toHaveTextContent('fresh-token')
      expect(screen.getByText('User').nextElementSibling).toHaveTextContent('proof@merhouse.local')
    })
  })
})
