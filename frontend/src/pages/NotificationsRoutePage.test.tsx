import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { notificationUnreadChangedEvent } from '../notifications/notificationEvents'
import { NotificationCenterPage } from './NotificationsRoutePage'

const apiMock = vi.hoisted(() => ({
  notificationPreferences: vi.fn(),
  notificationSummary: vi.fn(),
  updateNotificationPreference: vi.fn(),
  notificationDeliveries: vi.fn(),
  markNotificationRead: vi.fn(),
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
  token: 'notification-token',
  loading: false,
  user: {
    id: 'user-id',
    tenantId: 'tenant-id',
    email: 'merchant@example.test',
    role: 'MERCHANT',
    enabled: true,
    createdAt: '2026-05-29T00:00:00Z',
  },
  emailVerified: false,
  sendEmailVerification: vi.fn(),
  refreshEmailVerified: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}

function renderPage() {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authState}>
        <NotificationCenterPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

function deliveryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delivery-1',
    recipientUserId: 'user-id',
    tenantId: 'tenant-id',
    topic: 'ACCOUNT_LIFECYCLE',
    channel: 'IN_APP',
    status: 'RECORDED',
    deliveryStage: 'LOCAL_RECORDED',
    providerStatus: 'NOT_CONFIGURED',
    title: 'Account ready',
    body: 'Your MerHouse account was created from an approved access request.',
    sourceType: 'AccessRequest',
    sourceId: 'request-id',
    prototypeLocal: true,
    providerMessageId: null,
    providerError: null,
    providerAttemptedAt: null,
    providerSentAt: null,
    providerFailedAt: null,
    providerRetryCount: 0,
    createdAt: '2026-05-29T00:00:00Z',
    readAt: null,
    ...overrides,
  }
}

