import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import {
  FulfillmentAllocationDetailPage,
  InboundStockRequestDetailPage,
  InventoryItemDetailPage,
  MerchantWarehouseRelationshipDetailPage,
  OrderDetailPage,
  ShipmentDetailPage,
  TimelinePanel,
} from './OperationalDetailPages'

const apiMock = vi.hoisted(() => ({
  orderDetail: vi.fn(),
  inventoryItemDetail: vi.fn(),
  inboundStockRequestDetail: vi.fn(),
  shipmentDetail: vi.fn(),
  fulfillmentAllocationDetail: vi.fn(),
  merchantWarehouseRelationshipDetail: vi.fn(),
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

function renderWithRoute(
  element: ReactNode,
  path = '/orders/order-1',
  route = '/orders/:orderId',
  state = authState,
) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={state}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('TimelinePanel', () => {
  it('renders an empty timeline state', () => {
    render(<TimelinePanel events={[]} />)

    expect(screen.getByText('No lifecycle events recorded yet')).toBeInTheDocument()
  })
})

describe('OrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.orderDetail.mockResolvedValue({
      order: {
        id: 'order-1',
        merchantId: 'merchant-tenant',
        customerAddress: 'Cairo Customer',
        status: 'ALLOCATED',
        items: [{ id: 'order-item-1', inventoryItemId: 'item-1', sku: 'SKU-1', itemName: 'Merchant Item', quantity: 2 }],
        allocations: [{
          id: 'allocation-1',
          warehouseId: 'warehouse-1',
          warehouseName: 'FedEx Cairo',
          status: 'PENDING',
          createdAt: '2026-05-17T00:00:00Z',
        }],
        backorders: [],
        createdAt: '2026-05-17T00:00:00Z',
      },
      shipments: [],
      carrierDispatches: [],
      outboxEvents: [],
      timeline: [{
        sourceId: 'order-1',
        sourceType: 'CustomerOrder',
        eventType: 'OrderCreated',
        label: 'Order created',
        detail: 'Merchant order for Cairo Customer',
        occurredAt: '2026-05-17T00:00:00Z',
      }],
    })
  })

  it('loads a role-scoped order detail timeline and linked allocation', async () => {
    renderWithRoute(<OrderDetailPage />)

    expect(await screen.findByText('Order Detail')).toBeInTheDocument()
    expect(screen.getByLabelText('Order lifecycle review')).toHaveTextContent('outbox evidence')
    expect(screen.getByText('Order created')).toBeInTheDocument()
    expect(screen.getByText('1 events')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Allocation allocati/i })).toHaveAttribute('href', '/fulfillment-allocations/allocation-1')
    expect(apiMock.orderDetail).toHaveBeenCalledWith('merchant-token', 'order-1')
  })

  it('renders role-aware order recovery for warehouse users', async () => {
    apiMock.orderDetail.mockRejectedValue(new ApiError(403, 'Forbidden', ['You cannot access this order.']))

    renderWithRoute(<OrderDetailPage />, '/orders/order-1', '/orders/:orderId', {
      ...authState,
      user: {
        ...authState.user!,
        role: 'WAREHOUSE_OPERATOR',
      },
    })

    expect(await screen.findByRole('heading', { name: 'You cannot access this order.' })).toBeInTheDocument()
    expect(screen.getByText(/no longer visible to this role/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Warehouse' })).toHaveAttribute('href', '/warehouse')
  })
})

