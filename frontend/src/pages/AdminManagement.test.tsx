import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { ApiError } from '../api/client'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { AdminAccessRequestsPage, AdminTenantsPage, AdminUsersPage } from './AdminPages'

const apiMock = vi.hoisted(() => ({
  tenants: vi.fn(),
  users: vi.fn(),
  orders: vi.fn(),
  adminSummary: vi.fn(),
  adminTenantHealth: vi.fn(),
  createTenant: vi.fn(),
  suspendTenant: vi.fn(),
  activateTenant: vi.fn(),
  createUser: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  changeUserRole: vi.fn(),
  adminResetUserPassword: vi.fn(),
  accessRequests: vi.fn(),
  approveAccessRequest: vi.fn(),
  rejectAccessRequest: vi.fn(),
  convertAccessRequest: vi.fn(),
}))

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number
    details: string[]

    constructor(status: number, message: string, details: string[] = []) {
      super(message)
      this.status = status
      this.details = details
    }
  },
  api: apiMock,
}))

const authState: AuthState = {
  token: 'admin-token',
  loading: false,
  user: {
    id: 'admin-id',
    tenantId: 'admin-tenant',
    email: 'owner@example.test',
    role: 'ADMIN',
    enabled: true,
    createdAt: '2026-05-17T00:00:00Z',
  },
  login: vi.fn(),
  logout: vi.fn(),
}

const tenants = [
  {
    id: 'merchant-tenant',
    name: 'Acme Merchant',
    type: 'MERCHANT',
    active: true,
    suspensionReason: null,
    suspendedAt: null,
    createdAt: '2026-05-17T00:00:00Z',
  },
  {
    id: 'warehouse-tenant',
    name: 'Cairo Warehouse',
    type: 'WAREHOUSE_PROVIDER',
    active: true,
    suspensionReason: null,
    suspendedAt: null,
    createdAt: '2026-05-17T00:00:00Z',
  },
]

const users = [
  {
    id: 'admin-id',
    tenantId: 'admin-tenant',
    email: 'owner@example.test',
    role: 'ADMIN',
    enabled: true,
    createdAt: '2026-05-17T00:00:00Z',
  },
  {
    id: 'merchant-user',
    tenantId: 'merchant-tenant',
    email: 'merchant@merhouse.local',
    role: 'MERCHANT',
    enabled: true,
    createdAt: '2026-05-17T00:00:00Z',
  },
]

function renderWithAuth(element: ReactNode, state: AuthState = authState) {
  return render(<AuthContext.Provider value={state}>{element}</AuthContext.Provider>)
}

describe('Admin tenant management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.tenants.mockResolvedValue(tenants)
    apiMock.createTenant.mockResolvedValue({
      id: 'new-tenant',
      name: 'New Merchant',
      type: 'MERCHANT',
      active: true,
      suspensionReason: null,
      suspendedAt: null,
      createdAt: '2026-05-17T00:01:00Z',
    })
  })

  it('creates a tenant and adds it to the table', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminTenantsPage />)

    const createTenantForm = await screen.findByRole('form', { name: 'Create tenant form' })
    await user.type(within(createTenantForm).getByLabelText('Name'), 'New Merchant')
    await user.click(within(createTenantForm).getByRole('button', { name: 'Create tenant' }))

    expect(apiMock.createTenant).toHaveBeenCalledWith('admin-token', {
      name: 'New Merchant',
      type: 'MERCHANT',
    })
    expect(await screen.findByText('New Merchant')).toBeInTheDocument()
  })

  it('filters tenants by type', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminTenantsPage />)

    await screen.findByText('Acme Merchant')
    await user.selectOptions(screen.getAllByLabelText('Type')[1], 'WAREHOUSE_PROVIDER')

    expect(screen.getByText('Cairo Warehouse')).toBeInTheDocument()
    expect(screen.queryByText('Acme Merchant')).not.toBeInTheDocument()
  })

  it('shows the backend error when tenant creation fails', async () => {
    const user = userEvent.setup()
    apiMock.createTenant.mockRejectedValue(new ApiError(400, 'Validation failed', ['name must not be blank']))
    renderWithAuth(<AdminTenantsPage />)

    const createTenantForm = await screen.findByRole('form', { name: 'Create tenant form' })
    await user.type(within(createTenantForm).getByLabelText('Name'), 'Rejected Tenant')
    await user.click(within(createTenantForm).getByRole('button', { name: 'Create tenant' }))

    expect(await screen.findByText('name must not be blank')).toBeInTheDocument()
  })
})