describe('NotificationCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.notificationPreferences.mockResolvedValue([
      {
        id: 'pref-1',
        topic: 'ACCOUNT_LIFECYCLE',
        channel: 'IN_APP',
        enabled: true,
        updatedAt: '2026-05-29T00:00:00Z',
      },
      {
        id: 'pref-2',
        topic: 'OUTBOX_HEALTH',
        channel: 'IN_APP',
        enabled: false,
        updatedAt: '2026-05-29T00:00:00Z',
      },
    ])
    apiMock.notificationDeliveries.mockResolvedValue([deliveryFixture()])
    apiMock.notificationSummary.mockResolvedValue({
      unreadCount: 1,
      latestDeliveryAt: '2026-05-29T00:00:00Z',
      attentionSignals: [],
    })
    apiMock.updateNotificationPreference.mockResolvedValue({
      id: 'pref-1',
      topic: 'ACCOUNT_LIFECYCLE',
      channel: 'IN_APP',
      enabled: false,
      updatedAt: '2026-05-29T00:01:00Z',
    })
    apiMock.markNotificationRead.mockResolvedValue({
      ...deliveryFixture(),
      status: 'READ',
      readAt: '2026-05-29T00:02:00Z',
    })
  })

  it('loads alert preferences and delivery history with alerting language', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByLabelText('Alert rules')).toHaveTextContent('Start with the inbox')
    const sections = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(sections.indexOf('Action inbox')).toBeLessThan(sections.indexOf('Preferences'))
    expect(screen.getAllByText('Account lifecycle')).toHaveLength(2)
    expect(screen.getAllByText('In app').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Account ready')).toBeInTheDocument()
    expect(screen.getAllByText('Unread').some((node) => node.classList.contains('warning-chip'))).toBe(true)
    expect(screen.getByText('Account ready').closest('article')).toHaveClass('notification-action')
    expect(screen.getByText('Your MerHouse account was created from an approved access request.')).toHaveClass('note-cell')
    expect(screen.getByText('Local recorded')).toBeInTheDocument()
    expect(screen.getByText('Channel recorded')).toBeInTheDocument()
    expect(screen.getByLabelText(/LOCAL RECORDED: Recorded inside MerHouse/i).getAttribute('title')).toContain('local review')
    expect(screen.getByLabelText(/NOT CONFIGURED: No external provider is configured/i).getAttribute('title')).toContain('locally')
    expect(screen.getAllByText('Action needed').some((node) => node.classList.contains('severity-action'))).toBe(true)
    expect(screen.queryByText(/prototype/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable' })).toHaveClass('warning-button')
    expect(apiMock.notificationPreferences).toHaveBeenCalledWith('notification-token')
    expect(apiMock.notificationDeliveries).toHaveBeenCalledWith('notification-token', 50)
    expect(apiMock.notificationDeliveries).toHaveBeenCalledWith('notification-token', 50, 'RECORDED')
    expect(apiMock.notificationSummary).toHaveBeenCalledWith('notification-token')
  })

  it('uses the backend summary unread count when dense alert history exceeds the loaded delivery page', async () => {
    apiMock.notificationDeliveries.mockResolvedValue(
      Array.from({ length: 50 }, (_, index) => deliveryFixture({
        id: `delivery-${index}`,
        title: `Loaded alert ${index + 1}`,
        sourceType: null,
        sourceId: null,
      })),
    )
    apiMock.notificationSummary.mockResolvedValue({
      unreadCount: 73,
      latestDeliveryAt: '2026-05-29T00:00:00Z',
      attentionSignals: [],
    })

    renderPage()

    expect(await screen.findByText('Loaded alert 1')).toBeInTheDocument()
    const unreadMetric = within(screen.getByLabelText('Notification summary')).getByText('Unread').closest('.metric')
    expect(unreadMetric).toHaveTextContent('73')
    expect(screen.getByText('Showing 50 of 73 active')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load more alerts' })).toBeInTheDocument()
  })

  it('loads additional unread action pages when summary count exceeds visible actions', async () => {
    const user = userEvent.setup()
    const firstPage = Array.from({ length: 50 }, (_, index) => deliveryFixture({
      id: `delivery-${index + 1}`,
      title: `Loaded alert ${index + 1}`,
      sourceType: null,
      sourceId: null,
    }))
    const secondPage = Array.from({ length: 23 }, (_, index) => deliveryFixture({
      id: `delivery-${index + 51}`,
      title: `Loaded alert ${index + 51}`,
      sourceType: null,
      sourceId: null,
    }))
    apiMock.notificationDeliveries.mockImplementation(
      (_token: string, _limit: number, status?: string, page = 0) => {
        if (status === 'RECORDED') {
          return Promise.resolve(page === 1 ? secondPage : firstPage)
        }
        return Promise.resolve([])
      },
    )
    apiMock.notificationSummary.mockResolvedValue({
      unreadCount: 73,
      latestDeliveryAt: '2026-05-29T00:00:00Z',
      attentionSignals: [],
    })

    renderPage()

    expect(await screen.findByText('Loaded alert 1')).toBeInTheDocument()
    expect(screen.getByText('Showing 50 of 73 active')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more alerts' }))

    expect(await screen.findByText('Loaded alert 73')).toBeInTheDocument()
    expect(screen.getByText('73 active')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more alerts' })).not.toBeInTheDocument()
    expect(apiMock.notificationDeliveries).toHaveBeenCalledWith('notification-token', 50, 'RECORDED', 1)
  })

  it('clears stale success feedback before showing load-more alert failures', async () => {
    const user = userEvent.setup()
    const firstPage = Array.from({ length: 50 }, (_, index) => deliveryFixture({
      id: `delivery-${index + 1}`,
      title: `Loaded alert ${index + 1}`,
      sourceType: null,
      sourceId: null,
    }))
    apiMock.notificationDeliveries.mockImplementation(
      (_token: string, _limit: number, status?: string, page = 0) => {
        if (status === 'RECORDED') {
          return page === 1
            ? Promise.reject(new Error('Paged alert load failed'))
            : Promise.resolve(firstPage)
        }
        return Promise.resolve([])
      },
    )
    apiMock.notificationSummary.mockResolvedValue({
      unreadCount: 73,
      latestDeliveryAt: '2026-05-29T00:00:00Z',
      attentionSignals: [],
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Disable' }))
    expect(await screen.findByText('Account lifecycle in app updated.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more alerts' }))

    expect(await screen.findByText('Unable to load more alerts.')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Account lifecycle in app updated.')).not.toBeInTheDocument()
    })
  })

  it('keeps unread actions visible even when recent delivery history is already read', async () => {
    apiMock.notificationDeliveries.mockImplementation((_token: string, _limit: number, status?: string) => {
      if (status === 'RECORDED') {
        return Promise.resolve([
          deliveryFixture({
            id: 'older-unread',
            title: 'Older unread inbound',
            body: 'This older unread alert still needs action.',
            sourceType: 'InboundStockRequest',
            sourceId: 'inbound-older',
            createdAt: '2026-05-28T23:00:00Z',
          }),
        ])
      }
      return Promise.resolve([
        deliveryFixture({
          id: 'recent-read',
          status: 'READ',
          title: 'Recent read alert',
          body: 'This newer alert was already cleared.',
          sourceType: 'CustomerOrder',
          sourceId: 'order-recent',
          createdAt: '2026-05-29T00:05:00Z',
          readAt: '2026-05-29T00:06:00Z',
        }),
      ])
    })
    apiMock.notificationSummary.mockResolvedValue({
      unreadCount: 1,
      latestDeliveryAt: '2026-05-29T00:05:00Z',
      attentionSignals: [],
    })

    renderPage()

    expect(await screen.findByText('Older unread inbound')).toBeInTheDocument()
    expect(screen.getByText('1 active')).toBeInTheDocument()
    expect(screen.getByText('Recent read alert')).toBeInTheDocument()
    expect(screen.getByText('1 records')).toBeInTheDocument()
  })

  it('updates preferences and marks delivery records read', async () => {
    const user = userEvent.setup()
    const unreadListener = vi.fn()
    window.addEventListener(notificationUnreadChangedEvent, unreadListener)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Disable' }))

    expect(apiMock.updateNotificationPreference).toHaveBeenCalledWith('notification-token', {
      topic: 'ACCOUNT_LIFECYCLE',
      channel: 'IN_APP',
      enabled: false,
    })
    expect(await screen.findByText('Account lifecycle in app updated.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Mark read/ }))

    expect(apiMock.markNotificationRead).toHaveBeenCalledWith('notification-token', 'delivery-1')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delivery history' })).toBeInTheDocument()
      expect(screen.getByText('1 records')).toBeInTheDocument()
    })
    expect(unreadListener).toHaveBeenCalledTimes(1)
    expect(unreadListener.mock.calls[0][0]).toMatchObject({ detail: { delta: -1 } })
    expect(screen.getByText('Unread').closest('.metric')).toHaveTextContent('0')
    window.removeEventListener(notificationUnreadChangedEvent, unreadListener)
  })

  it('renders only the delivery records returned for the authenticated user', async () => {
    apiMock.notificationDeliveries.mockResolvedValue([
      deliveryFixture({
        id: 'delivery-current-user',
        title: 'Current user alert',
        body: 'This delivery belongs to the signed-in user.',
        sourceType: null,
        sourceId: null,
      }),
      deliveryFixture({
        id: 'delivery-provider-ready',
        topic: 'OPERATIONS',
        channel: 'IN_APP',
        deliveryStage: 'PREPARED',
        providerStatus: 'READY_FOR_PROVIDER',
        title: 'Provider-ready alert',
        body: 'This delivery is ready for a future provider handoff.',
        sourceType: 'Shipment',
        sourceId: 'shipment-provider-ready',
        createdAt: '2026-05-29T00:01:00Z',
        readAt: null,
      }),
    ])

    renderPage()

    expect(await screen.findByText('Current user alert')).toBeInTheDocument()
    expect(screen.getByText('Ready for handoff')).toHaveClass('data-chip', 'warning-chip')
    expect(screen.getByLabelText(/READY FOR PROVIDER: Ready for an external delivery provider/i)).toHaveClass('data-chip', 'warning-chip')
    expect(screen.getAllByText('Action needed').some((node) => node.classList.contains('severity-action'))).toBe(true)
    expect(screen.getByText('Shipment')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', '/shipments/shipment-provider-ready')
    expect(screen.queryByText('Another user alert')).not.toBeInTheDocument()
    expect(screen.queryByText('delivery-current-user')).not.toBeInTheDocument()
  })

  it('shows failed provider delivery attempts as critical history', async () => {
    apiMock.notificationDeliveries.mockResolvedValue([
      deliveryFixture({
        id: 'delivery-provider-failed',
        channel: 'IN_APP',
        status: 'READ',
        deliveryStage: 'PROVIDER_FAILED',
        providerStatus: 'FAILED',
        providerError: 'smtp unavailable',
        title: 'Password reset prepared',
        body: 'Email delivery failed.',
        readAt: '2026-05-29T00:03:00Z',
      }),
    ])

    renderPage()

    const providerFailedChips = await screen.findAllByText('Provider failed')
    expect(providerFailedChips.length).toBeGreaterThanOrEqual(1)
    expect(providerFailedChips.some((chip) => chip.classList.contains('warning-chip'))).toBe(true)
    expect(screen.getByText('smtp unavailable')).toHaveClass('data-chip', 'warning-chip')
    expect(screen.getAllByText('Critical').some((node) => node.classList.contains('severity-critical'))).toBe(true)
  })

  it('links connected alert sources to their routed work surfaces', async () => {
    apiMock.notificationDeliveries.mockResolvedValue([
      deliveryFixture({
        id: 'delivery-inbound',
        topic: 'OPERATIONS',
        title: 'Inbound stock received',
        sourceType: 'InboundStockRequest',
        sourceId: 'inbound-12345678',
      }),
      deliveryFixture({
        id: 'delivery-service',
        topic: 'SERVICE_ACCOUNTABILITY',
        title: 'Service claim opened',
        sourceType: 'ServiceClaim',
        sourceId: 'claim-12345678',
      }),
      deliveryFixture({
        id: 'delivery-exception',
        topic: 'OPERATIONS',
        title: 'Fulfillment exception reported',
        sourceType: 'FulfillmentException',
        sourceId: 'exception-12345678',
      }),
      deliveryFixture({
        id: 'delivery-order',
        topic: 'OPERATIONS',
        title: 'Order needs attention',
        sourceType: 'CustomerOrder',
        sourceId: 'order-12345678',
      }),
      deliveryFixture({
        id: 'delivery-backorder',
        topic: 'OPERATIONS',
        title: 'Backorder opened',
        sourceType: 'BackorderItem',
        sourceId: 'backorder-12345678',
      }),
      deliveryFixture({
        id: 'delivery-outbox',
        topic: 'OUTBOX_HEALTH',
        title: 'Outbox event failed',
        sourceType: 'Shipment',
        sourceId: 'shipment-12345678',
      }),
    ])

    renderPage()

    expect(await screen.findByText('Inbound stock received')).toBeInTheDocument()
    const sourceLinks = screen.getAllByRole('link', { name: 'Open source' })
    expect(sourceLinks[0]).toHaveAttribute('href', '/inbound-stock-requests/inbound-12345678')
    expect(sourceLinks[1]).toHaveAttribute('href', '/service-accountability')
    expect(sourceLinks[2]).toHaveAttribute('href', '/service-accountability')
    expect(sourceLinks[3]).toHaveAttribute('href', '/orders/order-12345678')
    expect(sourceLinks[4]).toHaveAttribute('href', '/merchant/orders')
    expect(sourceLinks[5]).toHaveAttribute('href', '/admin/outbox')
  })

  it('separates critical, action, review, and resolved notification severity', async () => {
    apiMock.notificationDeliveries.mockResolvedValue([
      deliveryFixture({
        id: 'delivery-critical',
        topic: 'OUTBOX_HEALTH',
        title: 'Outbox dead-lettered',
        body: 'Failed outbox event needs retry before dispatch continues.',
        sourceType: 'OutboxEvent',
      }),
      deliveryFixture({
        id: 'delivery-action',
        topic: 'OPERATIONS',
        title: 'Returned shipment',
        body: 'Returned shipment needs warehouse review.',
        sourceType: 'Shipment',
      }),
      deliveryFixture({
        id: 'delivery-info',
        topic: 'SERVICE_ACCOUNTABILITY',
        title: 'Preference recorded',
        body: 'Service notification preferences were updated.',
        sourceType: null,
        sourceId: null,
      }),
      deliveryFixture({
        id: 'delivery-service-review',
        topic: 'SERVICE_ACCOUNTABILITY',
        title: 'Service review requested',
        body: 'Manual service adjustment needs partner review.',
        sourceType: 'ServiceReviewRequest',
        sourceId: 'review-12345678',
      }),
      deliveryFixture({
        id: 'delivery-resolved',
        topic: 'OUTBOX_HEALTH',
        status: 'READ',
        title: 'Failed event resolved',
        body: 'Previously failed outbox work was reviewed.',
        sourceType: 'OutboxEvent',
        readAt: '2026-05-29T00:05:00Z',
      }),
    ])

    renderPage()

    expect(await screen.findByText('Outbox dead-lettered')).toBeInTheDocument()
    expect(screen.getByText('Outbox dead-lettered').closest('article')).toHaveClass('notification-critical')
    expect(screen.getByText('Returned shipment').closest('article')).toHaveClass('notification-action')
    expect(screen.getByText('Preference recorded').closest('article')).toHaveClass('notification-review')
    expect(screen.getByText('Service review requested').closest('article')).toHaveClass('notification-action')
    expect(screen.getByText('Failed event resolved').closest('article')).toHaveClass('notification-cleared')
    expect(screen.getByText('Critical')).toHaveClass('severity-critical')
    expect(screen.getAllByText('Action needed').some((node) => node.classList.contains('severity-action'))).toBe(true)
    expect(screen.getByText('Review')).toHaveClass('severity-review')
    expect(screen.getByText('Cleared')).toHaveClass('severity-cleared')
    expect(screen.getAllByText('Action needed').find((node) => node.closest('.metric'))?.closest('.metric')).toHaveTextContent('3')
  })

  it('guides users when there are no alert records yet', async () => {
    apiMock.notificationDeliveries.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('No alerts yet')).toBeInTheDocument()
    expect(screen.getByText(/will appear here/i)).toBeInTheDocument()
  })
})
