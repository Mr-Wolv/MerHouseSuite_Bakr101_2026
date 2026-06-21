import { render, screen, waitFor, within } from '@testing-library/react'
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
    expect(screen.getByText('Diagnostic actions')).toBeInTheDocument()
    expect(screen.getByText(/Dead-letter actions keep the reason below/)).toBeInTheDocument()
    expect(await screen.findByText(/Outbox data refreshed/)).toBeInTheDocument()
    expect(screen.getByLabelText('Outbox severity hierarchy')).toHaveTextContent('Outbox healthy')
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
    apiMock.outboxSummary.mockResolvedValue({
      pending: 1,
      processed: 12,
      failed: 2,
      retryableFailed: 1,
      attentionSignals: [
        {
          id: 'outbox-failed',
          severity: 'CRITICAL',
          title: 'Outbox failures need reliability handling',
          body: '2 failed events need owner/admin retry or dead-letter handling; review diagnostics before escalation.',
          ownerRole: 'SUPPORT_ADMIN',
          nextActionLabel: 'Review diagnostics',
          route: '/admin/outbox',
          sourceType: 'OutboxEvent',
          sourceId: null,
          createdAt: '2026-06-10T00:00:00Z',
          resolved: false,
        },
      ],
    })

    renderPage({
      ...authState,
      user: {
        ...authState.user!,
        role: 'SUPPORT_ADMIN',
      },
    })

    expect(await screen.findByText('Owner/admin action')).toHaveClass('data-chip')
    expect(screen.queryByRole('button', { name: 'Owner/admin only' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Process outbox' })).not.toBeInTheDocument()
    expect(screen.getByText('Read-only diagnostics')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dead-letter' })).not.toBeInTheDocument()
    expect(screen.getByText('Owner: SUPPORT ADMIN')).toHaveClass('data-chip')
    expect(screen.getByRole('link', { name: 'Review diagnostics' })).toHaveAttribute('href', '/admin/outbox')
    expect(screen.getByText(/owner\/admin retry or dead-letter handling/i)).toBeInTheDocument()
    expect(apiMock.processOutbox).not.toHaveBeenCalled()
  })

  it('surfaces failed event severity, retry schedule, and failure detail', async () => {
    apiMock.outboxSummary.mockResolvedValue({
      pending: 2,
      processed: 12,
      failed: 1,
      retryableFailed: 1,
    })
    apiMock.outboxEvents.mockResolvedValue([
      {
        id: 'failed-event-id',
        eventType: 'ShipmentFailed',
        aggregateType: 'Shipment',
        aggregateId: 'shipment-id-654321',
        status: 'FAILED',
        attempts: 3,
        createdAt: '2026-05-17T00:00:00Z',
        nextAttemptAt: '2026-05-17T01:00:00Z',
        processedAt: null,
        lastError: 'Carrier endpoint unavailable',
      },
    ])

    renderPage()

    expect(await screen.findByLabelText('Outbox severity hierarchy')).toHaveTextContent('Attention required')
    expect(screen.getByText('Carrier endpoint unavailable')).toHaveClass('note-cell')
    expect(screen.getByText('3')).toHaveClass('quantity-pending')
    const row = screen.getByRole('row', { name: /ShipmentFailed/i })
    expect(within(row).getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(within(row).getByRole('button', { name: 'Dead-letter' })).toBeEnabled()
  })

  it('trims dead-letter governance reason before moving failed work', async () => {
    const user = userEvent.setup()
    apiMock.outboxEvents.mockResolvedValue([
      {
        id: 'failed-event-id',
        eventType: 'ShipmentFailed',
        aggregateType: 'Shipment',
        aggregateId: 'shipment-id-654321',
        status: 'FAILED',
        attempts: 3,
        createdAt: '2026-05-17T00:00:00Z',
        nextAttemptAt: '2026-05-17T01:00:00Z',
        processedAt: null,
        lastError: 'Carrier endpoint unavailable',
      },
    ])
    apiMock.deadLetterOutboxEvent.mockResolvedValue({
      id: 'failed-event-id',
      eventType: 'ShipmentFailed',
      aggregateType: 'Shipment',
      aggregateId: 'shipment-id-654321',
      status: 'DEAD_LETTER',
      attempts: 3,
      createdAt: '2026-05-17T00:00:00Z',
      nextAttemptAt: null,
      processedAt: null,
      lastError: 'Parked after review',
    })

    renderPage()

    await user.clear(await screen.findByLabelText('Reason'))
    await user.type(screen.getByLabelText('Reason'), ' Parked after review ')
    const row = screen.getByRole('row', { name: /ShipmentFailed/i })
    await user.click(within(row).getByRole('button', { name: 'Dead-letter' }))

    expect(apiMock.deadLetterOutboxEvent).toHaveBeenCalledWith('admin-token', 'failed-event-id', {
      reason: 'Parked after review',
    })
  })

  it('shows settled owner outbox events as state instead of disabled retry controls', async () => {
    apiMock.outboxEvents.mockResolvedValue([
      {
        id: 'processed-event-id',
        eventType: 'OrderCreated',
        aggregateType: 'CustomerOrder',
        aggregateId: 'order-id-123456',
        status: 'PROCESSED',
        attempts: 1,
        createdAt: '2026-05-17T00:00:00Z',
        nextAttemptAt: null,
        processedAt: '2026-05-17T00:00:01Z',
        lastError: null,
      },
      {
        id: 'pending-event-id',
        eventType: 'OrderAllocated',
        aggregateType: 'CustomerOrder',
        aggregateId: 'order-id-987654',
        status: 'PENDING',
        attempts: 0,
        createdAt: '2026-05-17T00:02:00Z',
        nextAttemptAt: null,
        processedAt: null,
        lastError: null,
      },
    ])

    renderPage()

    const processedRow = await screen.findByRole('row', { name: /OrderCreated/i })
    expect(within(processedRow).getByText('Processed')).toHaveClass('data-chip')
    expect(within(processedRow).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(within(processedRow).queryByRole('button', { name: 'Dead-letter' })).not.toBeInTheDocument()

    const pendingRow = screen.getByRole('row', { name: /OrderAllocated/i })
    expect(within(pendingRow).getByText('Awaiting processing')).toHaveClass('data-chip')
    expect(within(pendingRow).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(within(pendingRow).queryByRole('button', { name: 'Dead-letter' })).not.toBeInTheDocument()
  })
})