describe('Admin access request management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.accessRequests.mockResolvedValue([
      {
        id: 'request-1',
        organizationName: 'New Merchant',
        requesterEmail: 'owner@new.test',
        requestedRole: 'MERCHANT',
        notes: 'Ready to onboard',
        status: 'PENDING',
        reviewedByUserId: null,
        reviewNote: null,
        reviewedAt: null,
        createdAt: '2026-05-18T00:00:00Z',
      },
    ])
    apiMock.approveAccessRequest.mockResolvedValue({
      id: 'request-1',
      organizationName: 'New Merchant',
      requesterEmail: 'owner@new.test',
      requestedRole: 'MERCHANT',
      notes: 'Ready to onboard',
      status: 'APPROVED',
      reviewedByUserId: 'admin-id',
      reviewNote: 'Looks good',
      reviewedAt: '2026-05-18T00:10:00Z',
      createdAt: '2026-05-18T00:00:00Z',
    })
  })

  it('loads and approves a pending access request', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminAccessRequestsPage />)

    expect(await screen.findByText('owner@new.test')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Note applied to the next review action'), 'Looks good')
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    expect(apiMock.approveAccessRequest).toHaveBeenCalledWith('admin-token', 'request-1', {
      reviewNote: 'Looks good',
    })
    expect(await screen.findByText('APPROVED')).toBeInTheDocument()
  })

  it('shows access requests to support admins without decision controls', async () => {
    renderWithAuth(<AdminAccessRequestsPage />, {
      ...authState,
      user: {
        ...authState.user!,
        role: 'SUPPORT_ADMIN',
      },
    })

    expect(await screen.findByText('owner@new.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Owner/admin only' })).toBeDisabled()
    expect(apiMock.approveAccessRequest).not.toHaveBeenCalled()
  })

  it('renders injection-shaped access request text without creating executable elements', async () => {
    apiMock.accessRequests.mockResolvedValue([
      {
        id: 'request-security',
        organizationName: '<img src=x onerror=alert(1)> Merchant',
        requesterEmail: 'security@new.test',
        requestedRole: 'MERCHANT',
        notes: "' OR '1'='1 <script>alert(1)</script>",
        status: 'PENDING',
        reviewedByUserId: null,
        reviewNote: null,
        reviewedAt: null,
        createdAt: '2026-05-18T00:00:00Z',
      },
    ])

    const { container } = renderWithAuth(<AdminAccessRequestsPage />)

    const row = await screen.findByRole('row', { name: /security@new\.test/i })
    expect(within(row).getByText('<img src=x onerror=alert(1)> Merchant')).toBeInTheDocument()
    expect(within(row).getByText("' OR '1'='1 <script>alert(1)</script>")).toBeInTheDocument()
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(row.querySelector('script')).toBeNull()
  })
})

