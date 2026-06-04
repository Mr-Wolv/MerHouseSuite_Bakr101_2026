import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { notificationUnreadChangedEvent } from '../notifications/notificationEvents'
import { NotificationCenterPage } from './NotificationCenterPage'

const apiMock = vi.hoisted(() => ({
  notificationPreferences: vi.fn(),
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
  login: vi.fn(),
  logout: vi.fn(),
}

function renderPage() {
  render(
    <AuthContext.Provider value={authState}>
      <NotificationCenterPage />
    </AuthContext.Provider>,
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
        channel: 'EMAIL_PROTOTYPE',
        enabled: false,
        updatedAt: '2026-05-29T00:00:00Z',
      },
    ])
    apiMock.notificationDeliveries.mockResolvedValue([deliveryFixture()])
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
    expect(sections.indexOf('Alert inbox')).toBeLessThan(sections.indexOf('Preferences'))
    expect(screen.getAllByText('Account lifecycle')).toHaveLength(2)
    expect(screen.getByText('Email channel')).toBeInTheDocument()
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
      expect(screen.getByRole('button', { name: /Read/ })).toBeDisabled()
    })
    expect(unreadListener).toHaveBeenCalledTimes(1)
    expect(unreadListener.mock.calls[0][0]).toMatchObject({ detail: { delta: -1 } })
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
        channel: 'EMAIL_PROTOTYPE',
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
    expect(screen.queryByText('Another user alert')).not.toBeInTheDocument()
    expect(screen.queryByText('delivery-current-user')).not.toBeInTheDocument()
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
    expect(screen.getByText('Failed event resolved').closest('article')).toHaveClass('notification-cleared')
    expect(screen.getByText('Critical')).toHaveClass('severity-critical')
    expect(screen.getAllByText('Action needed').some((node) => node.classList.contains('severity-action'))).toBe(true)
    expect(screen.getByText('Review')).toHaveClass('severity-review')
    expect(screen.getByText('Cleared')).toHaveClass('severity-cleared')
    expect(screen.getAllByText('Action needed').find((node) => node.closest('.metric'))?.closest('.metric')).toHaveTextContent('2')
  })

  it('guides users when there are no alert records yet', async () => {
    apiMock.notificationDeliveries.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('No alerts yet')).toBeInTheDocument()
    expect(screen.getByText(/will appear here/i)).toBeInTheDocument()
  })
})
