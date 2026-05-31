import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { AppLayout } from './AppLayout'

const apiMock = vi.hoisted(() => ({
  notificationSummary: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: apiMock,
}))

const baseUser = {
  id: 'user-id',
  tenantId: 'tenant-id',
  email: 'role@merhouse.local',
  enabled: true,
  createdAt: '2026-05-20T00:00:00Z',
}

const baseAuthState: AuthState = {
  token: 'role-token',
  loading: false,
  user: {
    ...baseUser,
    role: 'AUDITOR',
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
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.notificationSummary.mockResolvedValue({
      unreadCount: 2,
      latestDeliveryAt: '2026-05-29T12:00:00Z',
    })
  })

  it('keeps auditor navigation read-only and diagnostic-focused', () => {
    renderLayout(baseAuthState)

    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Partners' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Service review' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Outbox' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Audit trail' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Assistant' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alerts' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Organizations' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Accounts' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Access requests' })).not.toBeInTheDocument()
  })

  it('shows a scoped unread alert count in navigation', async () => {
    renderLayout(baseAuthState)

    expect(await screen.findByLabelText('2 unread alerts')).toBeInTheDocument()
    expect(apiMock.notificationSummary).toHaveBeenCalledWith('role-token')
  })

  it('hides the alert badge when there are no unread alerts', async () => {
    apiMock.notificationSummary.mockResolvedValue({
      unreadCount: 0,
      latestDeliveryAt: null,
    })

    renderLayout(baseAuthState)

    expect(screen.getByRole('link', { name: 'Alerts' })).toBeInTheDocument()
    await screen.findByRole('link', { name: 'Alerts' })
    expect(screen.queryByLabelText(/unread alerts/i)).not.toBeInTheDocument()
  })

  it.each([
    'OWNER',
    'ADMIN',
    'SUPPORT_ADMIN',
    'AUDITOR',
    'MERCHANT',
    'WAREHOUSE_OPERATOR',
  ] as const)('shows assistant and alerts navigation to %s users', async (role) => {
    renderLayout({
      ...baseAuthState,
      user: {
        ...baseUser,
        role,
      },
    })

    expect(screen.getByRole('link', { name: 'Assistant' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alerts/ })).toBeInTheDocument()
    expect(await screen.findByLabelText('2 unread alerts')).toBeInTheDocument()
  })
})
