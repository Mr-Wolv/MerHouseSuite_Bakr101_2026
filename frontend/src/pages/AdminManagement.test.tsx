import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { AdminAccessRequestsPage, AdminAuditPage, AdminOverviewPage, AdminRelationshipsPage, AdminTenantsPage, AdminUsersPage } from './AdminPages'

const apiMock = vi.hoisted(() => ({
  tenants: vi.fn(),
  users: vi.fn(),
  orders: vi.fn(),
  adminSummary: vi.fn(),
  adminTenantHealth: vi.fn(),
  adminAuditEvents: vi.fn(),
  warehouses: vi.fn(),
  createWarehouse: vi.fn(),
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
  approveAndActivateAccessRequest: vi.fn(),
  rejectAccessRequest: vi.fn(),
  convertAccessRequest: vi.fn(),
  merchantWarehouseRelationships: vi.fn(),
  suspendMerchantWarehouseRelationship: vi.fn(),
  reactivateMerchantWarehouseRelationship: vi.fn(),
  endMerchantWarehouseRelationship: vi.fn(),
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

const relationships = [
  {
    id: 'relationship-1',
    merchantId: 'merchant-tenant',
    merchantName: 'Acme Merchant',
    warehouseProviderId: 'warehouse-tenant',
    warehouseProviderName: 'Cairo Warehouse',
    status: 'ACTIVE',
    serviceNotes: 'Daily receiving',
    createdAt: '2026-05-17T00:00:00Z',
    approvedAt: '2026-05-18T00:00:00Z',
    suspendedAt: null,
    endedAt: null,
    statusReason: null,
  },
  {
    id: 'relationship-2',
    merchantId: 'merchant-tenant',
    merchantName: 'Acme Merchant',
    warehouseProviderId: 'warehouse-tenant',
    warehouseProviderName: 'Delta Warehouse',
    status: 'SUSPENDED',
    serviceNotes: 'Overflow storage',
    createdAt: '2026-05-19T00:00:00Z',
    approvedAt: '2026-05-20T00:00:00Z',
    suspendedAt: '2026-05-21T00:00:00Z',
    endedAt: null,
    statusReason: 'Capacity review',
  },
]

function renderWithAuth(element: ReactNode, state: AuthState = authState) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={state}>{element}</AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('Admin overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.tenants.mockResolvedValue(tenants)
    apiMock.users.mockResolvedValue(users)
    apiMock.orders.mockResolvedValue([{
      id: 'order-1',
      merchantId: 'merchant-tenant',
      customerAddress: 'Cairo Customer',
      status: 'BACKORDERED',
      items: [{ id: 'item-1', inventoryItemId: 'inventory-1', sku: 'SKU-1', itemName: 'Merchant Item', quantity: 2 }],
      allocations: [],
      backorders: [{
        id: 'backorder-1',
        inventoryItemId: 'inventory-1',
        sku: 'SKU-1',
        itemName: 'Merchant Item',
        quantity: 1,
        status: 'OPEN',
        createdAt: '2026-05-17T00:00:00Z',
      }],
      createdAt: '2026-05-17T00:00:00Z',
    }])
    apiMock.adminSummary.mockResolvedValue({
      tenants: 2,
      suspendedTenants: 1,
      users: 2,
      enabledUsers: 2,
      platformAdmins: 1,
      pendingAccessRequests: 3,
      activeRelationships: 1,
      suspendedRelationships: 1,
      openInboundRequests: 4,
      openFulfillmentExceptions: 2,
      failedShipments: 1,
      returnedShipments: 1,
      failedOutboxEvents: 5,
      openServiceDisputes: 1,
      openServiceClaims: 1,
      pendingServiceReviews: 2,
    })
    apiMock.adminTenantHealth.mockResolvedValue([{
      tenant: tenants[0],
      tenantId: 'merchant-tenant',
      users: 1,
      relationships: 1,
      warehouses: 0,
      inventoryItems: 1,
      inboundRequests: 2,
      orders: 1,
      fulfillmentAllocations: 1,
      serviceStatements: 1,
      openDisputes: 1,
      openClaims: 0,
      pendingReviews: 1,
    }])
  })

  it('prioritizes attention-worthy admin work before platform ledgers', async () => {
    renderWithAuth(<AdminOverviewPage />)

    expect(await screen.findByRole('heading', { name: 'Admin Overview' })).toBeInTheDocument()
    expect(screen.getByLabelText('Platform attention queue')).toHaveTextContent('Review the signals below first')
    expect(screen.getByRole('heading', { name: 'Needs Attention First' })).toBeInTheDocument()
    expect(screen.getByText('6 active')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review requests/i })).toHaveAttribute('href', '/admin/access-requests')
    expect(screen.getByRole('link', { name: /Open outbox diagnostics/i })).toHaveAttribute('href', '/admin/outbox')
    expect(screen.getAllByRole('link', { name: /Open service review/i })).toHaveLength(3)
    expect(screen.getByRole('link', { name: /Review relationships/i })).toHaveAttribute('href', '/admin/relationships')
    expect(screen.queryByRole('link', { name: /Fulfillment exceptions 2/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Network scale and readiness' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Review order and tenant history' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent Operational Orders' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tenant Health' })).toBeInTheDocument()
  })

  it('renders the admin summary while slower operational ledgers are still loading', async () => {
    apiMock.orders.mockReturnValue(new Promise(() => {}))
    apiMock.adminTenantHealth.mockReturnValue(new Promise(() => {}))

    renderWithAuth(<AdminOverviewPage />)

    expect(await screen.findByRole('heading', { name: 'Needs Attention First' })).toBeInTheDocument()
    expect(screen.queryByText('Loading admin overview')).not.toBeInTheDocument()
    expect(screen.getByText('Loading order status')).toBeInTheDocument()
    expect(screen.getByText('Loading recent orders')).toBeInTheDocument()
    expect(screen.getByText('Loading tenant health')).toBeInTheDocument()
  })

  it('frames owner/admin-only overview signals as support review work', async () => {
    renderWithAuth(<AdminOverviewPage />, {
      ...authState,
      user: {
        ...authState.user!,
        role: 'SUPPORT_ADMIN',
      },
    })

    expect(await screen.findByRole('heading', { name: 'Admin Overview' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review and escalate/i })).toHaveAttribute('href', '/admin/access-requests')
    expect(screen.getByRole('link', { name: /Review diagnostics/i })).toHaveAttribute('href', '/admin/outbox')
    expect(screen.queryByRole('link', { name: /Review requests/i })).not.toBeInTheDocument()
  })

  it('does not point auditors at hidden access-request routes from fallback attention', async () => {
    renderWithAuth(<AdminOverviewPage />, {
      ...authState,
      user: {
        ...authState.user!,
        role: 'AUDITOR',
      },
    })

    expect(await screen.findByRole('heading', { name: 'Admin Overview' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Review requests/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Review and escalate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Access requests need review/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review diagnostics/i })).toHaveAttribute('href', '/admin/outbox')
  })
})

