import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { UserRole } from '../api/types'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { HomeRedirect } from './HomeRedirect'

const baseAuthState = {
  token: 'token',
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
}

function renderRedirect(role: UserRole) {
  const authState: AuthState = {
    ...baseAuthState,
    user: {
      id: 'user-id',
      tenantId: 'tenant-id',
      email: `${role.toLowerCase()}@merhouse.local`,
      role,
      enabled: true,
      createdAt: new Date().toISOString(),
    },
  }

  render(
    <AuthContext.Provider value={authState}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/admin" element={<h1>Admin Landing</h1>} />
          <Route path="/merchant" element={<h1>Merchant Landing</h1>} />
          <Route path="/warehouse" element={<h1>Warehouse Landing</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('HomeRedirect', () => {
  it('routes admins to the admin console', () => {
    renderRedirect('ADMIN')

    expect(screen.getByRole('heading', { name: 'Admin Landing' })).toBeInTheDocument()
  })

  it('routes merchants to the merchant console', () => {
    renderRedirect('MERCHANT')

    expect(screen.getByRole('heading', { name: 'Merchant Landing' })).toBeInTheDocument()
  })

  it('routes warehouse operators to the warehouse console', () => {
    renderRedirect('WAREHOUSE_OPERATOR')

    expect(screen.getByRole('heading', { name: 'Warehouse Landing' })).toBeInTheDocument()
  })
})
