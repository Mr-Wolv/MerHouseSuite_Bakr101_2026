import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { MerchantInventoryPage, MerchantOrdersPage, MerchantOverviewPage } from './MerchantPages'

const apiMock = vi.hoisted(() => ({
  inventoryItems: vi.fn(),
  orders: vi.fn(),
  merchantDashboard: vi.fn(),
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  merchantWarehouseRelationships: vi.fn(),
  merchantWarehouseWarehouseOptions: vi.fn(),
  inboundStockRequests: vi.fn(),
  merchantAuthorizedStock: vi.fn(),
  createMerchantWarehouseRelationship: vi.fn(),
  submitInboundStockRequest: vi.fn(),
  createInboundStockDraft: vi.fn(),
  submitInboundStockDraft: vi.fn(),
  cancelInboundStock: vi.fn(),
  createOrder: vi.fn(),
  createOrderImport: vi.fn(),
  orderImports: vi.fn(),
  allocateOrder: vi.fn(),
  cancelOrder: vi.fn(),
  customerContacts: vi.fn(),
  createCustomerContact: vi.fn(),
  fulfillmentExceptions: vi.fn(),
  resolveFulfillmentException: vi.fn(),
  updateBackorder: vi.fn(),
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
  token: 'merchant-token',
  loading: false,
  user: {
    id: 'merchant-user',
    tenantId: 'merchant-tenant',
    email: 'merchant@merhouse.local',
    role: 'MERCHANT',
    enabled: true,
    createdAt: '2026-05-17T00:00:00Z',
  },
  login: vi.fn(),
  logout: vi.fn(),
}

const items = [
  {
    id: 'item-1',
    merchantId: 'merchant-tenant',
    sku: 'SKU-1',
    name: 'Merchant Item',
    attributes: {},
    archived: false,
    createdAt: '2026-05-17T00:00:00Z',
  },
]

const orders = [
  {
    id: 'order-1',
    merchantId: 'merchant-tenant',
    customerAddress: 'Cairo Customer',
    status: 'CREATED',
    items: [{ id: 'order-item-1', inventoryItemId: 'item-1', sku: 'SKU-1', itemName: 'Merchant Item', quantity: 2 }],
    allocations: [],
    backorders: [],
    createdAt: '2026-05-17T00:00:00Z',
  },
]

const relationships = [{
  id: 'relationship-1',
  merchantId: 'merchant-tenant',
  merchantName: 'Merchant Tenant',
  warehouseProviderId: 'warehouse-tenant',
  warehouseProviderName: 'FedEx Cairo',
  status: 'ACTIVE',
  serviceNotes: 'Daily receiving',
  createdAt: '2026-05-17T00:00:00Z',
  approvedAt: '2026-05-17T00:01:00Z',
}]

const warehouseOptions = [{
  warehouseProviderId: 'warehouse-tenant',
  warehouseProviderName: 'FedEx Cairo',
  warehouseId: 'warehouse-1',
  warehouseName: 'Cairo Hub',
  address: 'Cairo',
  capacity: 100,
}]

const inboundRequests = [{
  id: 'inbound-1',
  relationshipId: 'relationship-1',
  merchantId: 'merchant-tenant',
  merchantName: 'Merchant Tenant',
  warehouseProviderId: 'warehouse-tenant',
  warehouseProviderName: 'FedEx Cairo',
  warehouseId: 'warehouse-1',
  warehouseName: 'Cairo Hub',
  inventoryItemId: 'item-1',
  sku: 'SKU-1',
  itemName: 'Merchant Item',
  requestedQuantity: 5,
  receivedQuantity: 0,
  damagedQuantity: 0,
  shortageQuantity: 5,
  status: 'SUBMITTED',
  merchantReference: 'ASN-1',
  merchantNote: 'Arrives Tuesday',
  receivingNote: null,
  rejectionReason: null,
  createdAt: '2026-05-17T00:00:00Z',
  updatedAt: '2026-05-17T00:00:00Z',
  receivedAt: null,
}]

const authorizedStock = [{
  relationshipId: 'relationship-1',
  merchantId: 'merchant-tenant',
  merchantName: 'Merchant Tenant',
  warehouseProviderId: 'warehouse-tenant',
  warehouseProviderName: 'FedEx Cairo',
  warehouseId: 'warehouse-1',
  warehouseName: 'Cairo Hub',
  inventoryItemId: 'item-1',
  sku: 'SKU-1',
  itemName: 'Merchant Item',
  quantity: 10,
  reservedQuantity: 2,
  availableQuantity: 8,
  inboundQuantity: 5,
}]

function renderWithAuth(element: ReactNode) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authState}>{element}</AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('Merchant overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.inventoryItems.mockResolvedValue(items)
    apiMock.orders.mockResolvedValue(orders)
    apiMock.merchantDashboard.mockResolvedValue({
      orders: 1,
      openBackorders: 0,
      deliveredShipments: 0,
      inboundOpen: 0,
      stockRisk: 0,
      openExceptions: 0,
    })
  })

  it('renders merchant metrics and recent orders', async () => {
    renderWithAuth(<MerchantOverviewPage />)

    expect(await screen.findByText('Merchant Overview')).toBeInTheDocument()
    expect(screen.getByLabelText('Start with risk')).toHaveTextContent('Open Orders when risk rises')
    expect(screen.getByText('Inventory items')).toBeInTheDocument()
    expect(screen.getByText('SKU-1 x2')).toBeInTheDocument()
  })
})

