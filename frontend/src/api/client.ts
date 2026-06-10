import type {
  AuthResponse,
  AdminActionPayload,
  AdminAuditEvent,
  AdminPlatformSummary,
  AssistantInteraction,
  AssistantDecisionPayload,
  AssistantInteractionPayload,
  AdminResetPasswordPayload,
  AdminTenantHealth,
  AccessRequest,
  AccessRequestConvertPayload,
  AccessRequestCreatePayload,
  AccessRequestReviewPayload,
  AdjustStockPayload,
  AdvanceAllocationPayload,
  CarrierDispatch,
  CreateCustomerContactPayload,
  CreateShipmentPayload,
  AdvanceBackorderPayload,
  CustomerContact,
  DashboardSummary,
  FulfillmentException,
  ReportExceptionPayload,
  ResolveExceptionPayload,
  UpdateAllocationWorkloadPayload,
  CreateTenantPayload,
  CreateWarehousePayload,
  CreateOrderImportPayload,
  CreateServiceAgreementPayload,
  CreateServiceClaimPayload,
  CreateServiceDisputePayload,
  CreateServiceReviewPayload,
  CreateServiceStatementPayload,
  GenerateServiceStatementPayload,
  ResolveServiceClaimPayload,
  ResolveServiceDisputePayload,
  ResolveServiceReviewPayload,
  CreateInventoryItemPayload,
  UpdateInventoryItemPayload,
  CreateOrderPayload,
  CreateUserPayload,
  CurrentUserResponse,
  SelfPasswordChangePayload,
  ChangeUserRolePayload,
  CreateInboundStockRequestPayload,
  CreateMerchantWarehouseRelationshipPayload,
  FulfillmentAllocation,
  AdvanceShipmentPayload,
  InboundStockRequest,
  InboundStockRequestDetail,
  InventoryItem,
  InventoryItemDetail,
  MerchantAuthorizedStock,
  MerchantWarehouseRelationship,
  MerchantWarehouseRelationshipDetail,
  NotificationDelivery,
  NotificationDeliveryStatus,
  NotificationPreference,
  NotificationPreferencePayload,
  NotificationSummary,
  Order,
  OrderDetail,
  OutboxEvent,
  OutboxProcessResponse,
  OutboxSummary,
  Shipment,
  ShipmentDetail,
  ServiceAgreement,
  ServiceClaim,
  ServiceDispute,
  ServiceReview,
  SlaStatus,
  ServiceStatement,
  OrderImportBatch,
  Tenant,
  User,
  Warehouse,
  WarehouseInventory,
  WarehouseProviderOption,
  PasswordResetRequestResponse,
  ReceiveInboundStockPayload,
  RejectInboundStockPayload,
  FulfillmentAllocationDetail,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number
  details: string[]

  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.status = status
    this.details = details
  }
}

