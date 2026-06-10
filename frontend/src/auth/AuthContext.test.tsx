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

const tokenKey = 'warehouse-console-token'

function AuthProbe() {
  const { token, user, loading } = useAuth()

  return (
    <dl>
      <dt>Token</dt>
      <dd>{token ?? 'none'}</dd>
      <dt>User</dt>
      <dd>{user?.email ?? 'none'}</dd>
      <dt>Session</dt>
      <dd>{loading ? 'restoring' : 'idle'}</dd>
    </dl>
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
})
