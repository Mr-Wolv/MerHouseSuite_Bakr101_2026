import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
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
    apiMock.notificationDeliveries.mockResolvedValue([
      {
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
      },
    ])
    apiMock.updateNotificationPreference.mockResolvedValue({
      id: 'pref-1',
      topic: 'ACCOUNT_LIFECYCLE',
      channel: 'IN_APP',
      enabled: false,
      updatedAt: '2026-05-29T00:01:00Z',
    })
    apiMock.markNotificationRead.mockResolvedValue({
      id: 'delivery-1',
      recipientUserId: 'user-id',
      tenantId: 'tenant-id',
      topic: 'ACCOUNT_LIFECYCLE',
      channel: 'IN_APP',
      status: 'READ',
      deliveryStage: 'LOCAL_RECORDED',
      providerStatus: 'NOT_CONFIGURED',
      title: 'Account ready',
      body: 'Your MerHouse account was created from an approved access request.',
      sourceType: 'AccessRequest',
      sourceId: 'request-id',
      prototypeLocal: true,
      createdAt: '2026-05-29T00:00:00Z',
      readAt: '2026-05-29T00:02:00Z',
    })
  })

  it('loads prototype-local preferences and delivery history', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getAllByText('Account lifecycle')).toHaveLength(2)
    expect(screen.getByText('Email prototype')).toBeInTheDocument()
    expect(screen.getByText('Account ready')).toBeInTheDocument()
    expect(screen.getByText('Local recorded')).toBeInTheDocument()
    expect(screen.getByText('Provider not configured')).toBeInTheDocument()
    expect(screen.getAllByText('Prototype-local')).toHaveLength(2)
    expect(apiMock.notificationPreferences).toHaveBeenCalledWith('notification-token')
    expect(apiMock.notificationDeliveries).toHaveBeenCalledWith('notification-token', 50)
  })

  it('updates preferences and marks delivery records read', async () => {
    const user = userEvent.setup()
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
  })

  it('renders only the delivery records returned for the authenticated user', async () => {
    apiMock.notificationDeliveries.mockResolvedValue([
      {
        id: 'delivery-current-user',
        recipientUserId: 'user-id',
        tenantId: 'tenant-id',
        topic: 'ACCOUNT_LIFECYCLE',
        channel: 'IN_APP',
        status: 'RECORDED',
        deliveryStage: 'LOCAL_RECORDED',
        providerStatus: 'NOT_CONFIGURED',
        title: 'Current user alert',
        body: 'This delivery belongs to the signed-in user.',
        sourceType: null,
        sourceId: null,
        prototypeLocal: true,
        createdAt: '2026-05-29T00:00:00Z',
        readAt: null,
      },
    ])

    renderPage()

    expect(await screen.findByText('Current user alert')).toBeInTheDocument()
    expect(screen.queryByText('Another user alert')).not.toBeInTheDocument()
    expect(screen.queryByText('delivery-current-user')).not.toBeInTheDocument()
  })
})