describe('Admin user management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.tenants.mockResolvedValue(tenants)
    apiMock.users.mockResolvedValue(users)
    apiMock.orders.mockResolvedValue([])
    apiMock.adminSummary.mockResolvedValue({
      tenantCount: 2,
      activeTenantCount: 2,
      disabledUserCount: 0,
      openOrderCount: 0,
      pendingAccessRequestCount: 0,
      failedOutboxEventCount: 0,
    })
    apiMock.adminTenantHealth.mockResolvedValue([])
    apiMock.createUser.mockResolvedValue({
      id: 'operator-user',
      tenantId: 'warehouse-tenant',
      email: 'operator@merhouse.local',
      role: 'WAREHOUSE_OPERATOR',
      enabled: true,
      createdAt: '2026-05-17T00:01:00Z',
    })
    apiMock.disableUser.mockResolvedValue({
      ...users.find((user) => user.id === 'merchant-user')!,
      enabled: false,
    })
  })

  it('creates a user and adds it to the users table', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminUsersPage />)

    await screen.findByText('merchant@merhouse.local')
    const createUserForm = screen.getByRole('form', { name: 'Create user form' })
    await user.selectOptions(within(createUserForm).getByLabelText('Tenant'), 'warehouse-tenant')
    await user.selectOptions(within(createUserForm).getByLabelText('Role'), 'WAREHOUSE_OPERATOR')
    await user.type(within(createUserForm).getByLabelText('Email'), 'operator@merhouse.local')
    await user.type(within(createUserForm).getByLabelText('Password'), 'operator-password')
    await user.click(within(createUserForm).getByRole('button', { name: 'Create user' }))

    expect(apiMock.createUser).toHaveBeenCalledWith('admin-token', {
      tenantId: 'warehouse-tenant',
      email: 'operator@merhouse.local',
      password: 'operator-password',
      role: 'WAREHOUSE_OPERATOR',
    })
    expect(await screen.findByText('operator@merhouse.local')).toBeInTheDocument()
  })

  it('shows the backend error when user creation violates role policy', async () => {
    const user = userEvent.setup()
    apiMock.createUser.mockRejectedValue(
      new ApiError(409, 'Conflict', ['WAREHOUSE_OPERATOR users must belong to a warehouse provider tenant.']),
    )
    renderWithAuth(<AdminUsersPage />)

    await screen.findByText('merchant@merhouse.local')
    const createUserForm = screen.getByRole('form', { name: 'Create user form' })
    await user.type(within(createUserForm).getByLabelText('Email'), 'bad-operator@merhouse.local')
    await user.type(within(createUserForm).getByLabelText('Password'), 'operator-password')
    await user.selectOptions(within(createUserForm).getByLabelText('Role'), 'WAREHOUSE_OPERATOR')
    await user.click(within(createUserForm).getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('WAREHOUSE_OPERATOR users must belong to a warehouse provider tenant.')).toBeInTheDocument()
  })

  it('disables an enabled user from the table', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminUsersPage />)

    const row = await screen.findByRole('row', { name: /merchant@merhouse.local/i })
    await user.click(within(row).getByRole('button', { name: 'Disable' }))

    expect(apiMock.disableUser).toHaveBeenCalledWith('admin-token', 'merchant-user', { reason: 'Administrative account update' })
    expect(await within(row).findByText('DISABLED')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Disabled' })).toBeDisabled()
  })

  it('does not offer self-disable for the current admin', async () => {
    renderWithAuth(<AdminUsersPage />)

    const row = await screen.findByRole('row', { name: /owner@example.test/i })
    const button = within(row).getByRole('button', { name: 'Current user' })

    expect(button).toBeDisabled()
  })

  it('allows support admins to reset ordinary users without account mutation controls', async () => {
    const user = userEvent.setup()
    apiMock.adminResetUserPassword.mockResolvedValue(users[1])
    renderWithAuth(<AdminUsersPage />, {
      ...authState,
      user: {
        ...authState.user!,
        role: 'SUPPORT_ADMIN',
      },
    })

    await screen.findByText('merchant@merhouse.local')
    expect(screen.getByRole('button', { name: 'Owner/admin only' })).toBeDisabled()

    const row = screen.getByRole('row', { name: /merchant@merhouse.local/i })
    expect(within(row).getByRole('button', { name: 'Disable' })).toBeDisabled()
    await user.click(within(row).getByRole('button', { name: 'Reset' }))

    expect(apiMock.adminResetUserPassword).toHaveBeenCalledWith('admin-token', 'merchant-user', {
      newPassword: 'temporary-password',
      reason: 'Administrative account update',
    })
  })

  it('does not offer disabling the last enabled owner shown in the table', async () => {
    apiMock.users.mockResolvedValue([
      {
        id: 'only-owner',
        tenantId: 'admin-tenant',
        email: 'only-owner@merhouse.local',
        role: 'OWNER',
        enabled: true,
        createdAt: '2026-05-17T00:00:00Z',
      },
      users[1],
    ])
    renderWithAuth(<AdminUsersPage />)

    const row = await screen.findByRole('row', { name: /only-owner@merhouse.local/i })
    const button = within(row).getByRole('button', { name: 'Last owner' })

    expect(button).toBeDisabled()
  })

  it('allows disabling another admin when one enabled admin remains', async () => {
    const user = userEvent.setup()
    apiMock.users.mockResolvedValue([
      ...users,
      {
        id: 'secondary-admin',
        tenantId: 'warehouse-tenant',
        email: 'secondary-admin@example.test',
        role: 'ADMIN',
        enabled: true,
        createdAt: '2026-05-17T00:00:00Z',
      },
    ])
    apiMock.disableUser.mockResolvedValue({
      id: 'secondary-admin',
      tenantId: 'warehouse-tenant',
      email: 'secondary-admin@example.test',
      role: 'ADMIN',
      enabled: false,
      createdAt: '2026-05-17T00:00:00Z',
    })
    renderWithAuth(<AdminUsersPage />, {
      ...authState,
      user: {
        ...authState.user!,
        role: 'OWNER',
      },
    })

    const row = await screen.findByRole('row', { name: /secondary-admin@example.test/i })
    await user.click(within(row).getByRole('button', { name: 'Disable' }))

    expect(apiMock.disableUser).toHaveBeenCalledWith('admin-token', 'secondary-admin', { reason: 'Administrative account update' })
    expect(await within(row).findByText('DISABLED')).toBeInTheDocument()
  })

  it('filters users by role', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminUsersPage />)

    await screen.findByText('merchant@merhouse.local')
    await user.selectOptions(screen.getAllByLabelText('Role')[1], 'WAREHOUSE_OPERATOR')

    expect(screen.queryByText('merchant@merhouse.local')).not.toBeInTheDocument()
  })

  it('keeps dense admin user data usable through pagination and email search', async () => {
    const user = userEvent.setup()
    const denseUsers = Array.from({ length: 31 }, (_, index) => ({
      id: `bulk-user-${index + 1}`,
      tenantId: index % 2 === 0 ? 'merchant-tenant' : 'warehouse-tenant',
      email: `bulk-user-${String(index + 1).padStart(2, '0')}@merhouse.local`,
      role: index % 2 === 0 ? 'MERCHANT' : 'WAREHOUSE_OPERATOR',
      enabled: true,
      createdAt: '2026-05-17T00:00:00Z',
    }))
    apiMock.users.mockResolvedValue([
      users[0],
      ...denseUsers,
    ])
    renderWithAuth(<AdminUsersPage />)

    await screen.findByText('bulk-user-01@merhouse.local')
    expect(screen.getByText('Showing 1-25 of 32 users')).toBeInTheDocument()
    expect(screen.queryByText('bulk-user-30@merhouse.local')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('bulk-user-30@merhouse.local')).toBeInTheDocument()
    expect(screen.getByText('Showing 26-32 of 32 users')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email search'), 'bulk-user-30')
    expect(screen.getByText('Showing 1-1 of 1 users')).toBeInTheDocument()
    expect(screen.getByText('bulk-user-30@merhouse.local')).toBeInTheDocument()
  })
})