describe('Merchant inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.inventoryItems.mockResolvedValue(items)
    apiMock.updateInventoryItem.mockResolvedValue(items[0])
    apiMock.merchantWarehouseRelationships.mockResolvedValue(relationships)
    apiMock.merchantWarehouseWarehouseOptions.mockResolvedValue(warehouseOptions)
    apiMock.inboundStockRequests.mockResolvedValue(inboundRequests)
    apiMock.merchantAuthorizedStock.mockResolvedValue(authorizedStock)
    apiMock.createInventoryItem.mockResolvedValue({
      id: 'item-2',
      merchantId: 'merchant-tenant',
      sku: 'SKU-2',
      name: 'New Merchant Item',
      attributes: { source: 'merchant-console' },
      archived: false,
      createdAt: '2026-05-17T00:01:00Z',
    })
  })

  it('creates an inventory item for the current merchant tenant', async () => {
    const user = userEvent.setup()
    renderWithAuth(<MerchantInventoryPage />)

    const form = await screen.findByRole('form', { name: 'Create inventory item form' })
    expect(screen.getByLabelText('Inventory and inbound readiness')).toHaveTextContent('setup path')
    expect(screen.getByLabelText('Merchant setup path')).toHaveTextContent('4/4 ready')
    expect(screen.getByText('Setup workflow')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Create and connect' })).toBeInTheDocument()
    expect(screen.getByText('Work top to bottom: create the SKU, request warehouse service, then send stock only after the relationship is active.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Review stock and history' })).toBeInTheDocument()
    await user.type(within(form).getByLabelText('SKU'), 'SKU-2')
    await user.type(within(form).getByLabelText('Name'), 'New Merchant Item')
    await user.click(within(form).getByRole('button', { name: 'Create item' }))

    expect(apiMock.createInventoryItem).toHaveBeenCalledWith('merchant-token', {
      merchantId: 'merchant-tenant',
      sku: 'SKU-2',
      name: 'New Merchant Item',
      attributes: { source: 'merchant-console' },
    })
    expect(await screen.findByText('New Merchant Item')).toBeInTheDocument()
  })

  it('shows backend errors when inventory creation fails', async () => {
    const user = userEvent.setup()
    apiMock.createInventoryItem.mockRejectedValue(new ApiError(409, 'Conflict', ['SKU already exists']))
    renderWithAuth(<MerchantInventoryPage />)

    const form = await screen.findByRole('form', { name: 'Create inventory item form' })
    await user.type(within(form).getByLabelText('SKU'), 'SKU-2')
    await user.type(within(form).getByLabelText('Name'), 'New Merchant Item')
    await user.click(within(form).getByRole('button', { name: 'Create item' }))

    expect(await screen.findByText('SKU already exists')).toBeInTheDocument()
  })

  it('requests warehouse service and submits inbound stock', async () => {
    const user = userEvent.setup()
    apiMock.createMerchantWarehouseRelationship.mockResolvedValue({
      ...relationships[0],
      id: 'relationship-2',
      status: 'REQUESTED',
      serviceNotes: 'Fragile handling',
      approvedAt: null,
    })
    apiMock.submitInboundStockRequest.mockResolvedValue({
      ...inboundRequests[0],
      id: 'inbound-2',
      merchantReference: 'ASN-2',
      requestedQuantity: 3,
    })
    apiMock.createInboundStockDraft.mockResolvedValue({
      ...inboundRequests[0],
      id: 'inbound-draft',
      status: 'DRAFT',
      merchantReference: 'ASN-DRAFT',
      requestedQuantity: 4,
    })
    apiMock.submitInboundStockDraft.mockResolvedValue({
      ...inboundRequests[0],
      id: 'inbound-draft',
      status: 'SUBMITTED',
      merchantReference: 'ASN-DRAFT',
      requestedQuantity: 4,
    })
    apiMock.cancelInboundStock.mockResolvedValue({
      ...inboundRequests[0],
      id: 'inbound-draft',
      status: 'CANCELLED',
      merchantReference: 'ASN-DRAFT',
      requestedQuantity: 4,
    })
    renderWithAuth(<MerchantInventoryPage />)

    const relationshipForm = await screen.findByRole('form', { name: 'Request warehouse service form' })
    await user.type(within(relationshipForm).getByLabelText('Service notes'), 'Fragile handling')
    await user.click(within(relationshipForm).getByRole('button', { name: 'Request service' }))

    expect(apiMock.createMerchantWarehouseRelationship).toHaveBeenCalledWith('merchant-token', {
      merchantId: 'merchant-tenant',
      warehouseProviderId: 'warehouse-tenant',
      serviceNotes: 'Fragile handling',
    })
    expect(await screen.findByText('Fragile handling')).toBeInTheDocument()

    const inboundForm = screen.getByRole('form', { name: 'Submit inbound stock form' })
    await user.clear(within(inboundForm).getByLabelText('Quantity'))
    await user.type(within(inboundForm).getByLabelText('Quantity'), '3')
    await user.type(within(inboundForm).getByLabelText('Reference'), 'ASN-2')
    await user.click(within(inboundForm).getByRole('button', { name: 'Submit inbound' }))

    expect(apiMock.submitInboundStockRequest).toHaveBeenCalledWith('merchant-token', {
      relationshipId: 'relationship-1',
      warehouseId: 'warehouse-1',
      inventoryItemId: 'item-1',
      requestedQuantity: 3,
      merchantReference: 'ASN-2',
      merchantNote: '',
    })
    expect(await screen.findByText('ASN-2')).toBeInTheDocument()

    await user.clear(within(inboundForm).getByLabelText('Quantity'))
    await user.type(within(inboundForm).getByLabelText('Quantity'), '4')
    await user.clear(within(inboundForm).getByLabelText('Reference'))
    await user.type(within(inboundForm).getByLabelText('Reference'), 'ASN-DRAFT')
    await user.click(within(inboundForm).getByRole('button', { name: 'Save draft' }))

    expect(apiMock.createInboundStockDraft).toHaveBeenCalledWith('merchant-token', {
      relationshipId: 'relationship-1',
      warehouseId: 'warehouse-1',
      inventoryItemId: 'item-1',
      requestedQuantity: 4,
      merchantReference: 'ASN-DRAFT',
      merchantNote: '',
    })
    const draftRow = await screen.findByRole('row', { name: /ASN-DRAFT Cairo Hub SKU-1 4 0 0 DRAFT/i })
    await user.click(within(draftRow).getByRole('button', { name: 'Submit draft' }))
    expect(apiMock.submitInboundStockDraft).toHaveBeenCalledWith('merchant-token', 'inbound-draft')
    expect(await within(draftRow).findByText('SUBMITTED')).toBeInTheDocument()
    expect(within(draftRow).queryByRole('button', { name: 'Submit draft' })).not.toBeInTheDocument()
    expect(within(draftRow).getByRole('button', { name: 'Cancel inbound' })).toBeEnabled()
    await user.click(within(draftRow).getByRole('button', { name: 'Cancel inbound' }))
    expect(apiMock.cancelInboundStock).toHaveBeenCalledWith('merchant-token', 'inbound-draft')
    expect(await within(draftRow).findByText('Cancelled')).toHaveClass('data-chip')
    expect(within(draftRow).queryByRole('button', { name: 'Cancel inbound' })).not.toBeInTheDocument()
  }, 10_000)

  it('shows settled inbound states as history chips instead of disabled controls', async () => {
    apiMock.inboundStockRequests.mockResolvedValue([
      {
        ...inboundRequests[0],
        id: 'inbound-received',
        merchantReference: 'ASN-RECEIVED',
        status: 'RECEIVED',
        receivedQuantity: 5,
        shortageQuantity: 0,
        receivedAt: '2026-05-17T00:10:00Z',
      },
      {
        ...inboundRequests[0],
        id: 'inbound-cancelled',
        merchantReference: 'ASN-CANCELLED',
        status: 'CANCELLED',
      },
    ])

    renderWithAuth(<MerchantInventoryPage />)

    const receivedRow = await screen.findByRole('row', { name: /ASN-RECEIVED/i })
    expect(within(receivedRow).getByText('Received by warehouse')).toHaveClass('data-chip')
    expect(within(receivedRow).queryByRole('button')).not.toBeInTheDocument()

    const cancelledRow = screen.getByRole('row', { name: /ASN-CANCELLED/i })
    expect(within(cancelledRow).getByText('Cancelled')).toHaveClass('data-chip')
    expect(within(cancelledRow).queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps inbound warehouse choices inside the selected relationship provider', async () => {
    const user = userEvent.setup()
    apiMock.merchantWarehouseRelationships.mockResolvedValue([
      ...relationships,
      {
        ...relationships[0],
        id: 'relationship-2',
        warehouseProviderId: 'warehouse-tenant-2',
        warehouseProviderName: 'Giza Fulfillment',
      },
    ])
    apiMock.merchantWarehouseWarehouseOptions.mockResolvedValue([
      ...warehouseOptions,
      {
        warehouseProviderId: 'warehouse-tenant-2',
        warehouseProviderName: 'Giza Fulfillment',
        warehouseId: 'warehouse-2',
        warehouseName: 'Giza Hub',
        address: 'Giza',
        capacity: 80,
      },
    ])
    apiMock.submitInboundStockRequest.mockResolvedValue({
      ...inboundRequests[0],
      id: 'inbound-giza',
      relationshipId: 'relationship-2',
      warehouseProviderId: 'warehouse-tenant-2',
      warehouseProviderName: 'Giza Fulfillment',
      warehouseId: 'warehouse-2',
      warehouseName: 'Giza Hub',
      merchantReference: 'ASN-GIZA',
    })
    renderWithAuth(<MerchantInventoryPage />)

    const inboundForm = await screen.findByRole('form', { name: 'Submit inbound stock form' })
    await user.selectOptions(within(inboundForm).getByLabelText('Relationship'), 'relationship-2')

    expect(within(inboundForm).getByLabelText('Target warehouse')).toHaveValue('warehouse-2')
    expect(within(inboundForm).queryByRole('option', { name: 'Cairo Hub' })).not.toBeInTheDocument()
    expect(screen.getByText('Ready to send stock to the selected warehouse.')).toBeInTheDocument()

    await user.clear(within(inboundForm).getByLabelText('Quantity'))
    await user.type(within(inboundForm).getByLabelText('Quantity'), '2')
    await user.type(within(inboundForm).getByLabelText('Reference'), 'ASN-GIZA')
    await user.click(within(inboundForm).getByRole('button', { name: 'Submit inbound' }))

    expect(apiMock.submitInboundStockRequest).toHaveBeenCalledWith('merchant-token', {
      relationshipId: 'relationship-2',
      warehouseId: 'warehouse-2',
      inventoryItemId: 'item-1',
      requestedQuantity: 2,
      merchantReference: 'ASN-GIZA',
      merchantNote: '',
    })
  })

  it('shows authorized warehouse stock by provider and warehouse', async () => {
    renderWithAuth(<MerchantInventoryPage />)

    expect(await screen.findByText('Authorized Warehouse Stock')).toBeInTheDocument()
    const stockRow = screen.getByRole('row', { name: /FedEx Cairo Cairo Hub SKU-1 - Merchant Item 8 2 5/i })
    expect(stockRow).toBeInTheDocument()
  })
})

