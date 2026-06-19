import { api } from './client'

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends authenticated JSON requests for shipment and backorder state changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: 'resource-1', status: 'FAILED' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.advanceShipment('token-1', 'shipment-1', { nextStatus: 'FAILED' })
    await api.updateBackorder('token-1', 'order-1', 'backorder-1', { nextStatus: 'FULFILLED' })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/shipments/shipment-1/status', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: JSON.stringify({ nextStatus: 'FAILED' }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/orders/order-1/backorders/backorder-1/status', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: JSON.stringify({ nextStatus: 'FULFILLED' }),
    })

    const firstHeaders = fetchMock.mock.calls[0][1].headers as Headers
    expect(firstHeaders.get('Authorization')).toBe('Bearer token-1')
    expect(firstHeaders.get('Content-Type')).toBe('application/json')
    expect(firstHeaders.get('Accept')).toBe('application/json')
  })

  it('sends authenticated notification preference and delivery requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'notification-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.notificationPreferences('token')
    await api.notificationSummary('token')
    await api.updateNotificationPreference('token', {
      topic: 'ACCOUNT_LIFECYCLE',
      channel: 'IN_APP',
      enabled: false,
    })
    await api.notificationDeliveries('token', 25)
    await api.notificationDeliveries('token', 50, 'RECORDED')
    await api.notificationDeliveries('token', 50, 'RECORDED', 1)
    await api.markNotificationRead('token', 'delivery-1')

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/notifications/preferences', {
      method: 'GET',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/notifications/summary', {
      method: 'GET',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/notifications/preferences', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: JSON.stringify({
        topic: 'ACCOUNT_LIFECYCLE',
        channel: 'IN_APP',
        enabled: false,
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/v1/notifications/deliveries?limit=25', {
      method: 'GET',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/v1/notifications/deliveries?limit=50&status=RECORDED', {
      method: 'GET',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(6, '/api/v1/notifications/deliveries?limit=50&page=1&status=RECORDED', {
      method: 'GET',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(7, '/api/v1/notifications/deliveries/delivery-1/read', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
  })

  it('omits request bodies for bodyless patch actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: 'shipment-1', status: 'DELIVERED' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.markShipmentDelivered('token-1', 'shipment-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/shipments/shipment-1/delivered', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect((fetchMock.mock.calls[0][1].headers as Headers).get('Content-Type')).toBeNull()
  })

  it('sends merchant-warehouse relationship and inbound stock requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: 'resource-1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.createMerchantWarehouseRelationship('token-1', {
      merchantId: 'merchant-1',
      warehouseProviderId: 'provider-1',
      serviceNotes: 'Standard receiving',
    })
    await api.merchantWarehouseWarehouseOptions('token-1')
    await api.merchantAuthorizedStock('token-1')
    await api.submitInboundStockRequest('token-1', {
      relationshipId: 'relationship-1',
      warehouseId: 'warehouse-1',
      inventoryItemId: 'item-1',
      requestedQuantity: 12,
      merchantReference: 'ASN-1',
      merchantNote: 'Arrives Tuesday',
    })
    await api.createInboundStockDraft('token-1', {
      relationshipId: 'relationship-1',
      warehouseId: 'warehouse-1',
      inventoryItemId: 'item-1',
      requestedQuantity: 6,
      merchantReference: 'ASN-DRAFT',
      merchantNote: 'Preparing cartons',
    })
    await api.submitInboundStockDraft('token-1', 'inbound-draft')
    await api.approveInboundStock('token-1', 'inbound-1')
    await api.receiveInboundStock('token-1', 'inbound-1', {
      receivedQuantity: 10,
      damagedQuantity: 1,
      receivingNote: 'One damaged carton',
    })
    await api.cancelInboundStock('token-1', 'inbound-draft')

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/merchant-warehouse/relationships', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        merchantId: 'merchant-1',
        warehouseProviderId: 'provider-1',
        serviceNotes: 'Standard receiving',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/merchant-warehouse/warehouse-options', {
      method: 'GET',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/merchant-warehouse/authorized-stock', {
      method: 'GET',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/v1/merchant-warehouse/inbound-stock-requests', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        relationshipId: 'relationship-1',
        warehouseId: 'warehouse-1',
        inventoryItemId: 'item-1',
        requestedQuantity: 12,
        merchantReference: 'ASN-1',
        merchantNote: 'Arrives Tuesday',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/v1/merchant-warehouse/inbound-stock-requests/drafts', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        relationshipId: 'relationship-1',
        warehouseId: 'warehouse-1',
        inventoryItemId: 'item-1',
        requestedQuantity: 6,
        merchantReference: 'ASN-DRAFT',
        merchantNote: 'Preparing cartons',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(6, '/api/v1/merchant-warehouse/inbound-stock-requests/inbound-draft/submit', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(7, '/api/v1/merchant-warehouse/inbound-stock-requests/inbound-1/approve', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(8, '/api/v1/merchant-warehouse/inbound-stock-requests/inbound-1/receive', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: JSON.stringify({
        receivedQuantity: 10,
        damagedQuantity: 1,
        receivingNote: 'One damaged carton',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(9, '/api/v1/merchant-warehouse/inbound-stock-requests/inbound-draft/cancel', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
  })

  it('surfaces backend validation details from failed requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: vi.fn().mockResolvedValue({
        error: 'Conflict',
        details: ['Invalid shipment transition: DELIVERED -> FAILED'],
      }),
    }))

    await expect(api.advanceShipment('token-1', 'shipment-1', { nextStatus: 'FAILED' }))
      .rejects.toMatchObject({
        status: 409,
        message: 'Conflict',
        details: ['Invalid shipment transition: DELIVERED -> FAILED'],
      })
  })

  it('uses the configured backend base URL for native builds without changing API paths', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'http://10.0.2.2:8080')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: 'user-1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const { api: configuredApi } = await import('./client')

      await configuredApi.me('token')

      expect(fetchMock).toHaveBeenCalledWith('http://10.0.2.2:8080/api/v1/auth/me', {
        method: 'GET',
        headers: expect.any(Headers),
        body: undefined,
      })
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it('sends service-accountability agreement and statement requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: 'service-resource-1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.createServiceAgreement('token-1', {
      relationshipId: 'relationship-1',
      title: 'Standard service',
      effectiveDate: '2026-05-21',
      serviceScopes: ['INBOUND_RECEIVING', 'STORAGE'],
      rateCard: {
        inboundReceivingFeePerUnit: 2.5,
        coordinationFeePercent: 5,
        fixedCoordinationFee: 1,
      },
      slaPolicy: {
        receivingSlaHours: 48,
        pickPackSlaHours: 24,
      },
    })
    await api.proposeServiceAgreement('token-1', 'agreement-1')
    await api.acceptServiceAgreement('token-1', 'agreement-1')
    await api.createServiceStatement('token-1', 'agreement-1', {
      periodStart: '2026-05-20',
      periodEnd: '2026-05-27',
      dueDate: '2026-06-03',
      idempotencyKey: 'statement-key',
      lines: [{
        lineType: 'RECEIVING',
        sourceType: 'INBOUND_STOCK_REQUEST',
        sourceId: 'inbound-1',
        description: 'Received units',
        quantity: 4,
        unitAmount: 2.5,
      }],
    })
    await api.generateServiceStatement('token-1', 'agreement-1', {
      periodStart: '2026-05-20',
      periodEnd: '2026-05-27',
      dueDate: '2026-06-03',
      inboundStockRequestIds: ['inbound-1'],
    })
    await api.serviceSlaStatuses('token-1', 'agreement-1')
    await api.createServiceDispute('token-1', 'statement-1', {
      statementLineId: 'line-1',
      reason: 'Line needs review',
      evidenceNote: 'Evidence note',
    })
    await api.createServiceClaim('token-1', 'agreement-1', {
      sourceType: 'INBOUND_STOCK_REQUEST',
      sourceId: 'inbound-1',
      claimType: 'DAMAGED_STOCK',
      reason: 'Damage review',
    })
    await api.createServiceReview('token-1', 'agreement-1', {
      reviewType: 'MANUAL_ADJUSTMENT',
      reason: 'Adjustment review',
    })
    await api.createOrderImport('token-1', {
      merchantId: 'merchant-1',
      mode: 'PARTIAL_ACCEPT',
      sourceLabel: 'Import file',
      rows: [{
        merchantOrderReference: 'ORDER-1',
        sku: 'SKU-1',
        quantity: 1,
        customerAddress: 'Address',
      }],
    })
    await api.finalizeServiceStatement('token-1', 'statement-1')
    await api.markServiceStatementSettled('token-1', 'statement-1')
    await api.resolveServiceDispute('token-1', 'dispute-1', {
      status: 'RESOLVED',
      outcomeNote: 'Accepted',
    })
    await api.resolveServiceClaim('token-1', 'claim-1', {
      status: 'REJECTED',
      outcomeNote: 'Denied',
    })
    await api.resolveServiceReview('token-1', 'review-1', {
      status: 'APPROVED',
      outcomeNote: 'Approved',
    })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/service-accountability/agreements', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        relationshipId: 'relationship-1',
        title: 'Standard service',
        effectiveDate: '2026-05-21',
        serviceScopes: ['INBOUND_RECEIVING', 'STORAGE'],
        rateCard: {
          inboundReceivingFeePerUnit: 2.5,
          coordinationFeePercent: 5,
          fixedCoordinationFee: 1,
        },
        slaPolicy: {
          receivingSlaHours: 48,
          pickPackSlaHours: 24,
        },
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/service-accountability/agreements/agreement-1/propose', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/service-accountability/agreements/agreement-1/accept', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/v1/service-accountability/agreements/agreement-1/statements', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        periodStart: '2026-05-20',
        periodEnd: '2026-05-27',
        dueDate: '2026-06-03',
        idempotencyKey: 'statement-key',
        lines: [{
          lineType: 'RECEIVING',
          sourceType: 'INBOUND_STOCK_REQUEST',
          sourceId: 'inbound-1',
          description: 'Received units',
          quantity: 4,
          unitAmount: 2.5,
        }],
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/v1/service-accountability/agreements/agreement-1/statements/generate', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        periodStart: '2026-05-20',
        periodEnd: '2026-05-27',
        dueDate: '2026-06-03',
        inboundStockRequestIds: ['inbound-1'],
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(6, '/api/v1/service-accountability/agreements/agreement-1/sla-statuses', {
      method: 'GET',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(7, '/api/v1/service-accountability/statements/statement-1/disputes', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        statementLineId: 'line-1',
        reason: 'Line needs review',
        evidenceNote: 'Evidence note',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(8, '/api/v1/service-accountability/agreements/agreement-1/claims', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        sourceType: 'INBOUND_STOCK_REQUEST',
        sourceId: 'inbound-1',
        claimType: 'DAMAGED_STOCK',
        reason: 'Damage review',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(9, '/api/v1/service-accountability/agreements/agreement-1/reviews', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        reviewType: 'MANUAL_ADJUSTMENT',
        reason: 'Adjustment review',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(10, '/api/v1/orders/imports', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        merchantId: 'merchant-1',
        mode: 'PARTIAL_ACCEPT',
        sourceLabel: 'Import file',
        rows: [{
          merchantOrderReference: 'ORDER-1',
          sku: 'SKU-1',
          quantity: 1,
          customerAddress: 'Address',
        }],
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(11, '/api/v1/service-accountability/statements/statement-1/finalize', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(12, '/api/v1/service-accountability/statements/statement-1/mark-settled', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(13, '/api/v1/service-accountability/disputes/dispute-1/resolve', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: JSON.stringify({
        status: 'RESOLVED',
        outcomeNote: 'Accepted',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(14, '/api/v1/service-accountability/claims/claim-1/resolve', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: JSON.stringify({
        status: 'REJECTED',
        outcomeNote: 'Denied',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(15, '/api/v1/service-accountability/reviews/review-1/resolve', {
      method: 'PATCH',
      headers: expect.any(Headers),
      body: JSON.stringify({
        status: 'APPROVED',
        outcomeNote: 'Approved',
      }),
    })
  })
})
