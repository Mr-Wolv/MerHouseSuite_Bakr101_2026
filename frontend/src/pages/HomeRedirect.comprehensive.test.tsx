import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { UserRole } from '../api/types'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { HomeRedirect } from './HomeRedirect'

const baseAuthState = {
  token: 'token',
  loading: false,
  emailVerified: false,
  sendEmailVerification: vi.fn(),
  refreshEmailVerified: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}

function renderRedirect(role: UserRole | null) {
  const authState: AuthState = {
    ...baseAuthState,
    user: role
      ? {
          id: 'user-id',
          tenantId: 'tenant-id',
          email: `${role.toLowerCase()}@merhouse.local`,
          role,
          enabled: true,
          createdAt: new Date().toISOString(),
        }
      : null,
  }

  render(
    <AuthContext.Provider value={authState}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/admin" element={<h1>Admin Landing</h1>} />
          <Route path="/merchant" element={<h1>Merchant Landing</h1>} />
          <Route path="/warehouse" element={<h1>Warehouse Landing</h1>} />
          <Route path="/login" element={<h1>Login Page</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('HomeRedirect comprehensive role routing', () => {
  it.each([
    ['OWNER', 'Admin Landing'],
    ['ADMIN', 'Admin Landing'],
    ['SUPPORT_ADMIN', 'Admin Landing'],
    ['AUDITOR', 'Admin Landing'],
  ] as const)('routes %s to the admin console', (role, heading) => {
    renderRedirect(role)
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('routes merchants to the merchant console', () => {
    renderRedirect('MERCHANT')
    expect(screen.getByRole('heading', { name: 'Merchant Landing' })).toBeInTheDocument()
  })

  it('routes warehouse operators to the warehouse console', () => {
    renderRedirect('WAREHOUSE_OPERATOR')
    expect(screen.getByRole('heading', { name: 'Warehouse Landing' })).toBeInTheDocument()
  })

  it('redirects to login when user is null', () => {
    renderRedirect(null)
    expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument()
  })
})