describe('Admin tenant management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.tenants.mockResolvedValue(tenants)
    apiMock.warehouses.mockResolvedValue([])
    apiMock.createTenant.mockResolvedValue({
      id: 'new-tenant',
      name: 'New Merchant',
      type: 'MERCHANT',
      active: true,
      suspensionReason: null,
      suspendedAt: null,
      createdAt: '2026-05-17T00:01:00Z',
    })
    apiMock.createWarehouse.mockResolvedValue({
      id: 'warehouse-location-1',
      tenantId: 'warehouse-tenant',
      name: 'Cairo Dock A',
      address: 'Cairo Dock 1',
      latitude: null,
      longitude: null,
      capacity: 120,
      createdAt: '2026-05-17T00:02:00Z',
    })
  })

  it('creates a tenant and adds it to the table', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminTenantsPage />)

    const createTenantForm = await screen.findByRole('form', { name: 'Create tenant form' })
    expect(screen.getByLabelText('Tenant governance controls')).toHaveTextContent('audit review has operational context')
    await user.type(within(createTenantForm).getByLabelText('Name'), ' New Merchant ')
    await user.click(within(createTenantForm).getByRole('button', { name: 'Create tenant' }))

    expect(apiMock.createTenant).toHaveBeenCalledWith('admin-token', {
      name: 'New Merchant',
      type: 'MERCHANT',
    })
    expect(await screen.findByText('New Merchant')).toBeInTheDocument()
  })

  it('registers a warehouse location for a warehouse-provider tenant', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminTenantsPage />)

    const warehouseForm = await screen.findByRole('form', { name: 'Register warehouse location form' })
    expect(within(warehouseForm).getByText(/Create at least one physical warehouse/)).toBeInTheDocument()
    await user.type(within(warehouseForm).getByLabelText('Warehouse name'), ' Cairo Dock A ')
    await user.type(within(warehouseForm).getByLabelText('Address'), ' Cairo Dock 1 ')
    await user.clear(within(warehouseForm).getByLabelText('Capacity'))
    await user.type(within(warehouseForm).getByLabelText('Capacity'), '120')
    await user.click(within(warehouseForm).getByRole('button', { name: 'Register warehouse' }))

    expect(apiMock.createWarehouse).toHaveBeenCalledWith('admin-token', {
      tenantId: 'warehouse-tenant',
      name: 'Cairo Dock A',
      address: 'Cairo Dock 1',
      capacity: 120,
    })
    expect(await within(warehouseForm).findByText('Cairo Warehouse (1 warehouses)')).toBeInTheDocument()
  })

  it('filters tenants by type', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminTenantsPage />)

    await screen.findByText('Acme Merchant')
    await user.selectOptions(screen.getAllByLabelText('Type')[1], 'WAREHOUSE_PROVIDER')

    expect(screen.getByText('Cairo Warehouse')).toBeInTheDocument()
    expect(screen.queryByText('Acme Merchant')).not.toBeInTheDocument()
  })

  it('paginates tenant governance rows so large local proof datasets stay mobile-ready', async () => {
    const user = userEvent.setup()
    apiMock.tenants.mockResolvedValue(Array.from({ length: 30 }, (_, index) => ({
      id: `tenant-${index + 1}`,
      name: `Proof Tenant ${index + 1}`,
      type: index % 2 === 0 ? 'MERCHANT' : 'WAREHOUSE_PROVIDER',
      active: true,
      suspensionReason: null,
      suspendedAt: null,
      createdAt: '2026-05-17T00:00:00Z',
    })))
    renderWithAuth(<AdminTenantsPage />)

    expect(await screen.findByText('Proof Tenant 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Tenant result pagination')).toHaveTextContent('Showing 1-25 of 30 tenants')
    expect(screen.queryByText('Proof Tenant 30')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByLabelText('Tenant result pagination')).toHaveTextContent('Showing 26-30 of 30 tenants')
    expect(screen.getByText('Proof Tenant 30')).toBeInTheDocument()
    expect(screen.queryByText('Proof Tenant 1')).not.toBeInTheDocument()
  })

  it('surfaces a newly created tenant on the first governance page in dense datasets', async () => {
    const user = userEvent.setup()
    apiMock.tenants.mockResolvedValue(Array.from({ length: 30 }, (_, index) => ({
      id: `tenant-${index + 1}`,
      name: `Proof Tenant ${index + 1}`,
      type: index % 2 === 0 ? 'MERCHANT' : 'WAREHOUSE_PROVIDER',
      active: true,
      suspensionReason: null,
      suspendedAt: null,
      createdAt: '2026-05-17T00:00:00Z',
    })))
    renderWithAuth(<AdminTenantsPage />)

    await screen.findByText('Proof Tenant 1')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByLabelText('Tenant result pagination')).toHaveTextContent('Showing 26-30 of 30 tenants')

    const createTenantForm = screen.getByRole('form', { name: 'Create tenant form' })
    await user.type(within(createTenantForm).getByLabelText('Name'), 'New Merchant')
    await user.click(within(createTenantForm).getByRole('button', { name: 'Create tenant' }))

    expect(await screen.findByText('New Merchant')).toBeInTheDocument()
    expect(screen.getByLabelText('Tenant result pagination')).toHaveTextContent('Showing 1-25 of 31 tenants')
    expect(screen.queryByText('Proof Tenant 30')).not.toBeInTheDocument()
  })

  it('caps warehouse provider registration options for dense tenant datasets', async () => {
    apiMock.tenants.mockResolvedValue(Array.from({ length: 60 }, (_, index) => ({
      id: `provider-${index + 1}`,
      name: `Provider Tenant ${index + 1}`,
      type: 'WAREHOUSE_PROVIDER',
      active: true,
      suspensionReason: null,
      suspendedAt: null,
      createdAt: new Date(Date.UTC(2026, 4, index + 1)).toISOString(),
    })))
    renderWithAuth(<AdminTenantsPage />)

    const warehouseForm = await screen.findByRole('form', { name: 'Register warehouse location form' })
    const providerSelect = within(warehouseForm).getByLabelText('Provider tenant')
    const optionValues = within(providerSelect).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)

    expect(optionValues).toHaveLength(50)
    expect(optionValues).toContain('provider-60')
    expect(optionValues).not.toContain('provider-1')
    expect(within(providerSelect).getByRole('option', { name: /Provider Tenant 60/ })).toBeInTheDocument()
    expect(within(warehouseForm).getByText('Showing the 50 most recent active warehouse provider tenants for this registration control.')).toBeInTheDocument()
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

describe('Admin relationship governance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.merchantWarehouseRelationships.mockResolvedValue(relationships)
    apiMock.suspendMerchantWarehouseRelationship.mockResolvedValue({
      ...relationships[0],
      status: 'SUSPENDED',
      suspendedAt: '2026-05-22T00:00:00Z',
      statusReason: 'Relationship governance review',
    })
    apiMock.reactivateMerchantWarehouseRelationship.mockResolvedValue({
      ...relationships[1],
      status: 'ACTIVE',
      statusReason: 'Relationship governance review',
    })
    apiMock.endMerchantWarehouseRelationship.mockResolvedValue({
      ...relationships[0],
      status: 'ENDED',
      endedAt: '2026-05-22T00:00:00Z',
      statusReason: 'Relationship governance review',
    })
  })

  it('shows lifecycle guidance and lets admins suspend active relationships', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminRelationshipsPage />)

    const activeRow = await screen.findByRole('row', { name: /Cairo Warehouse/i })
    expect(screen.getByLabelText('Relationship operating boundary')).toHaveTextContent('same lifecycle trail')
    expect(within(activeRow).getByText('Created')).toBeInTheDocument()
    expect(within(activeRow).getByText('Activated')).toBeInTheDocument()

    await user.click(within(activeRow).getByRole('button', { name: 'Suspend' }))

    expect(apiMock.suspendMerchantWarehouseRelationship).toHaveBeenCalledWith('admin-token', 'relationship-1', {
      reason: 'Relationship governance review',
    })
    expect(await within(activeRow).findByText('SUSPENDED')).toBeInTheDocument()
  })

  it('keeps support admins in read-only relationship review mode', async () => {
    renderWithAuth(<AdminRelationshipsPage />, {
      ...authState,
      user: {
        ...authState.user!,
        role: 'SUPPORT_ADMIN',
      },
    })

    const activeRow = await screen.findByRole('row', { name: /Cairo Warehouse/i })
    expect(within(activeRow).getByText('Read-only relationship review')).toHaveClass('data-chip')
    expect(within(activeRow).queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument()
    expect(apiMock.suspendMerchantWarehouseRelationship).not.toHaveBeenCalled()
  })

  it('renders relationship route chrome while review data is still loading', async () => {
    apiMock.merchantWarehouseRelationships.mockReturnValue(new Promise(() => undefined))

    renderWithAuth(<AdminRelationshipsPage />)

    expect(await screen.findByRole('heading', { name: 'Relationships' })).toBeInTheDocument()
    expect(screen.getByText('Loading relationships')).toBeInTheDocument()
  })

  it('paginates relationship review rows for accumulated proof data', async () => {
    const user = userEvent.setup()
    apiMock.merchantWarehouseRelationships.mockResolvedValue(Array.from({ length: 30 }, (_, index) => ({
      ...relationships[0],
      id: `relationship-${index + 1}`,
      merchantName: `Merchant ${index + 1}`,
      warehouseProviderName: `Warehouse ${index + 1}`,
      createdAt: `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    })))

    renderWithAuth(<AdminRelationshipsPage />)

    expect(await screen.findByText('Merchant 30')).toBeInTheDocument()
    expect(screen.getByLabelText('Relationship result pagination')).toHaveTextContent('Showing 1-25 of 30 relationships')
    expect(screen.queryByText('Merchant 1')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByLabelText('Relationship result pagination')).toHaveTextContent('Showing 26-30 of 30 relationships')
    expect(screen.getByText('Merchant 1')).toBeInTheDocument()
    expect(screen.queryByText('Merchant 30')).not.toBeInTheDocument()
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
    expect(screen.getByLabelText('Onboarding review controls')).toHaveTextContent('Approve & activate')
    expect(screen.getByLabelText('Access request status narration')).toHaveTextContent('approved requests still need conversion')
    await user.type(screen.getByLabelText('Note applied to the next review action'), 'Looks good')
    await user.click(screen.getByRole('button', { name: 'Approve only' }))

    expect(apiMock.approveAccessRequest).toHaveBeenCalledWith('admin-token', 'request-1', {
      reviewNote: 'Looks good',
    })
    const row = await screen.findByRole('row', { name: /owner@new\.test/i })
    expect(within(row).getByText('APPROVED')).toBeInTheDocument()
    expect(within(row).getByText('Reviewed')).toBeInTheDocument()
  })

  it('approves and activates a pending access request in one step', async () => {
    const user = userEvent.setup()
    apiMock.approveAndActivateAccessRequest.mockResolvedValue({
      id: 'request-1',
      organizationName: 'New Merchant',
      requesterEmail: 'owner@new.test',
      requestedRole: 'MERCHANT',
      notes: 'Ready to onboard',
      status: 'APPROVED',
      reviewedByUserId: 'admin-id',
      reviewNote: 'Activated',
      reviewedAt: '2026-05-18T00:10:00Z',
      convertedAt: '2026-05-18T00:10:00Z',
      convertedTenantId: 'tenant-1',
      convertedUserId: 'user-1',
      createdAt: '2026-05-18T00:00:00Z',
    })
    renderWithAuth(<AdminAccessRequestsPage />)

    const pendingRow = await screen.findByRole('row', { name: /owner@new\.test/i })
    await user.type(screen.getByLabelText('Note applied to the next review action'), 'Activated')
    await user.click(within(pendingRow).getByRole('button', { name: 'Approve & activate' }))

    expect(apiMock.approveAndActivateAccessRequest).toHaveBeenCalledWith('admin-token', 'request-1', {
      reviewNote: 'Activated',
    })
    expect(within(pendingRow).getByText('APPROVED')).toBeInTheDocument()
    expect(within(pendingRow).getByText('Account created')).toHaveClass('data-chip')
  })

  it('shows access requests to support admins as review and escalation work', async () => {
    renderWithAuth(<AdminAccessRequestsPage />, {
      ...authState,
      user: {
        ...authState.user!,
        role: 'SUPPORT_ADMIN',
      },
    })

    expect(await screen.findByText('owner@new.test')).toBeInTheDocument()
    expect(screen.getByText('Review and escalate')).toHaveClass('data-chip')
    expect(screen.queryByRole('button', { name: 'Approve only' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve & activate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Convert' })).not.toBeInTheDocument()
    expect(apiMock.approveAccessRequest).not.toHaveBeenCalled()
  })

  it('renders only currently available owner actions instead of repeated disabled controls', async () => {
    const user = userEvent.setup()
    apiMock.accessRequests.mockResolvedValue([
      {
        id: 'request-pending',
        organizationName: 'Pending Merchant',
        requesterEmail: 'pending@new.test',
        requestedRole: 'MERCHANT',
        notes: 'Needs review',
        status: 'PENDING',
        reviewedByUserId: null,
        reviewNote: null,
        reviewedAt: null,
        createdAt: '2026-05-18T00:00:00Z',
      },
      {
        id: 'request-approved',
        organizationName: 'Approved Merchant',
        requesterEmail: 'approved@new.test',
        requestedRole: 'MERCHANT',
        notes: 'Ready',
        status: 'APPROVED',
        reviewedByUserId: 'admin-id',
        reviewNote: 'Approved',
        reviewedAt: '2026-05-18T00:10:00Z',
        createdAt: '2026-05-18T00:00:00Z',
      },
      {
        id: 'request-rejected',
        organizationName: 'Rejected Merchant',
        requesterEmail: 'rejected@new.test',
        requestedRole: 'MERCHANT',
        notes: 'No',
        status: 'REJECTED',
        reviewedByUserId: 'admin-id',
        reviewNote: 'Rejected',
        reviewedAt: '2026-05-18T00:10:00Z',
        createdAt: '2026-05-18T00:00:00Z',
      },
      {
        id: 'request-converted',
        organizationName: 'Converted Merchant',
        requesterEmail: 'converted@new.test',
        requestedRole: 'MERCHANT',
        notes: 'Done',
        status: 'APPROVED',
        reviewedByUserId: 'admin-id',
        reviewNote: 'Converted',
        reviewedAt: '2026-05-18T00:10:00Z',
        convertedAt: '2026-05-18T00:20:00Z',
        convertedTenantId: 'tenant-1',
        convertedUserId: 'user-1',
        createdAt: '2026-05-18T00:00:00Z',
      },
    ])

    renderWithAuth(<AdminAccessRequestsPage />)

    const pendingRow = await screen.findByRole('row', { name: /pending@new\.test/i })
    expect(within(pendingRow).getByRole('button', { name: 'Approve & activate' })).toBeEnabled()
    expect(within(pendingRow).getByRole('button', { name: 'Approve only' })).toBeEnabled()
    expect(within(pendingRow).getByRole('button', { name: 'Reject' })).toBeEnabled()
    expect(within(pendingRow).queryByRole('button', { name: 'Convert' })).not.toBeInTheDocument()

    const approvedRow = screen.getByRole('row', { name: /approved@new\.test/i })
    expect(within(approvedRow).getByText('Approval recorded')).toHaveClass('data-chip')
    expect(within(approvedRow).getByText('Enter setup password')).toHaveClass('data-chip')
    expect(within(approvedRow).queryByRole('button', { name: 'Convert' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Temporary setup password'), 'ready-password')
    expect(within(approvedRow).queryByText('Enter setup password')).not.toBeInTheDocument()
    expect(within(approvedRow).getByRole('button', { name: 'Convert' })).toBeEnabled()
    expect(within(approvedRow).queryByRole('button', { name: 'Approve only' })).not.toBeInTheDocument()
    expect(within(approvedRow).queryByRole('button', { name: 'Approve & activate' })).not.toBeInTheDocument()
    expect(within(approvedRow).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()

    const rejectedRow = screen.getByRole('row', { name: /rejected@new\.test/i })
    expect(within(rejectedRow).getByText('Rejected request')).toHaveClass('data-chip')
    expect(within(rejectedRow).queryByRole('button')).not.toBeInTheDocument()

    const convertedRow = screen.getByRole('row', { name: /converted@new\.test/i })
    expect(within(convertedRow).getByText('Account created')).toHaveClass('data-chip')
    expect(within(convertedRow).queryByRole('button')).not.toBeInTheDocument()
  })

  it('requires conversion reason before converting an approved access request', async () => {
    const user = userEvent.setup()
    apiMock.accessRequests.mockResolvedValue([
      {
        id: 'request-approved',
        organizationName: 'Approved Merchant',
        requesterEmail: 'approved@new.test',
        requestedRole: 'MERCHANT',
        notes: 'Ready',
        status: 'APPROVED',
        reviewedByUserId: 'admin-id',
        reviewNote: 'Approved',
        reviewedAt: '2026-05-18T00:10:00Z',
        convertedTenantId: null,
        convertedUserId: null,
        convertedAt: null,
        createdAt: '2026-05-18T00:00:00Z',
      },
    ])
    apiMock.convertAccessRequest.mockResolvedValue({
      id: 'request-approved',
      organizationName: 'Approved Merchant',
      requesterEmail: 'approved@new.test',
      requestedRole: 'MERCHANT',
      notes: 'Ready',
      status: 'APPROVED',
      reviewedByUserId: 'admin-id',
      reviewNote: 'Approved',
      reviewedAt: '2026-05-18T00:10:00Z',
      convertedTenantId: 'tenant-1',
      convertedUserId: 'user-1',
      convertedAt: '2026-05-18T00:20:00Z',
      createdAt: '2026-05-18T00:00:00Z',
    })

    renderWithAuth(<AdminAccessRequestsPage />)

    const row = await screen.findByRole('row', { name: /approved@new\.test/i })
    await user.type(screen.getByLabelText('Temporary setup password'), 'ready-password')
    await user.clear(screen.getByLabelText('Conversion reason'))
    expect(within(row).getByText('Enter conversion reason')).toHaveClass('warning-chip')
    expect(within(row).queryByRole('button', { name: 'Convert' })).not.toBeInTheDocument()
    expect(apiMock.convertAccessRequest).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Conversion reason'), '  Ready to provision  ')
    await user.click(within(row).getByRole('button', { name: 'Convert' }))

    expect(apiMock.convertAccessRequest).toHaveBeenCalledWith('admin-token', 'request-approved', {
      tenantName: 'Approved Merchant',
      temporaryPassword: 'ready-password',
      reason: 'Ready to provision',
    })
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
    expect(screen.getByLabelText('Privileged account changes')).toHaveTextContent('Reset buttons stay locked')
    expect(screen.getByLabelText('Account action safety summary')).toHaveTextContent('RESET LOCKED')
    const createUserForm = screen.getByRole('form', { name: 'Create user form' })
    await user.selectOptions(within(createUserForm).getByLabelText('Tenant'), 'warehouse-tenant')
    await user.selectOptions(within(createUserForm).getByLabelText('Role'), 'WAREHOUSE_OPERATOR')
    await user.type(within(createUserForm).getByLabelText('Email'), ' operator@merhouse.local ')
    await user.type(within(createUserForm).getByLabelText('Password'), ' operator-password ')
    await user.click(within(createUserForm).getByRole('button', { name: 'Create user' }))

    expect(apiMock.createUser).toHaveBeenCalledWith('admin-token', {
      tenantId: 'warehouse-tenant',
      email: 'operator@merhouse.local',
      password: ' operator-password ',
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
    expect(within(row).getByRole('button', { name: 'Enable' })).toBeInTheDocument()
  })

  it('explains self-disable as a state chip for the current admin', async () => {
    renderWithAuth(<AdminUsersPage />)

    const row = await screen.findByRole('row', { name: /owner@example.test/i })
    expect(within(row).getByText('Current user')).toHaveClass('data-chip')
    expect(within(row).queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
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
    expect(screen.getByText('Owner/admin account creation')).toHaveClass('data-chip')

    const row = screen.getByRole('row', { name: /merchant@merhouse.local/i })
    expect(within(row).getByText('Owner/admin action')).toHaveClass('data-chip')
    expect(within(row).queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Reason for privileged actions'))
    await user.type(screen.getByLabelText('Reason for privileged actions'), ' Support recovery ')
    await user.type(screen.getByLabelText('Temporary reset password'), 'support-reset-password')
    expect(screen.getByLabelText('Account action safety summary')).toHaveTextContent('RESET READY')
    await user.click(within(row).getByRole('button', { name: 'Reset' }))

    expect(apiMock.adminResetUserPassword).toHaveBeenCalledWith('admin-token', 'merchant-user', {
      newPassword: 'support-reset-password',
      reason: 'Support recovery',
    })
  })

  it('explains the last enabled owner protection as a state chip', async () => {
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
    expect(within(row).getByText('Last owner')).toHaveClass('data-chip')
    expect(within(row).queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
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

describe('Admin audit review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.adminAuditEvents.mockResolvedValue([
      {
        id: 'audit-summary',
        actorUserId: 'merchant-user',
        actorEmail: 'merchant@merhouse.local',
        action: 'ASSISTANT_SUMMARY',
        aggregateType: 'AssistantInteraction',
        aggregateId: '11111111-1111-4111-8111-111111111111',
        reason: 'Assistant generated scoped summary',
        metadata: { scope: 'MERCHANT_OPERATIONS' },
        createdAt: '2026-05-30T00:00:00Z',
      },
      {
        id: 'audit-suggestion',
        actorUserId: 'merchant-user',
        actorEmail: 'merchant@merhouse.local',
        action: 'ASSISTANT_SUGGESTION_ACCEPTED',
        aggregateType: 'AssistantInteraction',
        aggregateId: '22222222-2222-4222-8222-222222222222',
        reason: 'Reviewed by operator',
        metadata: { actionStatus: 'ACCEPTED' },
        createdAt: '2026-05-30T00:01:00Z',
      },
      {
        id: 'tenant-created',
        actorUserId: 'admin-id',
        actorEmail: 'owner@example.test',
        action: 'TENANT_CREATED',
        aggregateType: 'Tenant',
        aggregateId: '33333333-3333-4333-8333-333333333333',
        reason: 'Tenant created',
        metadata: {},
        createdAt: '2026-05-30T00:02:00Z',
      },
    ])
  })

  it('summarizes and filters assistant audit events for platform review', async () => {
    const user = userEvent.setup()
    renderWithAuth(<AdminAuditPage />)

    expect(await screen.findByText('ASSISTANT SUMMARY')).toBeInTheDocument()
    expect(screen.getByLabelText('Audit review lens')).toHaveTextContent('isolate summaries')
    expect(screen.getByRole('status')).toHaveTextContent('Showing 3 audit events')
    expect(screen.getByLabelText('Scrollable admin audit table')).toHaveAttribute('tabIndex', '0')
    expect(screen.getByText('TENANT CREATED')).toBeInTheDocument()
    expect(screen.getByText('Assistant summaries')).toBeInTheDocument()
    expect(screen.getByText('Suggestions accepted')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Audit filter'), 'ASSISTANT')

    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 assistant audit events')
    expect(screen.getByText('ASSISTANT SUGGESTION ACCEPTED')).toBeInTheDocument()
    expect(screen.queryByText('TENANT CREATED')).not.toBeInTheDocument()
    expect(apiMock.adminAuditEvents).toHaveBeenCalledWith('admin-token')
  })

  it('lets auditors review assistant audit records through the same read-only page', async () => {
    renderWithAuth(<AdminAuditPage />, {
      ...authState,
      user: {
        ...authState.user!,
        role: 'AUDITOR',
      },
    })

    expect(await screen.findByText('ASSISTANT SUMMARY')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept suggestion' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject suggestion' })).not.toBeInTheDocument()
  })
})
