import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { AppLayout } from './AppLayout'

const baseAuthState: AuthState = {
  token: 'role-token',
  loading: false,
  user: {
    id: 'user-id',
    tenantId: 'tenant-id',
    email: 'role@merhouse.local',
    role: 'AUDITOR',
    enabled: true,
    createdAt: '2026-05-20T00:00:00Z',
  },
  login: vi.fn(),
  logout: vi.fn(),
}

function renderLayout(state: AuthState, child: ReactNode = <div>Route content</div>) {
  return render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={['/admin/audit']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/admin/audit" element={child} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('AppLayout role navigation', () => {
  it('keeps auditor navigation read-only and diagnostic-focused', () => {
    renderLayout(baseAuthState)

    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Relations' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Service' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Outbox' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Audit' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tenants' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Access' })).not.toBeInTheDocument()
  })
})
