import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { OrderDetailPage, TimelinePanel } from './OperationalDetailPages'

const apiMock = vi.hoisted(() => ({
  orderDetail: vi.fn(),
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

function renderWithRoute(element: ReactNode, path = '/orders/order-1', route = '/orders/:orderId') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authState}>
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
    expect(screen.getByText('Order created')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Allocation allocati/i })).toHaveAttribute('href', '/fulfillment-allocations/allocation-1')
    expect(apiMock.orderDetail).toHaveBeenCalledWith('merchant-token', 'order-1')
  })
})