type RequestOptions = {
  token?: string | null
  method?: string
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers()
  headers.set('Accept', 'application/json')

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) {
    let message = response.statusText
    let details: string[]
    try {
      const error = await response.json()
      message = error.error ?? message
      details = Array.isArray(error.details) ? error.details : []
    } catch {
      details = []
    }
    throw new ApiError(response.status, message, details)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    })
  },
  me(token: string) {
    return request<CurrentUserResponse>('/api/v1/auth/me', { token })
  },
  changeOwnPassword(token: string, payload: SelfPasswordChangePayload) {
    return request<{ message: string }>('/api/v1/auth/me/password', {
      method: 'PATCH',
      token,
      body: payload,
    })
  },
  notificationPreferences(token: string) {
    return request<NotificationPreference[]>('/api/v1/notifications/preferences', { token })
  },
  notificationSummary(token: string) {
    return request<NotificationSummary>('/api/v1/notifications/summary', { token })
  },
  assistantInteractions(token: string, limit = 25) {
    return request<AssistantInteraction[]>(`/api/v1/assistant/interactions?limit=${limit}`, { token })
  },
  createAssistantInteraction(token: string, body: AssistantInteractionPayload) {
    return request<AssistantInteraction>('/api/v1/assistant/interactions', {
      method: 'POST',
      token,
      body,
    })
  },
  acceptAssistantSuggestion(token: string, interactionId: string, body: AssistantDecisionPayload) {
    return request<AssistantInteraction>(`/api/v1/assistant/interactions/${interactionId}/accept`, {
      method: 'POST',
      token,
      body,
    })
  },
  rejectAssistantSuggestion(token: string, interactionId: string, body: AssistantDecisionPayload) {
    return request<AssistantInteraction>(`/api/v1/assistant/interactions/${interactionId}/reject`, {
      method: 'POST',
      token,
      body,
    })
  },
  updateNotificationPreference(token: string, body: NotificationPreferencePayload) {
    return request<NotificationPreference>('/api/v1/notifications/preferences', {
      method: 'PATCH',
      token,
      body,
    })
  },
  notificationDeliveries(token: string, limit = 50, status?: NotificationDeliveryStatus, page = 0) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (page > 0) {
      params.set('page', String(page))
    }
    if (status) {
      params.set('status', status)
    }
    return request<NotificationDelivery[]>(`/api/v1/notifications/deliveries?${params.toString()}`, { token })
  },
  markNotificationRead(token: string, deliveryId: string) {
    return request<NotificationDelivery>(`/api/v1/notifications/deliveries/${deliveryId}/read`, {
      method: 'PATCH',
      token,
    })
  },
  requestPasswordReset(email: string) {
    return request<PasswordResetRequestResponse>('/api/v1/auth/password-reset/request', {
      method: 'POST',
      body: { email },
    })
  },
  confirmPasswordReset(token: string, newPassword: string) {
    return request<{ message: string }>('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: { token, newPassword },
    })
  },
  submitAccessRequest(body: AccessRequestCreatePayload) {
    return request<AccessRequest>('/api/v1/access-requests', {
      method: 'POST',
      body,
    })
  },
  accessRequests(token: string) {
    return request<AccessRequest[]>('/api/v1/access-requests', { token })
  },
  approveAccessRequest(token: string, requestId: string, body: AccessRequestReviewPayload) {
    return request<AccessRequest>(`/api/v1/access-requests/${requestId}/approve`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  rejectAccessRequest(token: string, requestId: string, body: AccessRequestReviewPayload) {
    return request<AccessRequest>(`/api/v1/access-requests/${requestId}/reject`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  convertAccessRequest(token: string, requestId: string, body: AccessRequestConvertPayload) {
    return request<AccessRequest>(`/api/v1/access-requests/${requestId}/convert`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  adminSummary(token: string) {
    return request<AdminPlatformSummary>('/api/v1/admin/control/summary', { token })
  },
  adminTenantHealth(token: string) {
    return request<AdminTenantHealth[]>('/api/v1/admin/control/tenant-health', { token })
  },
  adminAuditEvents(token: string, limit = 50) {
    return request<AdminAuditEvent[]>(`/api/v1/admin/control/audit-events?limit=${limit}`, { token })
  },
  tenants(token: string) {
    return request<Tenant[]>('/api/v1/tenants', { token })
  },
  createTenant(token: string, body: CreateTenantPayload) {
    return request<Tenant>('/api/v1/tenants', {
      method: 'POST',
      token,
      body,
    })
  },
  suspendTenant(token: string, tenantId: string, body: AdminActionPayload) {
    return request<Tenant>(`/api/v1/tenants/${tenantId}/suspend`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  activateTenant(token: string, tenantId: string, body: AdminActionPayload) {
    return request<Tenant>(`/api/v1/tenants/${tenantId}/activate`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  users(token: string) {
    return request<User[]>('/api/v1/admin/users', { token })
  },
  createUser(token: string, body: CreateUserPayload) {
    return request<User>('/api/v1/admin/users', {
      method: 'POST',
      token,
      body,
    })
  },
  disableUser(token: string, userId: string, body: AdminActionPayload) {
    return request<User>(`/api/v1/admin/users/${userId}/disable`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  enableUser(token: string, userId: string, body: AdminActionPayload) {
    return request<User>(`/api/v1/admin/users/${userId}/enable`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  changeUserRole(token: string, userId: string, body: ChangeUserRolePayload) {
    return request<User>(`/api/v1/admin/users/${userId}/role`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  adminResetUserPassword(token: string, userId: string, body: AdminResetPasswordPayload) {
    return request<User>(`/api/v1/admin/users/${userId}/password`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  processOutbox(token: string) {
    return request<OutboxProcessResponse>('/api/v1/admin/outbox/process?limit=100', {
      method: 'POST',
      token,
    })
  },
  outboxSummary(token: string) {
    return request<OutboxSummary>('/api/v1/admin/outbox/summary', { token })
  },
  outboxEvents(token: string, limit = 25) {
    return request<OutboxEvent[]>(`/api/v1/admin/outbox/events?limit=${limit}`, { token })
  },
  retryOutboxEvent(token: string, eventId: string) {
    return request<OutboxEvent>(`/api/v1/admin/outbox/events/${eventId}/retry`, {
      method: 'POST',
      token,
    })
  },
  deadLetterOutboxEvent(token: string, eventId: string, body: AdminActionPayload) {
    return request<OutboxEvent>(`/api/v1/admin/outbox/events/${eventId}/dead-letter`, {
      method: 'POST',
      token,
      body,
    })
  },
  carrierDispatches(token: string, limit = 25) {
    return request<CarrierDispatch[]>(`/api/v1/admin/outbox/carrier-dispatches?limit=${limit}`, { token })
  },
  merchantWarehouseRelationships(token: string) {
    return request<MerchantWarehouseRelationship[]>('/api/v1/merchant-warehouse/relationships', { token })
  },
  merchantWarehouseWarehouseOptions(token: string) {
    return request<WarehouseProviderOption[]>('/api/v1/merchant-warehouse/warehouse-options', { token })
  },
  createMerchantWarehouseRelationship(token: string, body: CreateMerchantWarehouseRelationshipPayload) {
    return request<MerchantWarehouseRelationship>('/api/v1/merchant-warehouse/relationships', {
      method: 'POST',
      token,
      body,
    })
  },
  activateMerchantWarehouseRelationship(token: string, relationshipId: string) {
    return request<MerchantWarehouseRelationship>(`/api/v1/merchant-warehouse/relationships/${relationshipId}/activate`, {
      method: 'PATCH',
      token,
    })
  },
  suspendMerchantWarehouseRelationship(token: string, relationshipId: string, body: AdminActionPayload) {
    return request<MerchantWarehouseRelationship>(`/api/v1/merchant-warehouse/relationships/${relationshipId}/suspend`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  reactivateMerchantWarehouseRelationship(token: string, relationshipId: string, body: AdminActionPayload) {
    return request<MerchantWarehouseRelationship>(`/api/v1/merchant-warehouse/relationships/${relationshipId}/reactivate`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  endMerchantWarehouseRelationship(token: string, relationshipId: string, body: AdminActionPayload) {
    return request<MerchantWarehouseRelationship>(`/api/v1/merchant-warehouse/relationships/${relationshipId}/end`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  inboundStockRequests(token: string) {
    return request<InboundStockRequest[]>('/api/v1/merchant-warehouse/inbound-stock-requests', { token })
  },
  merchantAuthorizedStock(token: string) {
    return request<MerchantAuthorizedStock[]>('/api/v1/merchant-warehouse/authorized-stock', { token })
  },
  submitInboundStockRequest(token: string, body: CreateInboundStockRequestPayload) {
    return request<InboundStockRequest>('/api/v1/merchant-warehouse/inbound-stock-requests', {
      method: 'POST',
      token,
      body,
    })
  },
  createInboundStockDraft(token: string, body: CreateInboundStockRequestPayload) {
    return request<InboundStockRequest>('/api/v1/merchant-warehouse/inbound-stock-requests/drafts', {
      method: 'POST',
      token,
      body,
    })
  },
  submitInboundStockDraft(token: string, inboundStockRequestId: string) {
    return request<InboundStockRequest>(`/api/v1/merchant-warehouse/inbound-stock-requests/${inboundStockRequestId}/submit`, {
      method: 'PATCH',
      token,
    })
  },
  approveInboundStock(token: string, inboundStockRequestId: string) {
    return request<InboundStockRequest>(`/api/v1/merchant-warehouse/inbound-stock-requests/${inboundStockRequestId}/approve`, {
      method: 'PATCH',
      token,
    })
  },
  cancelInboundStock(token: string, inboundStockRequestId: string) {
    return request<InboundStockRequest>(`/api/v1/merchant-warehouse/inbound-stock-requests/${inboundStockRequestId}/cancel`, {
      method: 'PATCH',
      token,
    })
  },
  startReceivingInboundStock(token: string, inboundStockRequestId: string) {
    return request<InboundStockRequest>(`/api/v1/merchant-warehouse/inbound-stock-requests/${inboundStockRequestId}/receiving`, {
      method: 'PATCH',
      token,
    })
  },
  receiveInboundStock(token: string, inboundStockRequestId: string, body: ReceiveInboundStockPayload) {
    return request<InboundStockRequest>(`/api/v1/merchant-warehouse/inbound-stock-requests/${inboundStockRequestId}/receive`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  rejectInboundStock(token: string, inboundStockRequestId: string, body: RejectInboundStockPayload) {
    return request<InboundStockRequest>(`/api/v1/merchant-warehouse/inbound-stock-requests/${inboundStockRequestId}/reject`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  serviceAgreements(token: string) {
    return request<ServiceAgreement[]>('/api/v1/service-accountability/agreements', { token })
  },
  createServiceAgreement(token: string, body: CreateServiceAgreementPayload) {
    return request<ServiceAgreement>('/api/v1/service-accountability/agreements', {
      method: 'POST',
      token,
      body,
    })
  },
  proposeServiceAgreement(token: string, agreementId: string) {
    return request<ServiceAgreement>(`/api/v1/service-accountability/agreements/${agreementId}/propose`, {
      method: 'PATCH',
      token,
    })
  },
  acceptServiceAgreement(token: string, agreementId: string) {
    return request<ServiceAgreement>(`/api/v1/service-accountability/agreements/${agreementId}/accept`, {
      method: 'PATCH',
      token,
    })
  },
  createServiceStatement(token: string, agreementId: string, body: CreateServiceStatementPayload) {
    return request<ServiceStatement>(`/api/v1/service-accountability/agreements/${agreementId}/statements`, {
      method: 'POST',
      token,
      body,
    })
  },
  generateServiceStatement(token: string, agreementId: string, body: GenerateServiceStatementPayload) {
    return request<ServiceStatement>(`/api/v1/service-accountability/agreements/${agreementId}/statements/generate`, {
      method: 'POST',
      token,
      body,
    })
  },
  serviceSlaStatuses(token: string, agreementId: string) {
    return request<SlaStatus[]>(`/api/v1/service-accountability/agreements/${agreementId}/sla-statuses`, { token })
  },
  createServiceClaim(token: string, agreementId: string, body: CreateServiceClaimPayload) {
    return request<ServiceClaim>(`/api/v1/service-accountability/agreements/${agreementId}/claims`, {
      method: 'POST',
      token,
      body,
    })
  },
  createServiceReview(token: string, agreementId: string, body: CreateServiceReviewPayload) {
    return request<ServiceReview>(`/api/v1/service-accountability/agreements/${agreementId}/reviews`, {
      method: 'POST',
      token,
      body,
    })
  },
  serviceStatements(token: string) {
    return request<ServiceStatement[]>('/api/v1/service-accountability/statements', { token })
  },
  finalizeServiceStatement(token: string, statementId: string) {
    return request<ServiceStatement>(`/api/v1/service-accountability/statements/${statementId}/finalize`, {
      method: 'PATCH',
      token,
    })
  },
  markServiceStatementSettled(token: string, statementId: string) {
    return request<ServiceStatement>(`/api/v1/service-accountability/statements/${statementId}/mark-settled`, {
      method: 'PATCH',
      token,
    })
  },
  createServiceDispute(token: string, statementId: string, body: CreateServiceDisputePayload) {
    return request<ServiceDispute>(`/api/v1/service-accountability/statements/${statementId}/disputes`, {
      method: 'POST',
      token,
      body,
    })
  },
  serviceDisputes(token: string) {
    return request<ServiceDispute[]>('/api/v1/service-accountability/disputes', { token })
  },
  serviceClaims(token: string) {
    return request<ServiceClaim[]>('/api/v1/service-accountability/claims', { token })
  },
  resolveServiceClaim(token: string, claimId: string, body: ResolveServiceClaimPayload) {
    return request<ServiceClaim>(`/api/v1/service-accountability/claims/${claimId}/resolve`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  serviceReviews(token: string) {
    return request<ServiceReview[]>('/api/v1/service-accountability/reviews', { token })
  },
  resolveServiceReview(token: string, reviewId: string, body: ResolveServiceReviewPayload) {
    return request<ServiceReview>(`/api/v1/service-accountability/reviews/${reviewId}/resolve`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  resolveServiceDispute(token: string, disputeId: string, body: ResolveServiceDisputePayload) {
    return request<ServiceDispute>(`/api/v1/service-accountability/disputes/${disputeId}/resolve`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  inventoryItems(token: string) {
    return request<InventoryItem[]>('/api/v1/inventory/items', { token })
  },
  createInventoryItem(token: string, body: CreateInventoryItemPayload) {
    return request<InventoryItem>('/api/v1/inventory/items', {
      method: 'POST',
      token,
      body,
    })
  },
  updateInventoryItem(token: string, inventoryItemId: string, body: UpdateInventoryItemPayload) {
    return request<InventoryItem>(`/api/v1/inventory/items/${inventoryItemId}`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  customerContacts(token: string) {
    return request<CustomerContact[]>('/api/v1/orders/customer-contacts', { token })
  },
  createCustomerContact(token: string, body: CreateCustomerContactPayload) {
    return request<CustomerContact>('/api/v1/orders/customer-contacts', {
      method: 'POST',
      token,
      body,
    })
  },
  orders(token: string) {
    return request<Order[]>('/api/v1/orders', { token })
  },
  createOrder(token: string, body: CreateOrderPayload) {
    return request<Order>('/api/v1/orders', {
      method: 'POST',
      token,
      body,
    })
  },
  createOrderImport(token: string, body: CreateOrderImportPayload) {
    return request<OrderImportBatch>('/api/v1/orders/imports', {
      method: 'POST',
      token,
      body,
    })
  },
  orderImports(token: string, merchantId?: string) {
    const query = merchantId ? `?merchantId=${merchantId}` : ''
    return request<OrderImportBatch[]>(`/api/v1/orders/imports${query}`, { token })
  },
  allocateOrder(token: string, orderId: string) {
    return request<Order>(`/api/v1/orders/${orderId}/allocate`, {
      method: 'POST',
      token,
    })
  },
  cancelOrder(token: string, orderId: string) {
    return request<Order>(`/api/v1/orders/${orderId}/cancel`, {
      method: 'POST',
      token,
    })
  },
  warehouses(token: string) {
    return request<Warehouse[]>('/api/v1/warehouses', { token })
  },
  createWarehouse(token: string, body: CreateWarehousePayload) {
    return request<Warehouse>('/api/v1/warehouses', {
      method: 'POST',
      token,
      body,
    })
  },
  warehouseInventory(token: string, warehouseId: string) {
    return request<WarehouseInventory[]>(`/api/v1/inventory/warehouses/${warehouseId}`, { token })
  },
  adjustStock(token: string, body: AdjustStockPayload) {
    return request<WarehouseInventory>('/api/v1/inventory/stock/adjust', {
      method: 'POST',
      token,
      body,
    })
  },
  fulfillmentAllocations(token: string, warehouseId?: string) {
    const query = warehouseId ? `?warehouseId=${warehouseId}` : ''
    return request<FulfillmentAllocation[]>(`/api/v1/fulfillment-allocations${query}`, { token })
  },
  advanceAllocation(token: string, allocationId: string, body: AdvanceAllocationPayload) {
    return request<FulfillmentAllocation>(`/api/v1/fulfillment-allocations/${allocationId}/status`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  updateAllocationWorkload(token: string, allocationId: string, body: UpdateAllocationWorkloadPayload) {
    return request<FulfillmentAllocation>(`/api/v1/fulfillment-allocations/${allocationId}/workload`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  createShipment(token: string, body: CreateShipmentPayload) {
    return request<Shipment>('/api/v1/shipments', {
      method: 'POST',
      token,
      body,
    })
  },
  markShipmentDelivered(token: string, shipmentId: string) {
    return request<Shipment>(`/api/v1/shipments/${shipmentId}/delivered`, {
      method: 'PATCH',
      token,
    })
  },
  advanceShipment(token: string, shipmentId: string, body: AdvanceShipmentPayload) {
    return request<Shipment>(`/api/v1/shipments/${shipmentId}/status`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  updateBackorder(token: string, orderId: string, backorderId: string, body: AdvanceBackorderPayload) {
    return request<Order>(`/api/v1/orders/${orderId}/backorders/${backorderId}/status`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  fulfillmentExceptions(token: string) {
    return request<FulfillmentException[]>('/api/v1/fulfillment-exceptions', { token })
  },
  reportFulfillmentException(token: string, body: ReportExceptionPayload) {
    return request<FulfillmentException>('/api/v1/fulfillment-exceptions', {
      method: 'POST',
      token,
      body,
    })
  },
  resolveFulfillmentException(token: string, exceptionId: string, body: ResolveExceptionPayload) {
    return request<FulfillmentException>(`/api/v1/fulfillment-exceptions/${exceptionId}/resolve`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  merchantDashboard(token: string) {
    return request<DashboardSummary>('/api/v1/dashboard/merchant', { token })
  },
  warehouseDashboard(token: string) {
    return request<DashboardSummary>('/api/v1/dashboard/warehouse', { token })
  },
  orderDetail(token: string, orderId: string) {
    return request<OrderDetail>(`/api/v1/operational-details/orders/${orderId}`, { token })
  },
  inventoryItemDetail(token: string, inventoryItemId: string) {
    return request<InventoryItemDetail>(`/api/v1/operational-details/inventory-items/${inventoryItemId}`, { token })
  },
  inboundStockRequestDetail(token: string, inboundStockRequestId: string) {
    return request<InboundStockRequestDetail>(`/api/v1/operational-details/inbound-stock-requests/${inboundStockRequestId}`, { token })
  },
  shipmentDetail(token: string, shipmentId: string) {
    return request<ShipmentDetail>(`/api/v1/operational-details/shipments/${shipmentId}`, { token })
  },
  fulfillmentAllocationDetail(token: string, allocationId: string) {
    return request<FulfillmentAllocationDetail>(`/api/v1/operational-details/fulfillment-allocations/${allocationId}`, { token })
  },
  merchantWarehouseRelationshipDetail(token: string, relationshipId: string) {
    return request<MerchantWarehouseRelationshipDetail>(`/api/v1/operational-details/relationships/${relationshipId}`, { token })
  },
}
