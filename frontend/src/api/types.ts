export type UserRole = 'OWNER' | 'ADMIN' | 'SUPPORT_ADMIN' | 'AUDITOR' | 'MERCHANT' | 'WAREHOUSE_OPERATOR'

export type TenantType = 'MERCHANT' | 'WAREHOUSE_PROVIDER'

export type NotificationTopic = 'ACCOUNT_LIFECYCLE' | 'OPERATIONS' | 'SERVICE_ACCOUNTABILITY' | 'OUTBOX_HEALTH'
export type NotificationChannel = 'IN_APP' | 'EMAIL_PROTOTYPE'
export type NotificationDeliveryStatus = 'RECORDED' | 'READ' | 'SKIPPED_BY_PREFERENCE'
export type NotificationDeliveryStage = 'PREPARED' | 'LOCAL_RECORDED' | 'SKIPPED_BY_PREFERENCE'
export type NotificationProviderStatus = 'NOT_CONFIGURED' | 'READY_FOR_PROVIDER'
export type AttentionSeverity = 'CRITICAL' | 'ACTION_NEEDED' | 'REVIEW' | 'CLEARED'

export type AttentionSignal = {
  id: string
  severity: AttentionSeverity
  title: string
  body: string
  ownerRole: UserRole
  nextActionLabel: string
  route: string
  sourceType: string | null
  sourceId: string | null
  createdAt: string
  resolved: boolean
}

export type User = {
  id: string
  tenantId: string
  email: string
  role: UserRole
  enabled: boolean
  createdAt: string
}

export type Tenant = {
  id: string
  name: string
  type: TenantType
  active: boolean
  suspensionReason: string | null
  suspendedAt: string | null
  createdAt: string
}

export type AuthResponse = {
  accessToken: string
  tokenType: string
  expiresInSeconds: number
  user: User
}

export type CurrentUserResponse = {
  user: User
}

export type SelfPasswordChangePayload = {
  currentPassword: string
  newPassword: string
}

export type NotificationPreference = {
  id: string
  topic: NotificationTopic
  channel: NotificationChannel
  enabled: boolean
  updatedAt: string
}

export type NotificationPreferencePayload = {
  topic: NotificationTopic
  channel: NotificationChannel
  enabled: boolean
}

export type NotificationDelivery = {
  id: string
  recipientUserId: string
  tenantId: string
  topic: NotificationTopic
  channel: NotificationChannel
  status: NotificationDeliveryStatus
  deliveryStage: NotificationDeliveryStage
  providerStatus: NotificationProviderStatus
  title: string
  body: string
  sourceType: string | null
  sourceId: string | null
  prototypeLocal: boolean
  createdAt: string
  readAt: string | null
}

export type NotificationSummary = {
  unreadCount: number
  latestDeliveryAt: string | null
  attentionSignals: AttentionSignal[]
}

export type AssistantScope = 'PLATFORM_OVERVIEW' | 'MERCHANT_OPERATIONS' | 'WAREHOUSE_OPERATIONS'
export type AssistantInteractionType = 'SUMMARY' | 'SUGGESTION' | 'REFUSAL'
export type AssistantActionStatus = 'NOT_APPLICABLE' | 'PENDING' | 'ACCEPTED' | 'REJECTED'

