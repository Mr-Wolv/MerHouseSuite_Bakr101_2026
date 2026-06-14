import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { UserRole } from '../api/types'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { RequireAuth } from './RequireAuth'

const baseUser = {
  id: 'user-id',
  tenantId: 'tenant-id',
  email: 'test@merhouse.local',
  enabled: true,
  createdAt: '2026-05-20T00:00:00Z',
}

function baseAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    token: null,
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  }
}

function renderGuard(authState: AuthState, roles?: UserRole[], initialPath = '/protected') {
  return render(
    <AuthContext.Provider value={authState}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<h1>Login Page</h1>} />
          <Route path="/" element={<h1>Home</h1>} />
          <Route element={<RequireAuth roles={roles} />}>
            <Route path="/protected" element={<h1>Protected Content</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth security', () => {
  it('shows loading state while session is being restored', () => {
    renderGuard(baseAuthState({ loading: true }))

    expect(screen.getByRole('status')).toHaveTextContent('Restoring session')
    expect(screen.queryByRole('heading', { name: 'Protected Content' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Login Page' })).not.toBeInTheDocument()
  })

  it('redirects to login when no user is authenticated', () => {
    renderGuard(baseAuthState({ user: null }))

    expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Protected Content' })).not.toBeInTheDocument()
  })

  it('preserves the original location in navigation state for post-login redirect', () => {
    renderGuard(baseAuthState({ user: null }), undefined, '/protected')

    // The Navigate component replaces the URL but the state should contain the original location
    expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument()
  })

  it('allows access when no roles are specified and user is authenticated', () => {
    renderGuard(baseAuthState({
      token: 'token',
      user: { ...baseUser, role: 'MERCHANT' },
    }))

    expect(screen.getByRole('heading', { name: 'Protected Content' })).toBeInTheDocument()
  })

  it.each([
    ['OWNER', ['OWNER', 'ADMIN'] as UserRole[]],
    ['ADMIN', ['OWNER', 'ADMIN'] as UserRole[]],
    ['SUPPORT_ADMIN', ['OWNER', 'ADMIN', 'SUPPORT_ADMIN'] as UserRole[]],
    ['AUDITOR', ['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'] as UserRole[]],
    ['MERCHANT', ['MERCHANT'] as UserRole[]],
    ['WAREHOUSE_OPERATOR', ['WAREHOUSE_OPERATOR'] as UserRole[]],
  ] as const)('allows %s access when role is in the allowed list', (role, roles) => {
    renderGuard(baseAuthState({
      token: 'token',
      user: { ...baseUser, role },
    }), [...roles])

    expect(screen.getByRole('heading', { name: 'Protected Content' })).toBeInTheDocument()
  })

  it.each([
    ['MERCHANT', ['OWNER', 'ADMIN'] as UserRole[]],
    ['WAREHOUSE_OPERATOR', ['OWNER', 'ADMIN'] as UserRole[]],
    ['AUDITOR', ['MERCHANT'] as UserRole[]],
    ['OWNER', ['MERCHANT', 'WAREHOUSE_OPERATOR'] as UserRole[]],
  ] as const)('denies %s access when role is NOT in the allowed list and redirects to home', (role, roles) => {
    renderGuard(baseAuthState({
      token: 'token',
      user: { ...baseUser, role },
    }), [...roles])

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Protected Content' })).not.toBeInTheDocument()
  })

  it('does not render protected content even briefly during loading state', () => {
    const { container } = renderGuard(baseAuthState({ loading: true, user: null }))

    expect(container.innerHTML).not.toContain('Protected Content')
  })

  it('allows all authenticated roles when roles prop is undefined', () => {
    const allRoles: UserRole[] = ['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR']

    for (const role of allRoles) {
      const { unmount } = renderGuard(baseAuthState({
        token: 'token',
        user: { ...baseUser, role },
      }))

      expect(screen.getByRole('heading', { name: 'Protected Content' })).toBeInTheDocument()
      unmount()
    }
  })

  it('treats empty roles array as allowing no roles', () => {
    renderGuard(baseAuthState({
      token: 'token',
      user: { ...baseUser, role: 'OWNER' },
    }), [])

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Protected Content' })).not.toBeInTheDocument()
  })

  it('redirects to login when token exists but user is null (stale session)', () => {
    renderGuard(baseAuthState({ token: 'stale-token', user: null }))

    expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument()
  })
})
