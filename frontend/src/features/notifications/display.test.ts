import type { NotificationDelivery } from '../../api/types'
import {
  displayDeliveryBody,
  notificationSeverity,
  notificationSourceHref,
  shortNotificationSourceId,
} from './display'

function delivery(overrides: Partial<NotificationDelivery> = {}): NotificationDelivery {
  return {
    id: 'delivery-1',
    recipientUserId: 'user-1',
    tenantId: 'tenant-1',
    topic: 'OPERATIONS',
    channel: 'IN_APP',
    status: 'RECORDED',
    deliveryStage: 'LOCAL_RECORDED',
    providerStatus: 'NOT_CONFIGURED',
    title: 'Inbound stock received',
    body: 'Warehouse Partner received stock.',
    sourceType: 'InboundStockRequest',
    sourceId: 'source-12345678',
    prototypeLocal: true,
    providerMessageId: null,
    providerError: null,
    providerAttemptedAt: null,
    providerSentAt: null,
    providerFailedAt: null,
    providerRetryCount: 0,
    createdAt: '2026-06-07T00:00:00Z',
    readAt: null,
    ...overrides,
  }
}

describe('notification display rules', () => {
  it('classifies alert severity from durable notification state and copy', () => {
    expect(notificationSeverity(delivery({ topic: 'OUTBOX_HEALTH', title: 'Outbox event failed' }))).toBe('critical')
    expect(notificationSeverity(delivery({ providerStatus: 'FAILED' }))).toBe('critical')
    expect(notificationSeverity(delivery({ providerStatus: 'READY_FOR_PROVIDER' }))).toBe('action')
    expect(notificationSeverity(delivery({ title: 'Preference recorded', body: 'Service preferences changed.' }))).toBe('review')
    expect(notificationSeverity(delivery({ status: 'READ', readAt: '2026-06-07T00:01:00Z' }))).toBe('cleared')
  })

  it('maps connected alert sources to stable routed work surfaces', () => {
    expect(notificationSourceHref(delivery({
      sourceType: 'InboundStockRequest',
      sourceId: 'inbound-1',
    }))).toBe('/inbound-stock-requests/inbound-1')
    expect(notificationSourceHref(delivery({
      topic: 'SERVICE_ACCOUNTABILITY',
      sourceType: 'ServiceClaim',
      sourceId: 'claim-1',
    }))).toBe('/service-accountability')
    expect(notificationSourceHref(delivery({
      topic: 'OUTBOX_HEALTH',
      sourceType: 'Shipment',
      sourceId: 'shipment-1',
    }))).toBe('/admin/outbox')
    expect(notificationSourceHref(delivery({
      sourceType: 'AccessRequest',
      sourceId: 'access-1',
    }))).toBeNull()
  })

  it('keeps prototype wording out of daily alert bodies', () => {
    expect(displayDeliveryBody('prototype-local delivery record')).toBe('delivery history record')
    expect(displayDeliveryBody('prototype-local account notice')).toBe('reviewable account notice')
  })

  it('shortens source identifiers for dense alert cards', () => {
    expect(shortNotificationSourceId('1234567890abcdef')).toBe('12345678')
  })
})