describe('InventoryItemDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.inventoryItemDetail.mockResolvedValue({
      item: {
        id: 'item-1',
        merchantId: 'merchant-tenant',
        sku: 'SKU-1',
        name: 'Merchant Item',
        attributes: { source: 'merchant-console' },
        archived: false,
        createdAt: '2026-05-17T00:00:00Z',
      },
      auditLogs: [{
        id: 'audit-1',
        warehouseId: 'warehouse-1',
        inventoryItemId: 'item-1',
        action: 'RECEIVED',
        beforeQuantity: 0,
        afterQuantity: 5,
        beforeReservedQuantity: 0,
        afterReservedQuantity: 1,
        reasonCode: 'INBOUND_RECEIVED',
        reasonNote: 'Inbound received at Cairo Hub',
        actorUserId: 'operator-1',
        occurredAt: '2026-05-17T00:10:00Z',
      }],
      inboundRequests: [{
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
        receivedQuantity: 5,
        damagedQuantity: 0,
        shortageQuantity: 0,
        status: 'RECEIVED',
        merchantReference: 'ASN-1',
        merchantNote: 'Arrives Tuesday',
        receivingNote: 'Received cleanly',
        rejectionReason: null,
        createdAt: '2026-05-17T00:00:00Z',
        updatedAt: '2026-05-17T00:10:00Z',
        receivedAt: '2026-05-17T00:10:00Z',
      }],
      timeline: [{
        sourceId: 'audit-1',
        sourceType: 'InventoryAuditLog',
        eventType: 'RECEIVED',
        label: 'Stock received',
        detail: 'Inbound received at Cairo Hub',
        occurredAt: '2026-05-17T00:10:00Z',
      }],
    })
  })

  it('loads inventory evidence with guidance, linked inbound, and stock change chips', async () => {
    renderWithRoute(<InventoryItemDetailPage />, '/inventory/items/item-1', '/inventory/items/:inventoryItemId')

    expect(await screen.findByText('Inventory Item Detail')).toBeInTheDocument()
    expect(screen.getByLabelText('Inventory evidence review')).toHaveTextContent('stock changes have visible operational evidence')
    expect(screen.getByRole('link', { name: /Inbound ASN-1/i })).toHaveAttribute('href', '/inbound-stock-requests/inbound-1')
    expect(screen.getByText('INBOUND_RECEIVED: Inbound received at Cairo Hub')).toBeInTheDocument()
    expect(screen.getAllByText('reserved 0')).toHaveLength(1)
    expect(screen.getAllByText('reserved 1')).toHaveLength(1)
    expect(apiMock.inventoryItemDetail).toHaveBeenCalledWith('merchant-token', 'item-1')
  })

  it('renders recoverable inventory not-found guidance', async () => {
    apiMock.inventoryItemDetail.mockRejectedValue(new ApiError(404, 'Not found', ['Inventory item not found: missing-item']))

    renderWithRoute(<InventoryItemDetailPage />, '/inventory/items/missing-item', '/inventory/items/:inventoryItemId')

    expect(await screen.findByRole('heading', { name: 'Inventory item not found: missing-item' })).toBeInTheDocument()
    expect(screen.getByText(/role-appropriate workspace/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Stock' })).toHaveAttribute('href', '/merchant/inventory')
  })

  it('renders platform-safe inventory recovery for auditor users', async () => {
    apiMock.inventoryItemDetail.mockRejectedValue(new ApiError(403, 'Forbidden', ['Inventory access denied']))

    renderWithRoute(
      <InventoryItemDetailPage />,
      '/inventory/items/denied',
      '/inventory/items/:inventoryItemId',
      {
        ...authState,
        user: {
          ...authState.user!,
          role: 'AUDITOR',
        },
      },
    )

    expect(await screen.findByRole('heading', { name: 'Inventory access denied' })).toBeInTheDocument()
    expect(screen.getByText(/role-appropriate workspace/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Relationships' })).toHaveAttribute('href', '/admin/relationships')
  })
})

const inboundFixture = {
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
  requestedQuantity: 10,
  receivedQuantity: 7,
  damagedQuantity: 1,
  shortageQuantity: 2,
  status: 'RECEIVING',
  merchantReference: 'ASN-1',
  merchantNote: 'Arrives Tuesday',
  receivingNote: 'Seven accepted, one damaged.',
  rejectionReason: null,
  createdAt: '2026-05-17T00:00:00Z',
  updatedAt: '2026-05-17T00:10:00Z',
  receivedAt: null,
}

const relationshipFixture = {
  id: 'relationship-1',
  merchantId: 'merchant-tenant',
  merchantName: 'Merchant Tenant',
  warehouseProviderId: 'warehouse-tenant',
  warehouseProviderName: 'FedEx Cairo',
  status: 'ACTIVE',
  serviceNotes: 'Daily receiving',
  createdAt: '2026-05-17T00:00:00Z',
  approvedAt: '2026-05-17T00:01:00Z',
}

const allocationFixture = {
  id: 'allocation-1',
  orderId: 'order-1',
  customerAddress: 'Cairo Customer',
  merchantId: 'merchant-tenant',
  merchantName: 'Merchant Tenant',
  merchantWarehouseRelationshipId: 'relationship-1',
  serviceRelationshipStatus: 'ACTIVE',
  warehouseId: 'warehouse-1',
  warehouseName: 'Cairo Hub',
  status: 'PACKED',
  assignedUserId: null,
  assignedUserEmail: null,
  priority: 1,
  scanCode: null,
  pickSheetPrintedAt: null,
  items: [{ inventoryItemId: 'item-1', sku: 'SKU-1', itemName: 'Merchant Item', quantity: 2 }],
  shipment: null,
  createdAt: '2026-05-17T00:00:00Z',
}

const orderFixture = {
  id: 'order-1',
  merchantId: 'merchant-tenant',
  customerAddress: 'Cairo Customer',
  status: 'ALLOCATED',
  items: [{ id: 'order-item-1', inventoryItemId: 'item-1', sku: 'SKU-1', itemName: 'Merchant Item', quantity: 2 }],
  allocations: [{
    id: 'allocation-1',
    warehouseId: 'warehouse-1',
    warehouseName: 'Cairo Hub',
    status: 'PACKED',
    createdAt: '2026-05-17T00:00:00Z',
  }],
  backorders: [],
  createdAt: '2026-05-17T00:00:00Z',
}

const shipmentFixture = {
  id: 'shipment-1',
  allocationId: 'allocation-1',
  orderId: 'order-1',
  warehouseId: 'warehouse-1',
  carrier: 'FedEx',
  trackingNumber: 'TRACK-1',
  packageCount: 1,
  packageWeightKg: 2,
  packageLengthCm: 40,
  packageWidthCm: 30,
  packageHeightCm: 20,
  packingNote: 'Packed with edge protectors.',
  status: 'IN_TRANSIT',
  packages: [{
    id: 'package-1',
    packageNumber: 1,
    labelCode: 'PKG-1',
    weightKg: 2,
    lengthCm: 40,
    widthCm: 30,
    heightCm: 20,
    status: 'LABELLED',
    events: [{
      id: 'event-1',
      eventType: 'LABEL_CREATED',
      note: 'Label created at packing bench',
      occurredAt: '2026-05-17T00:05:00Z',
    }],
    createdAt: '2026-05-17T00:05:00Z',
  }],
  metadata: { source: 'warehouse-console' },
  createdAt: '2026-05-17T00:05:00Z',
}

describe('Warehouse operational detail pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.inboundStockRequestDetail.mockResolvedValue({
      inboundStockRequest: inboundFixture,
      relationship: relationshipFixture,
      auditLogs: [{
        id: 'audit-1',
        warehouseId: 'warehouse-1',
        inventoryItemId: 'item-1',
        action: 'RECEIVED',
        beforeQuantity: 0,
        afterQuantity: 7,
        beforeReservedQuantity: 0,
        afterReservedQuantity: 0,
        reasonCode: 'INBOUND_RECEIVED',
        reasonNote: 'Partial receiving pass',
        actorUserId: 'operator-1',
        occurredAt: '2026-05-17T00:10:00Z',
      }],
      outboxEvents: [],
      timeline: [{
        sourceId: 'inbound-1',
        sourceType: 'InboundStockRequest',
        eventType: 'RECEIVING',
        label: 'Receiving started',
        detail: 'Warehouse started receiving ASN-1',
        occurredAt: '2026-05-17T00:10:00Z',
      }],
    })
    apiMock.shipmentDetail.mockResolvedValue({
      shipment: shipmentFixture,
      allocation: allocationFixture,
      order: orderFixture,
      carrierDispatches: [],
      outboxEvents: [],
      timeline: [{
        sourceId: 'shipment-1',
        sourceType: 'Shipment',
        eventType: 'IN_TRANSIT',
        label: 'Shipment created',
        detail: 'Shipment evidence recorded',
        occurredAt: '2026-05-17T00:05:00Z',
      }],
    })
    apiMock.fulfillmentAllocationDetail.mockResolvedValue({
      allocation: allocationFixture,
      order: orderFixture,
      shipments: [shipmentFixture],
      carrierDispatches: [],
      outboxEvents: [],
      timeline: [{
        sourceId: 'allocation-1',
        sourceType: 'FulfillmentAllocation',
        eventType: 'PACKED',
        label: 'Allocation packed',
        detail: 'Warehouse packed allocation',
        occurredAt: '2026-05-17T00:04:00Z',
      }],
    })
    apiMock.merchantWarehouseRelationshipDetail.mockResolvedValue({
      relationship: {
        ...relationshipFixture,
        statusReason: null,
        suspendedAt: null,
        endedAt: null,
      },
      inboundStockRequests: [inboundFixture],
      allocations: [{
        ...allocationFixture,
        scanCode: 'SCAN-1',
        pickSheetPrintedAt: '2026-05-17T00:03:00Z',
      }],
      outboxEvents: [{
        id: 'outbox-1',
        aggregateType: 'MerchantWarehouseRelationship',
        aggregateId: 'relationship-1',
        eventType: 'RELATIONSHIP_ACTIVATED',
        payload: {},
        status: 'PROCESSED',
        attempts: 1,
        nextAttemptAt: null,
        processedAt: '2026-05-17T00:02:00Z',
        deadLetterReason: null,
        createdAt: '2026-05-17T00:00:00Z',
      }],
      timeline: [{
        sourceId: 'relationship-1',
        sourceType: 'MerchantWarehouseRelationship',
        eventType: 'ACTIVE',
        label: 'Relationship activated',
        detail: 'Warehouse accepted daily receiving terms',
        occurredAt: '2026-05-17T00:02:00Z',
      }],
    })
  })

  it('loads inbound receiving evidence with quantity chips and audit context', async () => {
    renderWithRoute(<InboundStockRequestDetailPage />, '/inbound-stock-requests/inbound-1', '/inbound-stock-requests/:inboundStockRequestId')

    expect(await screen.findByText('Inbound Stock Detail')).toBeInTheDocument()
    expect(screen.getByLabelText('Inbound receiving evidence')).toHaveTextContent('damaged, and shortage counts')
    expect(screen.getByText('Seven accepted, one damaged.')).toHaveClass('note-cell')
    expect(screen.getByText('INBOUND_RECEIVED: Partial receiving pass')).toBeInTheDocument()
    expect(screen.getAllByText('10').some((node) => node.classList.contains('quantity-pending'))).toBe(true)
    expect(screen.getAllByText('2').some((node) => node.classList.contains('quantity-risk'))).toBe(true)
    expect(apiMock.inboundStockRequestDetail).toHaveBeenCalledWith('merchant-token', 'inbound-1')
  })

  it('loads shipment handoff evidence with package records', async () => {
    renderWithRoute(<ShipmentDetailPage />, '/shipments/shipment-1', '/shipments/:shipmentId')

    expect(await screen.findByText('Shipment Detail')).toBeInTheDocument()
    expect(screen.getByLabelText('Shipment handoff review')).toHaveTextContent('package measurements')
    expect(screen.getByText('Package Evidence')).toBeInTheDocument()
    expect(screen.getByText('PKG-1')).toBeInTheDocument()
    expect(screen.getByText('Label created at packing bench')).toHaveClass('note-cell')
    expect(screen.getByText('Packed with edge protectors.')).toHaveClass('note-cell')
    expect(apiMock.shipmentDetail).toHaveBeenCalledWith('merchant-token', 'shipment-1')
  })

  it('loads allocation pick evidence with scan and pick-sheet cues', async () => {
    renderWithRoute(<FulfillmentAllocationDetailPage />, '/fulfillment-allocations/allocation-1', '/fulfillment-allocations/:allocationId')

    expect(await screen.findByText('Allocation Detail')).toBeInTheDocument()
    expect(screen.getByLabelText('Allocation pick and ship review')).toHaveTextContent('scan code')
    expect(screen.getByText('Scan pending')).toHaveClass('data-chip', 'warning-chip')
    expect(screen.getByText('Pick sheet needed')).toHaveClass('data-chip', 'warning-chip')
    expect(screen.getByRole('link', { name: /Shipment shipment/i })).toHaveAttribute('href', '/shipments/shipment-1')
    expect(apiMock.fulfillmentAllocationDetail).toHaveBeenCalledWith('merchant-token', 'allocation-1')
  })

  it('renders merchant shipment recovery without warehouse-only guidance', async () => {
    apiMock.shipmentDetail.mockRejectedValue(new ApiError(404, 'Not found', ['Shipment not found: missing']))

    renderWithRoute(<ShipmentDetailPage />, '/shipments/missing', '/shipments/:shipmentId')

    expect(await screen.findByRole('heading', { name: 'Shipment not found: missing' })).toBeInTheDocument()
    expect(screen.getByText(/role-appropriate workspace/i)).toBeInTheDocument()
    expect(screen.queryByText(/Return to Warehouse/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Merchant' })).toHaveAttribute('href', '/merchant')
  })

  it('renders platform allocation recovery without warehouse-only guidance', async () => {
    apiMock.fulfillmentAllocationDetail.mockRejectedValue(new ApiError(403, 'Forbidden', ['Allocation access denied']))

    renderWithRoute(
      <FulfillmentAllocationDetailPage />,
      '/fulfillment-allocations/denied',
      '/fulfillment-allocations/:allocationId',
      {
        ...authState,
        user: {
          ...authState.user!,
          role: 'AUDITOR',
        },
      },
    )

    expect(await screen.findByRole('heading', { name: 'Allocation access denied' })).toBeInTheDocument()
    expect(screen.getByText(/role-appropriate workspace/i)).toBeInTheDocument()
    expect(screen.queryByText(/Return to Warehouse/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Relationships' })).toHaveAttribute('href', '/admin/relationships')
  })

  it('loads relationship boundary evidence with lifecycle, linked work, and outbox context', async () => {
    renderWithRoute(
      <MerchantWarehouseRelationshipDetailPage />,
      '/merchant-warehouse/relationships/relationship-1',
      '/merchant-warehouse/relationships/:relationshipId',
    )

    expect(await screen.findByText('Service Relationship Detail')).toBeInTheDocument()
    expect(screen.getByLabelText('Relationship boundary review')).toHaveTextContent('service boundary')
    expect(screen.getByText('Daily receiving')).toHaveClass('note-cell')
    expect(screen.queryByText('Not activated')).not.toBeInTheDocument()
    expect(screen.getByText('RECEIVING - 10 requested - 7 received')).toBeInTheDocument()
    expect(screen.getByText('PACKED - priority 1 - SCAN-1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Inbound ASN-1/i })).toHaveAttribute('href', '/inbound-stock-requests/inbound-1')
    expect(screen.getByRole('link', { name: /Allocation allocati/i })).toHaveAttribute('href', '/fulfillment-allocations/allocation-1')
    expect(screen.getByText('Relationship activated')).toBeInTheDocument()
    expect(screen.getAllByText('Outbox events').length).toBeGreaterThanOrEqual(2)
    expect(apiMock.merchantWarehouseRelationshipDetail).toHaveBeenCalledWith('merchant-token', 'relationship-1')
  })

  it('renders merchant-safe relationship recovery instead of an admin-only dead end', async () => {
    apiMock.merchantWarehouseRelationshipDetail.mockRejectedValue(new ApiError(404, 'Not found', ['Relationship not found: missing']))

    renderWithRoute(
      <MerchantWarehouseRelationshipDetailPage />,
      '/merchant-warehouse/relationships/missing',
      '/merchant-warehouse/relationships/:relationshipId',
    )

    expect(await screen.findByRole('heading', { name: 'Relationship not found: missing' })).toBeInTheDocument()
    expect(screen.getByText(/tenant boundary/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Merchant' })).toHaveAttribute('href', '/merchant')
  })

  it('renders platform relationship recovery to relationship governance', async () => {
    apiMock.merchantWarehouseRelationshipDetail.mockRejectedValue(new ApiError(403, 'Forbidden', ['Relationship access denied']))

    renderWithRoute(
      <MerchantWarehouseRelationshipDetailPage />,
      '/merchant-warehouse/relationships/denied',
      '/merchant-warehouse/relationships/:relationshipId',
      {
        ...authState,
        user: {
          ...authState.user!,
          role: 'AUDITOR',
        },
      },
    )

    expect(await screen.findByRole('heading', { name: 'Relationship access denied' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Relationships' })).toHaveAttribute('href', '/admin/relationships')
  })
})
