import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { AdminOutboxPage } from './AdminPages'

const apiMock = vi.hoisted(() => ({
  outboxSummary: vi.fn(),
  outboxEvents: vi.fn(),
  carrierDispatches: vi.fn(),
  processOutbox: vi.fn(),
  retryOutboxEvent: vi.fn(),
  deadLetterOutboxEvent: vi.fn(),
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
    tenantId: 'tenant-id',
    email: 'owner@example.test',
    role: 'ADMIN',
    enabled: true,
    createdAt: '2026-05-17T00:00:00Z',
  },
  login: vi.fn(),
  logout: vi.fn(),
}

function renderPage(state: AuthState = authState) {
  render(
    <AuthContext.Provider value={state}>
      <AdminOutboxPage />
    </AuthContext.Provider>,
  )
}

describe('AdminOutboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.outboxSummary.mockResolvedValue({
      pending: 1,
      processed: 12,
      failed: 0,
      retryableFailed: 0,
    })
    apiMock.outboxEvents.mockResolvedValue([
      {
        id: 'event-id',
        eventType: 'ShipmentCreated',
        aggregateType: 'Shipment',
        aggregateId: 'shipment-id-123456',
        status: 'PROCESSED',
        attempts: 1,
        createdAt: '2026-05-17T00:00:00Z',
        nextAttemptAt: '2026-05-17T00:00:00Z',
        processedAt: '2026-05-17T00:00:01Z',
        lastError: null,
      },
    ])
    apiMock.carrierDispatches.mockResolvedValue([
      {
        id: 'dispatch-id',
        outboxEventId: 'event-id',
        shipmentId: 'shipment-id',
        eventType: 'ShipmentCreated',
        carrier: 'Smoke Carrier',
        trackingNumber: 'TRACK-123',
        status: 'DISPATCHED',
        attempts: 1,
        externalReference: 'local-carrier-event-id',
        createdAt: '2026-05-17T00:00:01Z',
      },
    ])
    apiMock.processOutbox.mockResolvedValue({
      processed: 3,
      failed: 0,
      pending: 0,
      retryableFailed: 0,
    })
  })

  it('renders outbox health, recent events, and carrier dispatches', async () => {
    renderPage()

    expect(await screen.findByText('Recent Events')).toBeInTheDocument()
    expect(screen.getByText('Carrier Dispatches')).toBeInTheDocument()
    expect(screen.getAllByText('ShipmentCreated')).toHaveLength(2)
    expect(screen.getByText('Smoke Carrier')).toBeInTheDocument()
    expect(screen.getByText('TRACK-123')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('processes the outbox and refreshes the read models', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Process outbox' }))

    expect(apiMock.processOutbox).toHaveBeenCalledWith('admin-token')
    await waitFor(() => {
      expect(apiMock.outboxSummary).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByText('Processed 3 events with 0 failures.')).toBeInTheDocument()
  })

  it('keeps support admins in read-only diagnostic mode', async () => {
    renderPage({
      ...authState,
      user: {
        ...authState.user!,
        role: 'SUPPORT_ADMIN',
      },
    })

    expect(await screen.findByRole('button', { name: 'Owner/admin only' })).toBeDisabled()
    expect(apiMock.processOutbox).not.toHaveBeenCalled()
  })
})
