import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { WarehousePage } from './WarehousePage'

const apiMock = vi.hoisted(() => ({
  warehouses: vi.fn(),
  warehouseInventory: vi.fn(),
  fulfillmentAllocations: vi.fn(),
  merchantWarehouseRelationships: vi.fn(),
  inboundStockRequests: vi.fn(),
  fulfillmentExceptions: vi.fn(),
  warehouseDashboard: vi.fn(),
  activateMerchantWarehouseRelationship: vi.fn(),
  approveInboundStock: vi.fn(),
  startReceivingInboundStock: vi.fn(),
  receiveInboundStock: vi.fn(),
  rejectInboundStock: vi.fn(),
  advanceAllocation: vi.fn(),
  adjustStock: vi.fn(),
  createShipment: vi.fn(),
  markShipmentDelivered: vi.fn(),
  advanceShipment: vi.fn(),
  updateAllocationWorkload: vi.fn(),
  reportFulfillmentException: vi.fn(),
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
  token: 'operator-token',
  loading: false,
  user: {
    id: 'operator-user',
    tenantId: 'warehouse-tenant',
    email: 'operator@merhouse.local',
    role: 'WAREHOUSE_OPERATOR',
    enabled: true,
    createdAt: '2026-05-17T00:00:00Z',
  },
  login: vi.fn(),
  logout: vi.fn(),
}

const warehouses = [{
  id: 'warehouse-1',
  tenantId: 'warehouse-tenant',
  name: 'Main Warehouse',
  address: 'Cairo',
  latitude: null,
  longitude: null,
  capacity: 100,
  createdAt: '2026-05-17T00:00:00Z',
}]

const inventory = [{
  warehouseId: 'warehouse-1',
  inventoryItemId: 'item-1',
  sku: 'SKU-1',
  itemName: 'Merchant Item',
  quantity: 10,
  reservedQuantity: 2,
  availableQuantity: 8,
  version: 1,
  updatedAt: '2026-05-17T00:00:00Z',
}]

const allocations = [{
  id: 'allocation-1',
  orderId: 'order-1',
  customerAddress: 'Cairo Customer',
  merchantId: 'merchant-tenant',
  merchantName: 'Adidas Merchant',
  merchantWarehouseRelationshipId: 'relationship-1',
  serviceRelationshipStatus: 'ACTIVE',
  warehouseId: 'warehouse-1',
  warehouseName: 'Main Warehouse',
  status: 'PENDING',
  assignedUserId: null,
  assignedUserEmail: null,
  priority: 3,
  scanCode: null,
  pickSheetPrintedAt: null,
  items: [{ inventoryItemId: 'item-1', sku: 'SKU-1', itemName: 'Merchant Item', quantity: 2 }],
  shipment: null,
  createdAt: '2026-05-17T00:00:00Z',
}]

const relationships = [{
  id: 'relationship-1',
  merchantId: 'merchant-tenant',
  merchantName: 'Adidas Merchant',
  warehouseProviderId: 'warehouse-tenant',
  warehouseProviderName: 'Main Provider',
  status: 'REQUESTED',
  serviceNotes: 'Daily receiving',
  createdAt: '2026-05-17T00:00:00Z',
  approvedAt: null,
}]

const inboundRequests = [{
  id: 'inbound-1',
  relationshipId: 'relationship-1',
  merchantId: 'merchant-tenant',
  merchantName: 'Adidas Merchant',
  warehouseProviderId: 'warehouse-tenant',
  warehouseProviderName: 'Main Provider',
  warehouseId: 'warehouse-1',
  warehouseName: 'Main Warehouse',
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

function renderWithAuth(element: ReactNode) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authState}>{element}</AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('WarehousePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.warehouses.mockResolvedValue(warehouses)
    apiMock.warehouseInventory.mockResolvedValue(inventory)
    apiMock.fulfillmentAllocations.mockResolvedValue(allocations)
    apiMock.merchantWarehouseRelationships.mockResolvedValue(relationships)
    apiMock.inboundStockRequests.mockResolvedValue(inboundRequests)
    apiMock.fulfillmentExceptions.mockResolvedValue([])
    apiMock.warehouseDashboard.mockResolvedValue({
      orders: 1,
      openBackorders: 0,
      deliveredShipments: 0,
      inboundOpen: 1,
      stockRisk: 0,
      openExceptions: 0,
      attentionSignals: [],
    })
    apiMock.activateMerchantWarehouseRelationship.mockResolvedValue({
      ...relationships[0],
      status: 'ACTIVE',
      approvedAt: '2026-05-17T00:01:00Z',
    })
    apiMock.approveInboundStock.mockResolvedValue({ ...inboundRequests[0], status: 'APPROVED' })
    apiMock.startReceivingInboundStock.mockResolvedValue({ ...inboundRequests[0], status: 'RECEIVING' })
    apiMock.receiveInboundStock.mockResolvedValue({
      ...inboundRequests[0],
      status: 'RECEIVED',
      receivedQuantity: 5,
      shortageQuantity: 0,
      receivedAt: '2026-05-17T00:02:00Z',
    })
    apiMock.rejectInboundStock.mockResolvedValue({ ...inboundRequests[0], status: 'REJECTED', rejectionReason: 'Rejected' })
    apiMock.advanceAllocation.mockResolvedValue({ ...allocations[0], status: 'PICKING' })
    apiMock.adjustStock.mockResolvedValue({
      ...inventory[0],
      quantity: 9,
      availableQuantity: 7,
      version: 2,
    })
    apiMock.createShipment.mockResolvedValue({
      id: 'shipment-1',
      allocationId: 'allocation-1',
      orderId: 'order-1',
      warehouseId: 'warehouse-1',
      carrier: 'Local Carrier',
      trackingNumber: 'TRACK-allocation',
      packageCount: 2,
      packageWeightKg: 2,
      packageLengthCm: 40,
      packageWidthCm: 30,
      packageHeightCm: 20,
      packingNote: 'Packed with operator-entered package evidence for shipment handoff.',
      status: 'IN_TRANSIT',
      packages: [],
      metadata: { source: 'warehouse-console' },
      createdAt: '2026-05-17T00:01:00Z',
    })
    apiMock.markShipmentDelivered.mockResolvedValue({
      id: 'shipment-1',
      allocationId: 'allocation-1',
      orderId: 'order-1',
      warehouseId: 'warehouse-1',
      carrier: 'Local Carrier',
      trackingNumber: 'TRACK-allocation',
      packageCount: 2,
      packageWeightKg: 2,
      packageLengthCm: 40,
      packageWidthCm: 30,
      packageHeightCm: 20,
      packingNote: 'Packed with operator-entered package evidence for shipment handoff.',
      status: 'DELIVERED',
      packages: [],
      metadata: { source: 'warehouse-console' },
      createdAt: '2026-05-17T00:01:00Z',
    })
    apiMock.advanceShipment.mockResolvedValue({
      id: 'shipment-1',
      allocationId: 'allocation-1',
      orderId: 'order-1',
      warehouseId: 'warehouse-1',
      carrier: 'Local Carrier',
      trackingNumber: 'TRACK-allocation',
      packageCount: 2,
      packageWeightKg: 2,
      packageLengthCm: 40,
      packageWidthCm: 30,
      packageHeightCm: 20,
      packingNote: 'Packed with operator-entered package evidence for shipment handoff.',
      status: 'FAILED',
      packages: [],
      metadata: { source: 'warehouse-console' },
      createdAt: '2026-05-17T00:01:00Z',
    })
    apiMock.updateAllocationWorkload.mockResolvedValue({ ...allocations[0], priority: 1, scanCode: 'SCAN-1' })
    apiMock.reportFulfillmentException.mockResolvedValue({
      id: 'exception-1',
      allocationId: 'allocation-1',
      shipmentId: null,
      merchantId: 'merchant-tenant',
      merchantName: 'Adidas Merchant',
      warehouseProviderId: 'warehouse-tenant',
      warehouseProviderName: 'Main Provider',
      reasonCode: 'SHORT_PICK',
      description: 'Short pick',
      resolutionNote: null,
      status: 'OPEN',
      createdAt: '2026-05-17T00:00:00Z',
      resolvedAt: null,
    })
  })

  it('renders warehouse metrics, inventory, and fulfillment queue', async () => {
    renderWithAuth(<WarehousePage />)

    expect(await screen.findByText('Warehouse Console')).toBeInTheDocument()
    expect(screen.getByText("Start with today's work")).toBeInTheDocument()
    expect(screen.getByLabelText('Warehouse setup path')).toHaveTextContent('2/4 ready')
    expect(screen.getByText('Daily work')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pick, pack, and ship first' })).toBeInTheDocument()
    expect(screen.getByText('Start with active allocations, then move to receiving and records after the queue is under control.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Open partner and inbound work' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Review shipments, exceptions, and stock' })).toBeInTheDocument()
    expect(screen.getByText('Activate partner access')).toBeInTheDocument()
    expect(screen.getByText('Review requested partners first; active partners can send stock and orders.')).toBeInTheDocument()
    expect(screen.getByText('Available units')).toBeInTheDocument()
    const queueCard = screen.getByLabelText(/Allocation allocati Adidas Merchant PENDING/i)
    expect(queueCard).toBeInTheDocument()
    expect(within(queueCard).getByText('Pick sheet needed')).toBeInTheDocument()
    expect(within(queueCard).getByText('Scan pending')).toBeInTheDocument()
    expect(await screen.findByText('Merchant Item')).toBeInTheDocument()
    const inventoryRow = screen.getByRole('row', { name: /SKU-1 Merchant Item 10 2 8/i })
    expect(within(inventoryRow).getByText('10')).toHaveClass('quantity-cell', 'quantity-ready')
    expect(within(inventoryRow).getByText('2')).toHaveClass('quantity-cell', 'quantity-pending')
  })

  it('does not tell active partner accounts to wait for a request', async () => {
    apiMock.merchantWarehouseRelationships.mockResolvedValue([
      { ...relationships[0], status: 'ACTIVE', approvedAt: '2026-05-17T00:05:00Z' },
    ])

    renderWithAuth(<WarehousePage />)

    expect(await screen.findByLabelText('Warehouse setup path')).toHaveTextContent('Activate partner access')
    expect(screen.getByText('Active partners can send stock and orders.')).toBeInTheDocument()
    expect(screen.queryByText('Wait for a merchant or platform admin to request service.')).not.toBeInTheDocument()
  })

  it('advances a pending allocation to picking', async () => {
    const user = userEvent.setup()
    renderWithAuth(<WarehousePage />)

    const card = await screen.findByLabelText(/Allocation allocati Adidas Merchant PENDING/i)
    await user.click(within(card).getByRole('button', { name: 'Pick' }))

    expect(apiMock.advanceAllocation).toHaveBeenCalledWith('operator-token', 'allocation-1', { nextStatus: 'PICKING' })
    expect(await within(card).findByText('PICKING')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Pick' })).not.toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Pack' })).toBeInTheDocument()
  })

  it('activates merchant relationships and receives inbound stock', async () => {
    const user = userEvent.setup()
    renderWithAuth(<WarehousePage />)

    const relationshipRow = await screen.findByRole('row', { name: /Daily receiving/i })
    await user.click(within(relationshipRow).getByRole('button', { name: 'Activate' }))

    expect(apiMock.activateMerchantWarehouseRelationship).toHaveBeenCalledWith('operator-token', 'relationship-1')
    expect(await within(relationshipRow).findByText('ACTIVE')).toBeInTheDocument()
    expect(await within(relationshipRow).findByText('Active partner')).toHaveClass('data-chip')
    expect(within(relationshipRow).queryByRole('button', { name: 'Active' })).not.toBeInTheDocument()
    expect(within(relationshipRow).queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument()
    expect(await within(relationshipRow).findByText('This partner is already active.')).toBeInTheDocument()

    const inboundRow = await screen.findByRole('row', { name: /Approve/i })
    await user.click(within(inboundRow).getByRole('button', { name: 'Approve' }))
    expect(apiMock.approveInboundStock).toHaveBeenCalledWith('operator-token', 'inbound-1')
    expect(await within(inboundRow).findByText('APPROVED')).toBeInTheDocument()

    await user.click(within(inboundRow).getByRole('button', { name: 'Start receiving' }))
    expect(apiMock.startReceivingInboundStock).toHaveBeenCalledWith('operator-token', 'inbound-1')
    expect(await within(inboundRow).findByText('RECEIVING')).toBeInTheDocument()

    await user.click(within(inboundRow).getByRole('button', { name: 'Receive all' }))
    expect(apiMock.receiveInboundStock).toHaveBeenCalledWith('operator-token', 'inbound-1', {
      receivedQuantity: 5,
      damagedQuantity: 0,
      receivingNote: 'Received from warehouse console',
    })
    expect(await within(inboundRow).findByText('RECEIVED')).toBeInTheDocument()
    expect(await within(inboundRow).findByText('This inbound request has already been received.')).toBeInTheDocument()
  })

  it('refreshes attention after inbound receiving changes the real work state', async () => {
    const user = userEvent.setup()
    apiMock.warehouseDashboard
      .mockResolvedValueOnce({
        orders: 1,
        openBackorders: 0,
        deliveredShipments: 0,
        inboundOpen: 1,
        stockRisk: 0,
        openExceptions: 0,
        attentionSignals: [{
          id: 'warehouse-inbound-inbound-1',
          severity: 'ACTION_NEEDED',
          title: 'Inbound request needs review',
          body: 'SKU-1 from Adidas Merchant is SUBMITTED.',
          ownerRole: 'WAREHOUSE_OPERATOR',
          nextActionLabel: 'Open inbound detail',
          route: '/inbound-stock-requests/inbound-1',
          sourceType: 'InboundStockRequest',
          sourceId: 'inbound-1',
          createdAt: '2026-05-17T00:00:00Z',
          resolved: false,
        }],
      })
      .mockResolvedValueOnce({
        orders: 0,
        openBackorders: 0,
        deliveredShipments: 0,
        inboundOpen: 1,
        stockRisk: 0,
        openExceptions: 0,
        attentionSignals: [{
          id: 'warehouse-inbound-inbound-1',
          severity: 'REVIEW',
          title: 'Inbound stock needs receiving',
          body: 'SKU-1 from Adidas Merchant is APPROVED.',
          ownerRole: 'WAREHOUSE_OPERATOR',
          nextActionLabel: 'Open inbound detail',
          route: '/inbound-stock-requests/inbound-1',
          sourceType: 'InboundStockRequest',
          sourceId: 'inbound-1',
          createdAt: '2026-05-17T00:01:00Z',
          resolved: false,
        }],
      })
      .mockResolvedValueOnce({
        orders: 0,
        openBackorders: 0,
        deliveredShipments: 0,
        inboundOpen: 0,
        stockRisk: 0,
        openExceptions: 0,
        attentionSignals: [],
      })
    renderWithAuth(<WarehousePage />)

    expect(await screen.findByText('Inbound request needs review')).toBeInTheDocument()
    const inboundRow = (await screen.findAllByRole('row'))
      .find((row) => within(row).queryByRole('button', { name: 'Approve' }))
    expect(inboundRow).toBeDefined()

    await user.click(within(inboundRow!).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Inbound stock needs receiving')).toBeInTheDocument()
    expect(screen.queryByText('Inbound request needs review')).not.toBeInTheDocument()

    await user.click(within(inboundRow!).getByRole('button', { name: 'Receive all' }))

    expect(apiMock.receiveInboundStock).toHaveBeenCalledWith('operator-token', 'inbound-1', {
      receivedQuantity: 5,
      damagedQuantity: 0,
      receivingNote: 'Received from warehouse console',
    })
    expect(await screen.findByText('No warehouse work is blocked')).toBeInTheDocument()
    expect(screen.queryByText('Inbound stock needs receiving')).not.toBeInTheDocument()
    expect(apiMock.warehouseDashboard).toHaveBeenCalledTimes(3)
  })

  it('creates and delivers a shipment for a packed allocation', async () => {
    const user = userEvent.setup()
    apiMock.fulfillmentAllocations.mockResolvedValue([{ ...allocations[0], status: 'PACKED' }])
    renderWithAuth(<WarehousePage />)

    const card = await screen.findByLabelText(/Allocation allocati Adidas Merchant PACKED/i)
    await user.click(within(card).getByRole('button', { name: 'Ship' }))

    expect(apiMock.createShipment).toHaveBeenCalledWith('operator-token', {
      allocationId: 'allocation-1',
      carrier: 'FedEx',
      trackingNumber: 'MH-allocati',
      packageCount: 2,
      packageWeightKg: 2,
      packageLengthCm: 40,
      packageWidthCm: 30,
      packageHeightCm: 20,
      packingNote: 'Packed with operator-entered package evidence for shipment handoff.',
      metadata: { source: 'warehouse-console', evidence: 'operator-entered' },
    })
    expect(await within(card).findByText(/IN_TRANSIT/)).toBeInTheDocument()
    expect(card).toHaveClass('risk-card')

    await user.click(within(card).getByRole('button', { name: 'Deliver' }))
    expect(apiMock.markShipmentDelivered).toHaveBeenCalledWith('operator-token', 'shipment-1')
    expect(await within(card).findByText(/DELIVERED/)).toBeInTheDocument()
  })

  it('clears allocation attention immediately after shipping leaves the active work state', async () => {
    const user = userEvent.setup()
    apiMock.fulfillmentAllocations.mockResolvedValue([{ ...allocations[0], status: 'PACKED' }])
    apiMock.warehouseDashboard
      .mockResolvedValueOnce({
        orders: 1,
        openBackorders: 0,
        deliveredShipments: 0,
        inboundOpen: 0,
        stockRisk: 0,
        openExceptions: 0,
        attentionSignals: [{
          id: 'warehouse-allocation-allocation-1',
          severity: 'ACTION_NEEDED',
          title: 'Fulfillment work is waiting',
          body: 'Order order-1 is PACKED.',
          ownerRole: 'WAREHOUSE_OPERATOR',
          nextActionLabel: 'Open allocation detail',
          route: '/fulfillment-allocations/allocation-1',
          sourceType: 'FulfillmentAllocation',
          sourceId: null,
          createdAt: '2026-05-17T00:00:00Z',
          resolved: false,
        }],
      })
      .mockResolvedValueOnce({
        orders: 1,
        openBackorders: 0,
        deliveredShipments: 0,
        inboundOpen: 0,
        stockRisk: 0,
        openExceptions: 0,
        attentionSignals: [{
          id: 'warehouse-allocation-allocation-1',
          severity: 'ACTION_NEEDED',
          title: 'Fulfillment work is waiting',
          body: 'Order order-1 is PACKED.',
          ownerRole: 'WAREHOUSE_OPERATOR',
          nextActionLabel: 'Open allocation detail',
          route: '/fulfillment-allocations/allocation-1',
          sourceType: 'FulfillmentAllocation',
          sourceId: null,
          createdAt: '2026-05-17T00:00:00Z',
          resolved: false,
        }],
      })
    renderWithAuth(<WarehousePage />)

    expect(await screen.findByText('Order order-1 is PACKED.')).toBeInTheDocument()
    const card = await screen.findByLabelText(/Allocation allocati Adidas Merchant PACKED/i)
    await user.click(within(card).getByRole('button', { name: 'Ship' }))

    expect(await within(card).findByText(/IN_TRANSIT/)).toBeInTheDocument()
    expect(await screen.findByText('No warehouse work is blocked')).toBeInTheDocument()
    expect(screen.queryByText('Order order-1 is PACKED.')).not.toBeInTheDocument()
  })

  it('can fail or return an in-transit shipment', async () => {
    const user = userEvent.setup()
    apiMock.fulfillmentAllocations.mockResolvedValue([{
      ...allocations[0],
      status: 'SHIPPED',
      shipment: {
        id: 'shipment-1',
        allocationId: 'allocation-1',
        orderId: 'order-1',
        warehouseId: 'warehouse-1',
        carrier: 'Local Carrier',
        trackingNumber: 'TRACK-allocation',
        packageCount: 2,
        packageWeightKg: 2,
        packageLengthCm: 40,
        packageWidthCm: 30,
        packageHeightCm: 20,
        packingNote: 'Packed with operator-entered package evidence for shipment handoff.',
        status: 'IN_TRANSIT',
        packages: [],
        metadata: { source: 'warehouse-console' },
        createdAt: '2026-05-17T00:01:00Z',
      },
    }])
    renderWithAuth(<WarehousePage />)

    const card = await screen.findByLabelText(/Allocation allocati Adidas Merchant SHIPPED/i)
    await user.click(within(card).getByRole('button', { name: 'Mark failed' }))

    expect(apiMock.advanceShipment).toHaveBeenCalledWith('operator-token', 'shipment-1', { nextStatus: 'FAILED' })
    expect(await within(card).findByText(/FAILED/)).toBeInTheDocument()

    apiMock.fulfillmentAllocations.mockResolvedValue([{
      ...allocations[0],
      status: 'SHIPPED',
      shipment: {
        id: 'shipment-2',
        allocationId: 'allocation-1',
        orderId: 'order-1',
        warehouseId: 'warehouse-1',
        carrier: 'Local Carrier',
        trackingNumber: 'TRACK-return',
        packageCount: 2,
        packageWeightKg: 2,
        packageLengthCm: 40,
        packageWidthCm: 30,
        packageHeightCm: 20,
        packingNote: 'Packed with operator-entered package evidence for shipment handoff.',
        status: 'IN_TRANSIT',
        packages: [],
        metadata: { source: 'warehouse-console' },
        createdAt: '2026-05-17T00:01:00Z',
      },
    }])
    apiMock.advanceShipment.mockResolvedValueOnce({
      id: 'shipment-2',
      allocationId: 'allocation-1',
      orderId: 'order-1',
      warehouseId: 'warehouse-1',
      carrier: 'Local Carrier',
      trackingNumber: 'TRACK-return',
      packageCount: 2,
      packageWeightKg: 2,
      packageLengthCm: 40,
      packageWidthCm: 30,
      packageHeightCm: 20,
      packingNote: 'Packed with operator-entered package evidence for shipment handoff.',
      status: 'RETURNED',
      packages: [],
      metadata: { source: 'warehouse-console' },
      createdAt: '2026-05-17T00:01:00Z',
    })
    renderWithAuth(<WarehousePage />)

    const returnedCard = await screen.findByLabelText(/Allocation allocati Adidas Merchant SHIPPED .*TRACK-return/i)
    await user.click(within(returnedCard).getByRole('button', { name: 'Mark returned' }))

    expect(apiMock.advanceShipment).toHaveBeenCalledWith('operator-token', 'shipment-2', { nextStatus: 'RETURNED' })
    expect(await within(returnedCard).findByText(/RETURNED/)).toBeInTheDocument()
  })

  it('applies reason-coded stock adjustments from the warehouse inventory table', async () => {
    const user = userEvent.setup()
    renderWithAuth(<WarehousePage />)

    const row = await screen.findByRole('row', { name: /SKU-1 Merchant Item 10 2 8/i })
    fireEvent.change(within(row).getByLabelText('Delta'), { target: { value: '-1' } })
    await user.selectOptions(within(row).getByLabelText('Reason'), 'DAMAGED_STOCK')
    await user.clear(within(row).getByLabelText('Note'))
    await user.type(within(row).getByLabelText('Note'), 'Damaged during cycle count.')
    await user.click(within(row).getByRole('button', { name: 'Apply adjustment' }))

    expect(apiMock.adjustStock).toHaveBeenCalledWith('operator-token', {
      warehouseId: 'warehouse-1',
      inventoryItemId: 'item-1',
      quantityDelta: -1,
      reasonCode: 'DAMAGED_STOCK',
      reasonNote: 'Damaged during cycle count.',
    })
    expect(await within(row).findByText('9')).toBeInTheDocument()
  })

  it('shows backend errors when an invalid transition is attempted', async () => {
    const user = userEvent.setup()
    apiMock.advanceAllocation.mockRejectedValue(new ApiError(409, 'Conflict', ['Invalid allocation transition: PENDING -> PACKED']))
    renderWithAuth(<WarehousePage />)

    const card = await screen.findByLabelText(/Allocation allocati Adidas Merchant PENDING/i)
    await user.click(within(card).getByRole('button', { name: 'Pick' }))

    expect(await screen.findByText('Invalid allocation transition: PENDING -> PACKED')).toBeInTheDocument()
  })
})