describe('Merchant orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.inventoryItems.mockResolvedValue(items)
    apiMock.orders.mockResolvedValue(orders)
    apiMock.merchantDashboard.mockResolvedValue({
      orders: 1,
      openBackorders: 0,
      deliveredShipments: 0,
      inboundOpen: 0,
      stockRisk: 0,
      openExceptions: 0,
    })
    apiMock.customerContacts.mockResolvedValue([])
    apiMock.fulfillmentExceptions.mockResolvedValue([])
    apiMock.orderImports.mockResolvedValue([])
    apiMock.createOrder.mockResolvedValue({
      id: 'order-2',
      merchantId: 'merchant-tenant',
      customerAddress: 'Giza Customer',
      status: 'CREATED',
      items: [{ id: 'order-item-2', inventoryItemId: 'item-1', sku: 'SKU-1', itemName: 'Merchant Item', quantity: 3 }],
      allocations: [],
      backorders: [],
      createdAt: '2026-05-17T00:01:00Z',
    })
    apiMock.allocateOrder.mockResolvedValue({
      ...orders[0],
      status: 'BACKORDERED',
      backorders: [{
        id: 'backorder-1',
        inventoryItemId: 'item-1',
        sku: 'SKU-1',
        itemName: 'Merchant Item',
        quantity: 2,
        status: 'OPEN',
        createdAt: '2026-05-17T00:02:00Z',
      }],
    })
    apiMock.cancelOrder.mockResolvedValue({
      ...orders[0],
      status: 'CANCELLED',
    })
    apiMock.createOrderImport.mockResolvedValue({
      id: 'import-1',
      merchantId: 'merchant-tenant',
      mode: 'PARTIAL_ACCEPT',
      status: 'PARTIAL_ACCEPTED',
      sourceLabel: 'Merchant pasted order rows',
      uploadedBy: 'merchant@merhouse.local',
      totalRows: 2,
      createdRows: 1,
      rejectedRows: 1,
      createdAt: '2026-05-17T00:05:00Z',
      rows: [
        {
          id: 'import-row-1',
          rowNumber: 1,
          status: 'CREATED',
          merchantOrderReference: 'merchant-paste-1',
          sku: 'SKU-1',
          quantity: 2,
          customerAddress: 'Giza Customer',
          customerName: null,
          customerPhone: null,
          createdOrderId: 'order-2',
          failureReason: null,
        },
        {
          id: 'import-row-2',
          rowNumber: 2,
          status: 'REJECTED',
          merchantOrderReference: 'merchant-paste-2',
          sku: 'UNKNOWN',
          quantity: 1,
          customerAddress: 'Bad Customer',
          customerName: null,
          customerPhone: null,
          createdOrderId: null,
          failureReason: 'Unknown SKU for this merchant.',
        },
      ],
    })
  })

  it('creates an order for the current merchant tenant', async () => {
    const user = userEvent.setup()
    renderWithAuth(<MerchantOrdersPage />)

    const form = await screen.findByRole('form', { name: 'Create order form' })
    expect(screen.getByLabelText('Order queue controls')).toHaveTextContent('Add the customer order')
    expect(screen.getByText('Order setup')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Create customer demand' })).toBeInTheDocument()
    expect(screen.getByText('Start with one customer order or build draft lines when a shipment needs multiple SKUs.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Audit imported rows' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Allocate, resolve, and follow shipments' })).toBeInTheDocument()
    await user.type(within(form).getByLabelText('Customer address'), 'Giza Customer')
    await user.clear(within(form).getByLabelText('Quantity'))
    await user.type(within(form).getByLabelText('Quantity'), '3')
    await user.click(within(form).getByRole('button', { name: 'Create order' }))

    expect(apiMock.createOrder).toHaveBeenCalledWith('merchant-token', {
      merchantId: 'merchant-tenant',
      customerAddress: 'Giza Customer',
      items: [{ inventoryItemId: 'item-1', quantity: 3 }],
    })
    expect(await screen.findByText('SKU-1 x3')).toBeInTheDocument()
  })

  it('allocates and cancels orders from the queue', async () => {
    const user = userEvent.setup()
    renderWithAuth(<MerchantOrdersPage />)

    const card = await screen.findByLabelText(/Order order-1 CREATED SKU-1 x2/i)
    await user.click(within(card).getByRole('button', { name: 'Allocate' }))

    expect(apiMock.allocateOrder).toHaveBeenCalledWith('merchant-token', 'order-1')
    expect(await within(card).findByText('BACKORDERED')).toBeInTheDocument()
    expect(await within(card).findAllByText('SKU-1 x2')).toHaveLength(2)

    await user.click(within(card).getByRole('button', { name: 'Cancel' }))
    expect(apiMock.cancelOrder).toHaveBeenCalledWith('merchant-token', 'order-1')
    expect(await within(card).findByText('CANCELLED')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Allocate' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(within(card).getByText('No order actions available')).toBeInTheDocument()
  })

  it('shows the status of each backorder in the order queue', async () => {
    apiMock.orders.mockResolvedValue([{
      ...orders[0],
      status: 'BACKORDERED',
      backorders: [
        {
          id: 'backorder-open',
          inventoryItemId: 'item-1',
          sku: 'SKU-1',
          itemName: 'Merchant Item',
          quantity: 2,
          status: 'OPEN',
          createdAt: '2026-05-17T00:02:00Z',
        },
        {
          id: 'backorder-fulfilled',
          inventoryItemId: 'item-1',
          sku: 'SKU-1',
          itemName: 'Merchant Item',
          quantity: 1,
          status: 'FULFILLED',
          createdAt: '2026-05-17T00:03:00Z',
        },
        {
          id: 'backorder-cancelled',
          inventoryItemId: 'item-1',
          sku: 'SKU-1',
          itemName: 'Merchant Item',
          quantity: 3,
          status: 'CANCELLED',
          createdAt: '2026-05-17T00:04:00Z',
        },
      ],
    }])

    renderWithAuth(<MerchantOrdersPage />)

    const card = await screen.findByLabelText(/Order order-1 BACKORDERED SKU-1 x2/i)
    expect(within(card).getByText('OPEN')).toBeInTheDocument()
    expect(within(card).getByText('FULFILLED')).toBeInTheDocument()
    expect(within(card).getByText('CANCELLED')).toBeInTheDocument()
  })

  it('submits pasted order rows through the audited import API', async () => {
    const user = userEvent.setup()
    renderWithAuth(<MerchantOrdersPage />)

    await screen.findByRole('heading', { name: 'Audited Order Import' })
    await user.type(screen.getByLabelText('Rows'), 'Giza Customer,SKU-1,2\nBad Customer,UNKNOWN,1')
    await user.click(screen.getByRole('button', { name: 'Submit import batch' }))

    expect(apiMock.createOrderImport).toHaveBeenCalledWith('merchant-token', {
      merchantId: 'merchant-tenant',
      mode: 'PARTIAL_ACCEPT',
      sourceLabel: 'Merchant pasted order rows',
      rows: expect.arrayContaining([
        expect.objectContaining({
          sku: 'SKU-1',
          quantity: 2,
          customerAddress: 'Giza Customer',
        }),
        expect.objectContaining({
          sku: 'UNKNOWN',
          quantity: 1,
          customerAddress: 'Bad Customer',
        }),
      ]),
    })
    expect(await screen.findByText('PARTIAL ACCEPTED')).toBeInTheDocument()
    expect(screen.getByText('Unknown SKU for this merchant.')).toBeInTheDocument()
  })

  it('shows resolved fulfillment exceptions as state instead of disabled action buttons', async () => {
    apiMock.fulfillmentExceptions.mockResolvedValue([
      {
        id: 'exception-resolved',
        allocationId: 'allocation-1',
        orderId: 'order-1',
        merchantId: 'merchant-tenant',
        merchantName: 'Merchant Tenant',
        warehouseProviderId: 'warehouse-tenant',
        warehouseProviderName: 'FedEx Cairo',
        reasonCode: 'SHORT_PICK',
        description: 'Short pick was already reviewed.',
        resolutionNote: 'Merchant accepted split shipment.',
        status: 'RESOLVED',
        createdAt: '2026-05-17T00:00:00Z',
        resolvedAt: '2026-05-17T00:05:00Z',
      },
    ])

    renderWithAuth(<MerchantOrdersPage />)

    const row = await screen.findByRole('row', { name: /Short pick was already reviewed/i })
    expect(within(row).getByText('Resolved')).toHaveClass('data-chip')
    expect(within(row).queryByRole('button', { name: 'Resolved' })).not.toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Resolve and notify-ready' })).not.toBeInTheDocument()
  })

  it('disables order creation when no inventory items exist', async () => {
    apiMock.inventoryItems.mockResolvedValue([])
    apiMock.orders.mockResolvedValue([])
    renderWithAuth(<MerchantOrdersPage />)

    const form = await screen.findByRole('form', { name: 'Create order form' })

    expect(within(form).getByText('Create a stock item before creating an order.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Create order' })).toBeDisabled()
  })

  it('shows backend errors when allocation fails', async () => {
    const user = userEvent.setup()
    apiMock.allocateOrder.mockRejectedValue(new ApiError(409, 'Conflict', ['Only CREATED orders can be allocated.']))
    renderWithAuth(<MerchantOrdersPage />)

    const card = await screen.findByLabelText(/Order order-1 CREATED SKU-1 x2/i)
    await user.click(within(card).getByRole('button', { name: 'Allocate' }))

    expect(await screen.findByText('Only CREATED orders can be allocated.')).toBeInTheDocument()
  })
})