export type AssistantInteraction = {
  id: string
  actorUserId: string
  actorTenantId: string
  scope: AssistantScope
  targetTenantId: string | null
  responseType: AssistantInteractionType
  actionStatus: AssistantActionStatus
  requestText: string
  responseText: string
  prototypeLocal: boolean
  decidedByUserId: string | null
  decisionNote: string | null
  decidedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type AssistantInteractionPayload = {
  scope?: AssistantScope | null
  targetTenantId?: string | null
  prompt: string
}

export type AssistantDecisionPayload = {
  reason: string
}

export type InventoryItem = {
  id: string
  merchantId: string
  sku: string
  name: string
  attributes: Record<string, unknown>
  archived: boolean
  createdAt: string
}

export type Warehouse = {
  id: string
  tenantId: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  capacity: number
  createdAt: string
}

export type WarehouseInventory = {
  warehouseId: string
  inventoryItemId: string
  sku: string
  itemName: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  version: number
  updatedAt: string
}

export type MerchantAuthorizedStock = {
  relationshipId: string
  merchantId: string
  merchantName: string
  warehouseProviderId: string
  warehouseProviderName: string
  warehouseId: string
  warehouseName: string
  inventoryItemId: string
  sku: string
  itemName: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  inboundQuantity: number
}

export type OrderStatus =
  | 'CREATED'
  | 'ALLOCATED'
  | 'PARTIALLY_ALLOCATED'
  | 'BACKORDERED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export type FulfillmentStatus = 'PENDING' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'CANCELLED'

export type ShipmentStatus = 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'RETURNED'

export type BackorderStatus = 'OPEN' | 'FULFILLED' | 'CANCELLED'

export type MerchantWarehouseRelationshipStatus = 'REQUESTED' | 'ACTIVE' | 'SUSPENDED' | 'ENDED'

export type InboundStockRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RECEIVING' | 'RECEIVED' | 'REJECTED' | 'CANCELLED'

export type ServiceAgreementStatus = 'DRAFT' | 'PROPOSED' | 'ACTIVE' | 'SUSPENDED' | 'ENDED' | 'SUPERSEDED'

export type ServiceScope =
  | 'INBOUND_RECEIVING'
  | 'STORAGE'
  | 'PICK_PACK'
  | 'SHIPMENT_HANDOFF'
  | 'RETURNS'
  | 'EXCEPTION_HANDLING'
  | 'VALUE_ADDED_SERVICE'

export type ServiceStatementStatus = 'DRAFT' | 'FINALIZED' | 'MARKED_SETTLED' | 'DISPUTED' | 'CANCELLED'
export type ServiceDisputeStatus = 'OPEN' | 'RESOLVED' | 'REJECTED'
export type ServiceClaimStatus = 'OPEN' | 'RESOLVED' | 'REJECTED'
export type ServiceReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ServiceReviewType =
  | 'RATE_CARD_CHANGE'
  | 'SLA_CHANGE'
  | 'CREDIT'
  | 'PENALTY'
  | 'MANUAL_ADJUSTMENT'
  | 'DISPUTE_RESOLUTION'
  | 'CLAIM_OUTCOME'
export type OrderImportMode = 'ALL_OR_NONE' | 'PARTIAL_ACCEPT'
export type OrderImportBatchStatus = 'COMPLETED' | 'PARTIAL_ACCEPTED' | 'FAILED'
export type OrderImportRowStatus = 'CREATED' | 'REJECTED'

export type ServiceStatementLineType =
  | 'RECEIVING'
  | 'STORAGE'
  | 'PICK_PACK'
  | 'PACKAGING'
  | 'SHIPMENT_HANDOFF'
  | 'RETURN_RESTOCK'
  | 'EXCEPTION_HANDLING'
  | 'COORDINATION_FEE'
  | 'CREDIT'
  | 'PENALTY'
  | 'MANUAL_ADJUSTMENT'

export type ServiceSourceType =
  | 'INBOUND_STOCK_REQUEST'
  | 'FULFILLMENT_ALLOCATION'
  | 'SHIPMENT'
  | 'RETURN'
  | 'EXCEPTION'
  | 'MANUAL'

export type WarehouseProviderOption = {
  warehouseProviderId: string
  warehouseProviderName: string
  warehouseId: string
  warehouseName: string
  address: string
  capacity: number
}

export type Shipment = {
  id: string
  allocationId: string
  orderId: string
  warehouseId: string
  carrier: string
  trackingNumber: string | null
  packageCount: number | null
  packageWeightKg: number | null
  packageLengthCm: number | null
  packageWidthCm: number | null
  packageHeightCm: number | null
  packingNote: string | null
  status: ShipmentStatus
  packages: ShipmentPackage[]
  metadata: Record<string, unknown>
  createdAt: string
}

export type ShipmentPackage = {
  id: string
  packageNumber: number
  labelCode: string
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
  status: string
  events: Array<{
    id: string
    eventType: string
    note: string | null
    occurredAt: string
  }>
  createdAt: string
}

export type AdjustStockPayload = {
  warehouseId: string
  inventoryItemId: string
  quantityDelta: number
  reasonCode: string
  reasonNote: string
}

export type FulfillmentAllocation = {
  id: string
  orderId: string
  customerAddress: string
  merchantId: string
  merchantName: string
  merchantWarehouseRelationshipId: string | null
  serviceRelationshipStatus: MerchantWarehouseRelationshipStatus | null
  warehouseId: string
  warehouseName: string
  status: FulfillmentStatus
  assignedUserId: string | null
  assignedUserEmail: string | null
  priority: number
  scanCode: string | null
  pickSheetPrintedAt: string | null
  items: Array<{
    inventoryItemId: string
    sku: string
    itemName: string
    quantity: number
  }>
  shipment: Shipment | null
  createdAt: string
}

export type Order = {
  id: string
  merchantId: string
  customerAddress: string
  status: OrderStatus
  items: Array<{
    id: string
    inventoryItemId: string
    sku: string
    itemName: string
    quantity: number
  }>
  allocations: Array<{
    id: string
    orderId?: string
    customerAddress?: string
    merchantId?: string
    merchantName?: string
    merchantWarehouseRelationshipId?: string | null
    serviceRelationshipStatus?: MerchantWarehouseRelationshipStatus | null
    warehouseId: string
    warehouseName: string
    status: FulfillmentStatus
    items?: FulfillmentAllocation['items']
    shipment?: Shipment | null
    createdAt: string
  }>
  backorders: Array<{
    id: string
    inventoryItemId: string
    sku: string
    itemName: string
    quantity: number
    status: BackorderStatus
    createdAt: string
  }>
  createdAt: string
}

export type OutboxProcessResponse = {
  processed: number
  failed: number
  pending: number
  retryableFailed: number
}

export type OutboxSummary = {
  pending: number
  processed: number
  failed: number
  retryableFailed: number
  attentionSignals: AttentionSignal[]
}

export type OutboxEvent = {
  id: string
  eventType: string
  aggregateType: string
  aggregateId: string
  status: string
  attempts: number
  createdAt: string
  nextAttemptAt: string
  processedAt: string | null
  lastError: string | null
}

export type AdminPlatformSummary = {
  tenants: number
  suspendedTenants: number
  users: number
  enabledUsers: number
  platformAdmins: number
  pendingAccessRequests: number
  activeRelationships: number
  suspendedRelationships: number
  openInboundRequests: number
  openFulfillmentExceptions: number
  failedShipments: number
  returnedShipments: number
  failedOutboxEvents: number
  openServiceDisputes: number
  openServiceClaims: number
  pendingServiceReviews: number
  attentionSignals: AttentionSignal[]
}

export type AdminTenantHealth = {
  tenant: Tenant
  tenantId: string
  users: number
  relationships: number
  warehouses: number
  inventoryItems: number
  inboundRequests: number
  orders: number
  fulfillmentAllocations: number
  serviceStatements: number
  openDisputes: number
  openClaims: number
  pendingReviews: number
}

export type AdminAuditEvent = {
  id: string
  actorUserId: string | null
  actorEmail: string | null
  action: string
  aggregateType: string
  aggregateId: string
  reason: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type AdminActionPayload = {
  reason: string
}

export type CarrierDispatch = {
  id: string
  outboxEventId: string
  shipmentId: string
  eventType: string
  carrier: string | null
  trackingNumber: string | null
  status: string
  attempts: number
  externalReference: string
  createdAt: string
}

export type CreateTenantPayload = {
  name: string
  type: TenantType
}

export type CreateWarehousePayload = {
  tenantId: string
  name: string
  address: string
  latitude?: number | null
  longitude?: number | null
  capacity: number
}

export type CreateUserPayload = {
  tenantId: string
  email: string
  password: string
  role: UserRole
}

export type ChangeUserRolePayload = {
  role: UserRole
  reason: string
}

export type AdminResetPasswordPayload = {
  newPassword: string
  reason: string
}

export type PasswordResetRequestResponse = {
  message: string
  resetToken: string | null
  resetPath: string | null
}

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type AccessRequest = {
  id: string
  organizationName: string
  requesterEmail: string
  requestedRole: UserRole
  notes: string | null
  status: AccessRequestStatus
  reviewedByUserId: string | null
  reviewNote: string | null
  reviewedAt: string | null
  convertedTenantId: string | null
  convertedUserId: string | null
  convertedAt: string | null
  createdAt: string
}

export type AccessRequestCreatePayload = {
  organizationName: string
  requesterEmail: string
  requestedRole: Extract<UserRole, 'MERCHANT' | 'WAREHOUSE_OPERATOR'>
  notes: string
}

export type AccessRequestReviewPayload = {
  reviewNote: string
}

export type AccessRequestConvertPayload = {
  tenantName: string
  temporaryPassword: string
  reason: string
}

export type MerchantWarehouseRelationship = {
  id: string
  merchantId: string
  merchantName: string
  warehouseProviderId: string
  warehouseProviderName: string
  status: MerchantWarehouseRelationshipStatus
  serviceNotes: string | null
  createdAt: string
  approvedAt: string | null
  suspendedAt: string | null
  endedAt: string | null
  statusReason: string | null
}

export type CreateMerchantWarehouseRelationshipPayload = {
  merchantId: string
  warehouseProviderId: string
  serviceNotes: string
}

export type InboundStockRequest = {
  id: string
  relationshipId: string
  merchantId: string
  merchantName: string
  warehouseProviderId: string
  warehouseProviderName: string
  warehouseId: string
  warehouseName: string
  inventoryItemId: string
  sku: string
  itemName: string
  requestedQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  shortageQuantity: number
  status: InboundStockRequestStatus
  merchantReference: string | null
  merchantNote: string | null
  receivingNote: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  receivedAt: string | null
}

export type CreateInboundStockRequestPayload = {
  relationshipId: string
  warehouseId: string
  inventoryItemId: string
  requestedQuantity: number
  merchantReference: string
  merchantNote: string
}

export type ReferenceRateCard = {
  inboundReceivingFeePerUnit: number
  storageFeePerUnitPerDay: number
  freeStorageDays: number
  minimumMonthlyServiceCharge: number
  pickFeePerOrder: number
  pickFeePerLine: number
  packFeePerOrder: number
  packagingFeePerPackage: number
  shipmentHandlingFee: number
  returnRestockFee: number
  exceptionHandlingFee: number
  coordinationFeePercent: number
  fixedCoordinationFee: number
  carrierPassThroughNote: string | null
}

export type SlaPolicy = {
  receivingSlaHours: number
  pickPackSlaHours: number
  shipmentHandoffSlaHours: number
  exceptionResponseSlaHours: number
  pauseRuleNotes: string | null
}

export type ServiceAgreement = {
  id: string
  relationshipId: string
  merchantId: string
  merchantName: string
  warehouseProviderId: string
  warehouseProviderName: string
  status: ServiceAgreementStatus
  title: string
  versionNumber: number
  effectiveDate: string
  renewalReviewDate: string | null
  cancellationWindowDays: number
  serviceScopes: ServiceScope[]
  serviceNotes: string | null
  supersedesAgreementId: string | null
  rateCard: ReferenceRateCard
  slaPolicy: SlaPolicy
  createdAt: string
  proposedAt: string | null
  acceptedAt: string | null
  activatedAt: string | null
  suspendedAt: string | null
  endedAt: string | null
}

export type CreateServiceAgreementPayload = {
  relationshipId: string
  title: string
  effectiveDate: string
  renewalReviewDate?: string | null
  cancellationWindowDays?: number
  serviceScopes: ServiceScope[]
  serviceNotes?: string | null
  supersedesAgreementId?: string | null
  rateCard?: Partial<ReferenceRateCard>
  slaPolicy?: Partial<SlaPolicy>
}

export type ServiceStatementLine = {
  id: string
  lineType: ServiceStatementLineType
  sourceType: ServiceSourceType
  sourceId: string | null
  description: string
  quantity: number
  unitAmount: number
  lineAmount: number
}

export type ServiceStatement = {
  id: string
  agreementId: string
  merchantId: string
  merchantName: string
  warehouseProviderId: string
  warehouseProviderName: string
  status: ServiceStatementStatus
  periodStart: string
  periodEnd: string
  dueDate: string
  subtotalAmount: number
  coordinationFeeAmount: number
  adjustmentAmount: number
  totalAmount: number
  idempotencyKey: string | null
  note: string | null
  lines: ServiceStatementLine[]
  createdAt: string
  finalizedAt: string | null
  settlementMarkedAt: string | null
}

export type CreateServiceStatementPayload = {
  periodStart: string
  periodEnd: string
  dueDate: string
  idempotencyKey?: string | null
  note?: string | null
  lines: Array<{
    lineType: ServiceStatementLineType
    sourceType: ServiceSourceType
    sourceId?: string | null
    description: string
    quantity: number
    unitAmount: number
  }>
}

export type GenerateServiceStatementPayload = {
  periodStart: string
  periodEnd: string
  dueDate: string
  idempotencyKey?: string | null
  note?: string | null
  inboundStockRequestIds?: string[]
  fulfillmentAllocationIds?: string[]
  shipmentIds?: string[]
}

export type SlaStatus = {
  sourceType: ServiceSourceType
  sourceId: string
  status: string
  targetHours: number
  elapsedHours: number
  label: string
  attentionSignal: AttentionSignal | null
}

export type ServiceDispute = {
  id: string
  agreementId: string
  statementId: string
  statementLineId: string | null
  merchantId: string
  warehouseProviderId: string
  status: ServiceDisputeStatus
  reason: string
  evidenceNote: string | null
  outcomeNote: string | null
  createdAt: string
  resolvedAt: string | null
}

export type ServiceClaim = {
  id: string
  agreementId: string
  merchantId: string
  warehouseProviderId: string
  status: ServiceClaimStatus
  sourceType: ServiceSourceType
  sourceId: string | null
  claimType: string
  reason: string
  evidenceNote: string | null
  outcomeNote: string | null
  createdAt: string
  resolvedAt: string | null
}

export type ServiceReview = {
  id: string
  agreementId: string
  merchantId: string
  warehouseProviderId: string
  reviewType: ServiceReviewType
  status: ServiceReviewStatus
  reason: string
  evidenceNote: string | null
  outcomeNote: string | null
  requestedBy: string
  createdAt: string
  reviewedAt: string | null
}

export type CreateServiceDisputePayload = {
  statementLineId?: string | null
  reason: string
  evidenceNote?: string | null
}

export type CreateServiceClaimPayload = {
  sourceType: ServiceSourceType
  sourceId?: string | null
  claimType: string
  reason: string
  evidenceNote?: string | null
}

export type CreateServiceReviewPayload = {
  reviewType: ServiceReviewType
  reason: string
  evidenceNote?: string | null
}

export type ResolveServiceDisputePayload = {
  status: Exclude<ServiceDisputeStatus, 'OPEN'>
  outcomeNote?: string | null
}

export type ResolveServiceClaimPayload = {
  status: Exclude<ServiceClaimStatus, 'OPEN'>
  outcomeNote?: string | null
}

export type ResolveServiceReviewPayload = {
  status: Exclude<ServiceReviewStatus, 'PENDING'>
  outcomeNote?: string | null
}

export type OrderImportRowPayload = {
  merchantOrderReference: string
  sku: string
  quantity: number
  customerAddress: string
  customerName?: string | null
  customerPhone?: string | null
}

export type CreateOrderImportPayload = {
  merchantId: string
  mode: OrderImportMode
  sourceLabel?: string | null
  rows: OrderImportRowPayload[]
}

export type OrderImportRow = {
  id: string
  rowNumber: number
  status: OrderImportRowStatus
  merchantOrderReference: string
  sku: string
  quantity: number
  customerAddress: string
  customerName: string | null
  customerPhone: string | null
  createdOrderId: string | null
  failureReason: string | null
}

export type OrderImportBatch = {
  id: string
  merchantId: string
  mode: OrderImportMode
  status: OrderImportBatchStatus
  sourceLabel: string
  uploadedBy: string
  totalRows: number
  createdRows: number
  rejectedRows: number
  createdAt: string
  rows: OrderImportRow[]
}

export type ReceiveInboundStockPayload = {
  receivedQuantity: number
  damagedQuantity: number
  receivingNote: string
}

export type RejectInboundStockPayload = {
  rejectionReason: string
}

export type CreateInventoryItemPayload = {
  merchantId: string
  sku: string
  name: string
  attributes: Record<string, unknown>
}

export type UpdateInventoryItemPayload = {
  sku: string
  name: string
  attributes: Record<string, unknown>
  archived: boolean
}

export type CreateOrderPayload = {
  merchantId: string
  customerAddress: string
  items: Array<{
    inventoryItemId: string
    quantity: number
  }>
}

export type AdvanceAllocationPayload = {
  nextStatus: FulfillmentStatus
}

export type AdvanceShipmentPayload = {
  nextStatus: ShipmentStatus
}

export type AdvanceBackorderPayload = {
  nextStatus: BackorderStatus
}

export type UpdateAllocationWorkloadPayload = {
  assignedUserId?: string | null
  priority?: number
  scanCode?: string
  markPickSheetPrinted?: boolean
}

export type CustomerContact = {
  id: string
  merchantId: string
  label: string
  contactName: string
  phone: string | null
  address: string
  createdAt: string
}

export type CreateCustomerContactPayload = {
  merchantId: string
  label: string
  contactName: string
  phone: string
  address: string
}

export type FulfillmentException = {
  id: string
  allocationId: string | null
  shipmentId: string | null
  merchantId: string
  merchantName: string
  warehouseProviderId: string
  warehouseProviderName: string
  reasonCode: string
  description: string
  resolutionNote: string | null
  status: 'OPEN' | 'RESOLVED'
  createdAt: string
  resolvedAt: string | null
}

export type ReportExceptionPayload = {
  allocationId?: string | null
  shipmentId?: string | null
  reasonCode: string
  description: string
}

export type ResolveExceptionPayload = {
  resolutionNote: string
}

export type DashboardSummary = {
  orders: number
  openBackorders: number
  deliveredShipments: number
  inboundOpen: number
  stockRisk: number
  openExceptions: number
  attentionSignals: AttentionSignal[]
}

export type CreateShipmentPayload = {
  allocationId: string
  carrier: string
  trackingNumber: string
  packageCount: number
  packageWeightKg: number
  packageLengthCm: number
  packageWidthCm: number
  packageHeightCm: number
  packingNote: string
  metadata: Record<string, unknown>
}

export type TimelineEvent = {
  sourceId: string
  sourceType: string
  eventType: string
  label: string
  detail: string
  occurredAt: string
}

export type OrderDetail = {
  order: Order
  shipments: Shipment[]
  carrierDispatches: CarrierDispatch[]
  outboxEvents: OutboxEvent[]
  timeline: TimelineEvent[]
}

export type InventoryItemDetail = {
  item: InventoryItem
  auditLogs: Array<{
    id: string
    warehouseId: string
    inventoryItemId: string
    action: string
    beforeQuantity: number
    afterQuantity: number
    beforeReservedQuantity: number
    afterReservedQuantity: number
    reasonCode: string | null
    reasonNote: string | null
    actorUserId: string | null
    occurredAt: string
  }>
  inboundRequests: InboundStockRequest[]
  timeline: TimelineEvent[]
}

export type InboundStockRequestDetail = {
  inboundStockRequest: InboundStockRequest
  relationship: MerchantWarehouseRelationship
  auditLogs: InventoryItemDetail['auditLogs']
  outboxEvents: OutboxEvent[]
  timeline: TimelineEvent[]
}

export type ShipmentDetail = {
  shipment: Shipment
  allocation: FulfillmentAllocation
  order: Order
  carrierDispatches: CarrierDispatch[]
  outboxEvents: OutboxEvent[]
  timeline: TimelineEvent[]
}

export type FulfillmentAllocationDetail = {
  allocation: FulfillmentAllocation
  order: Order
  shipments: Shipment[]
  carrierDispatches: CarrierDispatch[]
  outboxEvents: OutboxEvent[]
  timeline: TimelineEvent[]
}

export type MerchantWarehouseRelationshipDetail = {
  relationship: MerchantWarehouseRelationship
  inboundStockRequests: InboundStockRequest[]
  allocations: FulfillmentAllocation[]
  outboxEvents: OutboxEvent[]
  timeline: TimelineEvent[]
}
