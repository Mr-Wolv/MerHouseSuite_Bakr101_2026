import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationDeliveryStage,
  NotificationProviderStatus,
  NotificationTopic,
} from '../../api/types'

export const topicLabels: Record<NotificationTopic, string> = {
  ACCOUNT_LIFECYCLE: 'Account lifecycle',
  OPERATIONS: 'Operations',
  SERVICE_ACCOUNTABILITY: 'Service accountability',
  OUTBOX_HEALTH: 'Outbox health',
}

export const channelLabels: Record<NotificationChannel, string> = {
  IN_APP: 'In app',
  EMAIL_PROTOTYPE: 'Email',
}

export const deliveryStageLabels: Record<NotificationDeliveryStage, string> = {
  PREPARED: 'Prepared',
  LOCAL_RECORDED: 'Local recorded',
  SKIPPED_BY_PREFERENCE: 'Skipped by preference',
  PROVIDER_SENT: 'Email sent',
  PROVIDER_FAILED: 'Email failed',
}

export const providerStatusLabels: Record<NotificationProviderStatus, string> = {
  NOT_CONFIGURED: 'Channel recorded',
  READY_FOR_PROVIDER: 'Ready for handoff',
  SENT: 'Provider sent',
  FAILED: 'Provider failed',
}

export type NotificationSeverity = 'critical' | 'action' | 'review' | 'cleared'

export const severityLabels: Record<NotificationSeverity, string> = {
  critical: 'Critical',
  action: 'Action needed',
  review: 'Review',
  cleared: 'Cleared',
}

export function notificationSeverity(delivery: NotificationDelivery): NotificationSeverity {
  if (delivery.providerStatus === 'FAILED' || delivery.deliveryStage === 'PROVIDER_FAILED') {
    return 'critical'
  }
  if (delivery.status === 'READ' || delivery.readAt) return 'cleared'

  const text = `${delivery.title} ${delivery.body} ${delivery.topic} ${delivery.sourceType ?? ''}`.toLowerCase()
  const criticalTerms = ['failed', 'failure', 'error', 'dead-letter', 'dead letter', 'retry failed']
  const attentionTerms = [
    'returned',
    'return',
    'sla',
    'breach',
    'risk',
    'ready',
    'handoff',
    'prepared',
    'access request',
    'account ready',
    'account created',
    'password reset',
    'dispute',
    'claim',
    'review requested',
  ]

  if (
    delivery.topic === 'OUTBOX_HEALTH' ||
    criticalTerms.some((term) => text.includes(term))
  ) {
    return 'critical'
  }
  if (
    delivery.providerStatus === 'READY_FOR_PROVIDER' ||
    attentionTerms.some((term) => text.includes(term))
  ) {
    return 'action'
  }
  return 'review'
}

export function displayDeliveryBody(body: string) {
  return body
    .replace(/prototype-local delivery record/gi, 'delivery history record')
    .replace(/prototype-local/gi, 'reviewable')
}

export function shortNotificationSourceId(id: string) {
  return id.slice(0, 8)
}

export function notificationSourceHref(delivery: NotificationDelivery) {
  if (delivery.topic === 'OUTBOX_HEALTH') return '/admin/outbox'
  if (!delivery.sourceType) return null

  if (delivery.sourceType === 'ServiceAgreement'
    || delivery.sourceType === 'ServiceStatement'
    || delivery.sourceType === 'ServiceDispute'
    || delivery.sourceType === 'ServiceClaim'
    || delivery.sourceType === 'ServiceReviewRequest') {
    return '/service-accountability'
  }

  if (!delivery.sourceId) return null
  const detailRoutes: Record<string, string> = {
    FulfillmentAllocation: 'fulfillment-allocations',
    InboundStockRequest: 'inbound-stock-requests',
    InventoryItem: 'inventory/items',
    MerchantWarehouseRelationship: 'merchant-warehouse/relationships',
    CustomerOrder: 'orders',
    Shipment: 'shipments',
  }
  if (delivery.sourceType === 'BackorderItem') return '/merchant/orders'
  if (delivery.sourceType === 'FulfillmentException') return '/service-accountability'
  const route = detailRoutes[delivery.sourceType]
  return route ? `/${route}/${delivery.sourceId}` : null
}
