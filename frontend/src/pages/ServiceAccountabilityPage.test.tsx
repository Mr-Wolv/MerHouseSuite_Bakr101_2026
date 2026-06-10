import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { ServiceAccountabilityPage } from './ServiceAccountabilityPage'

const apiMock = vi.hoisted(() => ({
  serviceAgreements: vi.fn(),
  merchantWarehouseRelationships: vi.fn(),
  serviceStatements: vi.fn(),
  serviceDisputes: vi.fn(),
  serviceClaims: vi.fn(),
  serviceReviews: vi.fn(),
  serviceSlaStatuses: vi.fn(),
  orderImports: vi.fn(),
  createServiceAgreement: vi.fn(),
  proposeServiceAgreement: vi.fn(),
  acceptServiceAgreement: vi.fn(),
  createServiceReview: vi.fn(),
  resolveServiceDispute: vi.fn(),
  resolveServiceClaim: vi.fn(),
  resolveServiceReview: vi.fn(),
  finalizeServiceStatement: vi.fn(),
  markServiceStatementSettled: vi.fn(),
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

const merchantAuth: AuthState = {
  token: 'service-token',
  loading: false,
  user: {
    id: 'merchant-user',
    tenantId: 'merchant-tenant',
    email: 'merchant@merhouse.local',
    role: 'MERCHANT',
    enabled: true,
    createdAt: '2026-05-17T00:00:00Z',
  },
  login: vi.fn(),
  logout: vi.fn(),
}

function renderPage(state = merchantAuth) {
  render(
    <AuthContext.Provider value={state}>
      <ServiceAccountabilityPage />
    </AuthContext.Provider>,
  )
}

function serviceAgreementFixture(status = 'ACTIVE') {
  return {
    id: 'agreement-1',
    relationshipId: 'relationship-1',
    merchantId: 'merchant-tenant',
    merchantName: 'Merchant Tenant',
    warehouseProviderId: 'warehouse-tenant',
    warehouseProviderName: 'Cairo Hub',
    status,
    title: 'Cairo fulfillment terms',
    versionNumber: 2,
    effectiveDate: '2026-05-01',
    renewalReviewDate: '2026-06-01',
    cancellationWindowDays: 14,
    serviceScopes: ['INBOUND_RECEIVING', 'PICK_PACK_SHIP'],
    serviceNotes: 'Priority support for fragile orders.',
    supersedesAgreementId: null,
    rateCard: {
      coordinationFeePercent: 3,
      fixedCoordinationFee: 10,
      inboundReceivingFeePerUnit: 1,
      storageFeePerUnitPerMonth: 2,
      pickPackFeePerOrder: 4,
      shipmentHandlingFeePerPackage: 5,
      returnProcessingFeePerUnit: 1,
      minimumMonthlyServiceCharge: 50,
    },
    slaPolicy: {
      receivingSlaHours: 24,
      pickPackSlaHours: 12,
      shipmentHandoffSlaHours: 6,
      exceptionResponseSlaHours: 4,
      pauseRuleNotes: null,
    },
    createdAt: '2026-05-17T00:00:00Z',
    proposedAt: status === 'DRAFT' ? null : '2026-05-17T00:00:00Z',
    acceptedAt: status === 'ACTIVE' ? '2026-05-17T00:00:00Z' : null,
    activatedAt: status === 'ACTIVE' ? '2026-05-17T00:00:00Z' : null,
    suspendedAt: null,
    endedAt: null,
  }
}

describe('ServiceAccountabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.serviceAgreements.mockResolvedValue([serviceAgreementFixture()])
    apiMock.merchantWarehouseRelationships.mockResolvedValue([{
      id: 'relationship-1',
      merchantId: 'merchant-tenant',
      merchantName: 'Merchant Tenant',
      warehouseProviderId: 'warehouse-tenant',
      warehouseProviderName: 'Cairo Hub',
      status: 'ACTIVE',
      serviceNotes: 'Daily fulfillment',
      createdAt: '2026-05-17T00:00:00Z',
      approvedAt: '2026-05-17T00:00:00Z',
      suspendedAt: null,
      endedAt: null,
      statusReason: null,
    }])
    apiMock.serviceStatements.mockResolvedValue([{
      id: 'statement-1',
      agreementId: 'agreement-1',
      merchantId: 'merchant-tenant',
      merchantName: 'Merchant Tenant',
      warehouseProviderId: 'warehouse-tenant',
      warehouseProviderName: 'Cairo Hub',
      status: 'DISPUTED',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      dueDate: '2026-06-07',
      subtotalAmount: 100,
      coordinationFeeAmount: 10,
      adjustmentAmount: -5,
      totalAmount: 105,
      idempotencyKey: null,
      note: 'Includes May handoff adjustments.',
      lines: [{
        id: 'line-1',
        lineType: 'SHIPMENT_HANDOFF',
        sourceType: 'SHIPMENT',
        sourceId: 'shipment-1',
        description: 'Shipment handoff',
        quantity: 2,
        unitAmount: 50,
        lineAmount: 100,
      }],
      createdAt: '2026-05-31T00:00:00Z',
      finalizedAt: '2026-05-31T00:01:00Z',
      settlementMarkedAt: null,
    }])
    apiMock.serviceDisputes.mockResolvedValue([{
      id: 'dispute-1',
      agreementId: 'agreement-1',
      statementId: 'statement-1',
      statementLineId: null,
      merchantId: 'merchant-tenant',
      warehouseProviderId: 'warehouse-tenant',
      status: 'OPEN',
      reason: 'Mismatch in handoff count.',
      evidenceNote: 'Carrier dispatch shows one fewer package.',
      outcomeNote: null,
      createdAt: '2026-05-31T00:02:00Z',
      resolvedAt: null,
    }])
    apiMock.serviceClaims.mockResolvedValue([{
      id: 'claim-1',
      agreementId: 'agreement-1',
      merchantId: 'merchant-tenant',
      warehouseProviderId: 'warehouse-tenant',
      status: 'OPEN',
      sourceType: 'SHIPMENT',
      sourceId: 'shipment-1',
      claimType: 'DAMAGED_ITEM',
      reason: 'Damaged package claim.',
      evidenceNote: 'Photo evidence recorded by receiver.',
      outcomeNote: null,
      createdAt: '2026-05-31T00:03:00Z',
      resolvedAt: null,
    }])
    apiMock.serviceReviews.mockResolvedValue([{
      id: 'review-1',
      agreementId: 'agreement-1',
      merchantId: 'merchant-tenant',
      warehouseProviderId: 'warehouse-tenant',
      reviewType: 'MANUAL_ADJUSTMENT',
      status: 'PENDING',
      reason: 'Manual service adjustment.',
      evidenceNote: 'Adjustment evidence attached.',
      outcomeNote: null,
      requestedBy: 'merchant-user',
      createdAt: '2026-05-31T00:04:00Z',
      reviewedAt: null,
    }])
    apiMock.serviceSlaStatuses.mockResolvedValue([{
      sourceType: 'SHIPMENT',
      sourceId: 'shipment-1',
      status: 'BREACHED',
      targetHours: 6,
      elapsedHours: 8,
      label: 'Shipment handoff',
    }])
    apiMock.orderImports.mockResolvedValue([{
      id: 'import-1',
      merchantId: 'merchant-tenant',
      mode: 'VALIDATE_AND_CREATE',
      status: 'PARTIAL_ACCEPTED',
      sourceLabel: 'May import',
      uploadedBy: 'merchant-user',
      totalRows: 12,
      createdRows: 10,
      rejectedRows: 2,
      createdAt: '2026-05-31T00:05:00Z',
      rows: [],
    }])
    apiMock.createServiceReview.mockResolvedValue({
      id: 'review-2',
      agreementId: 'agreement-1',
      merchantId: 'merchant-tenant',
      warehouseProviderId: 'warehouse-tenant',
      reviewType: 'MANUAL_ADJUSTMENT',
      status: 'PENDING',
      reason: 'Manual service adjustment needs partner review',
      evidenceNote: 'Created from the service accountability page.',
      outcomeNote: null,
      requestedBy: 'merchant-user',
      createdAt: '2026-05-31T00:06:00Z',
      reviewedAt: null,
    })
    apiMock.resolveServiceDispute.mockResolvedValue({
      id: 'dispute-1',
      status: 'RESOLVED',
    })
    apiMock.resolveServiceClaim.mockResolvedValue({
      id: 'claim-1',
      status: 'REJECTED',
    })
    apiMock.resolveServiceReview.mockResolvedValue({
      id: 'review-1',
      status: 'APPROVED',
    })
    apiMock.finalizeServiceStatement.mockResolvedValue({
      id: 'statement-1',
      status: 'FINALIZED',
    })
    apiMock.markServiceStatementSettled.mockResolvedValue({
      id: 'statement-1',
      status: 'MARKED_SETTLED',
    })
    apiMock.createServiceAgreement.mockResolvedValue({
      id: 'agreement-2',
      relationshipId: 'relationship-1',
      merchantId: 'merchant-tenant',
      merchantName: 'Merchant Tenant',
      warehouseProviderId: 'warehouse-tenant',
      warehouseProviderName: 'Cairo Hub',
      status: 'DRAFT',
      title: 'Standard fulfillment terms',
      versionNumber: 3,
      effectiveDate: '2026-06-07',
      renewalReviewDate: null,
      cancellationWindowDays: 30,
      serviceScopes: ['INBOUND_RECEIVING', 'STORAGE', 'PICK_PACK', 'SHIPMENT_HANDOFF'],
      serviceNotes: 'Receiving, storage, pick-pack, and shipment handoff terms for connected fulfillment work.',
      supersedesAgreementId: null,
      rateCard: {
        coordinationFeePercent: 3,
        fixedCoordinationFee: 0,
      },
      slaPolicy: {
        receivingSlaHours: 24,
        pickPackSlaHours: 24,
        shipmentHandoffSlaHours: 24,
        exceptionResponseSlaHours: 24,
        pauseRuleNotes: null,
      },
      createdAt: '2026-06-07T00:00:00Z',
      proposedAt: null,
      acceptedAt: null,
      activatedAt: null,
      suspendedAt: null,
      endedAt: null,
    })
    apiMock.proposeServiceAgreement.mockResolvedValue({
      id: 'agreement-1',
      status: 'PROPOSED',
    })
    apiMock.acceptServiceAgreement.mockResolvedValue({
      id: 'agreement-1',
      status: 'ACTIVE',
    })
  })

  it('renders service accountability guidance, severity, and dense evidence tables', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Service Accountability' })).toBeInTheDocument()
    expect(screen.getByLabelText('Service accountability review')).toHaveTextContent('Start with open disputes')
    expect(screen.getByLabelText('Service record boundary')).toHaveTextContent('not invoices or payment collection')
    expect(screen.getByLabelText('Service record boundary')).toHaveTextContent('file attachments, legal deadline enforcement, and correction ledgers are future expansion')
    expect(screen.getByText('Priority support for fragile orders.')).toHaveClass('note-cell')
    expect(screen.getByText('Mismatch in handoff count.')).toHaveClass('note-cell')
    expect(screen.getByText('Carrier dispatch shows one fewer package.')).toHaveClass('note-cell')
    expect(screen.getByText('Photo evidence recorded by receiver.')).toHaveClass('note-cell')
    expect(screen.getByText('Includes May handoff adjustments.')).toHaveClass('note-cell')
    expect(screen.getByText('8/6h')).toHaveClass('data-chip', 'warning-chip')
    expect(screen.getAllByText('2').some((node) => node.classList.contains('quantity-risk'))).toBe(true)
    expect(apiMock.orderImports).toHaveBeenCalledWith('service-token', 'merchant-tenant')
  })

  it('keeps dense service ledgers bounded while making later records reachable', async () => {
    const user = userEvent.setup()
    apiMock.serviceStatements.mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({
      id: `statement-${index + 1}`,
      agreementId: 'agreement-1',
      merchantId: 'merchant-tenant',
      merchantName: 'Merchant Tenant',
      warehouseProviderId: 'warehouse-tenant',
      warehouseProviderName: 'Cairo Hub',
      status: 'FINALIZED',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      dueDate: '2026-06-07',
      subtotalAmount: 100,
      coordinationFeeAmount: 10,
      adjustmentAmount: 0,
      totalAmount: 110,
      idempotencyKey: null,
      note: `Statement note ${index + 1}`,
      lines: [],
      createdAt: '2026-05-31T00:00:00Z',
      finalizedAt: '2026-05-31T00:01:00Z',
      settlementMarkedAt: null,
    })))
    apiMock.serviceDisputes.mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({
      id: `dispute-${index + 1}`,
      agreementId: 'agreement-1',
      statementId: 'statement-1',
      statementLineId: null,
      merchantId: 'merchant-tenant',
      warehouseProviderId: 'warehouse-tenant',
      status: 'OPEN',
      reason: `Dispute reason ${index + 1}`,
      evidenceNote: `Evidence note ${index + 1}`,
      outcomeNote: null,
      createdAt: `2026-05-31T00:${String(index).padStart(2, '0')}:00Z`,
      resolvedAt: null,
    })))
    apiMock.serviceClaims.mockResolvedValue([])
    apiMock.serviceReviews.mockResolvedValue([])
    apiMock.orderImports.mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({
      id: `import-${index + 1}`,
      merchantId: 'merchant-tenant',
      mode: 'VALIDATE_AND_CREATE',
      status: 'ACCEPTED',
      sourceLabel: `Import batch ${index + 1}`,
      uploadedBy: 'merchant-user',
      totalRows: 3,
      createdRows: 3,
      rejectedRows: 0,
      createdAt: '2026-05-31T00:05:00Z',
      rows: [],
    })))
    renderPage()

    const statementsSection = await screen.findByRole('heading', { name: 'Service Statements' }).then((heading) => heading.closest('section')!)
    const issuesSection = screen.getByRole('heading', { name: 'Disputes, Claims, Reviews' }).closest('section')!
    const importsSection = screen.getByRole('heading', { name: 'Order Import History' }).closest('section')!

    expect(within(statementsSection).getByText('Showing 10 of 12 statements')).toBeInTheDocument()
    expect(within(statementsSection).queryByText('Statement note 11')).not.toBeInTheDocument()
    await user.click(within(statementsSection).getByRole('button', { name: 'Show 2 more statements' }))
    expect(within(statementsSection).getByText('Statement note 11')).toBeInTheDocument()

    expect(within(issuesSection).getByText('Showing 10 of 12 issue records')).toBeInTheDocument()
    expect(within(issuesSection).queryByText('Dispute reason 11')).not.toBeInTheDocument()
    await user.click(within(issuesSection).getByRole('button', { name: 'Show 2 more issue records' }))
    expect(within(issuesSection).getByText('Dispute reason 11')).toBeInTheDocument()

    expect(within(importsSection).getByText('Showing 10 of 12 import batches')).toBeInTheDocument()
    expect(within(importsSection).queryByText('Import batch 11')).not.toBeInTheDocument()
    await user.click(within(importsSection).getByRole('button', { name: 'Show 2 more import batches' }))
    expect(within(importsSection).getByText('Import batch 11')).toBeInTheDocument()
  })

  it('requests a manual service review against the active agreement', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Request review' }))

    expect(apiMock.createServiceReview).toHaveBeenCalledWith('service-token', 'agreement-1', {
      reviewType: 'MANUAL_ADJUSTMENT',
      reason: 'Manual service adjustment needs partner review',
      evidenceNote: 'Created from the service accountability page.',
    })
    expect(await screen.findByText('Review request created.')).toBeInTheDocument()
  })

  it('clears stale review success feedback before showing a failed retry', async () => {
    const user = userEvent.setup()
    apiMock.createServiceReview
      .mockResolvedValueOnce({
        id: 'review-2',
        agreementId: 'agreement-1',
        merchantId: 'merchant-tenant',
        warehouseProviderId: 'warehouse-tenant',
        reviewType: 'MANUAL_ADJUSTMENT',
        status: 'PENDING',
        reason: 'Manual service adjustment needs partner review',
        evidenceNote: 'Created from the service accountability page.',
        outcomeNote: null,
        requestedBy: 'merchant-user',
        createdAt: '2026-05-31T00:06:00Z',
        reviewedAt: null,
      })
      .mockRejectedValueOnce(new Error('Provider unavailable'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Request review' }))
    expect(await screen.findByText('Review request created.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Request review' }))

    expect(await screen.findByText('Unable to create review request.')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Review request created.')).not.toBeInTheDocument()
    })
  })

  it('resolves service issue records for allowed stakeholder roles', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Resolve dispute' }))

    expect(apiMock.resolveServiceDispute).toHaveBeenCalledWith('service-token', 'dispute-1', {
      status: 'RESOLVED',
      outcomeNote: 'Dispute resolved from the service accountability page.',
    })
    expect(await screen.findByText('Service dispute resolved.')).toBeInTheDocument()
  })

  it('finalizes draft service statements for allowed stakeholder roles', async () => {
    const user = userEvent.setup()
    apiMock.serviceStatements.mockResolvedValue([{
      id: 'statement-1',
      agreementId: 'agreement-1',
      merchantId: 'merchant-tenant',
      merchantName: 'Merchant Tenant',
      warehouseProviderId: 'warehouse-tenant',
      warehouseProviderName: 'Cairo Hub',
      status: 'DRAFT',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      dueDate: '2026-06-07',
      subtotalAmount: 100,
      coordinationFeeAmount: 10,
      adjustmentAmount: 0,
      totalAmount: 110,
      idempotencyKey: null,
      note: 'Draft service statement.',
      lines: [],
      createdAt: '2026-05-31T00:00:00Z',
      finalizedAt: null,
      settlementMarkedAt: null,
    }])
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Finalize statement' }))

    expect(apiMock.finalizeServiceStatement).toHaveBeenCalledWith('service-token', 'statement-1')
    expect(await screen.findByText('Service statement finalized.')).toBeInTheDocument()
  })

  it('marks finalized service statements settled for allowed stakeholder roles', async () => {
    const user = userEvent.setup()
    apiMock.serviceStatements.mockResolvedValue([{
      id: 'statement-1',
      agreementId: 'agreement-1',
      merchantId: 'merchant-tenant',
      merchantName: 'Merchant Tenant',
      warehouseProviderId: 'warehouse-tenant',
      warehouseProviderName: 'Cairo Hub',
      status: 'FINALIZED',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      dueDate: '2026-06-07',
      subtotalAmount: 100,
      coordinationFeeAmount: 10,
      adjustmentAmount: 0,
      totalAmount: 110,
      idempotencyKey: null,
      note: 'Finalized service statement.',
      lines: [],
      createdAt: '2026-05-31T00:00:00Z',
      finalizedAt: '2026-05-31T00:01:00Z',
      settlementMarkedAt: null,
    }])
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Mark settled' }))

    expect(apiMock.markServiceStatementSettled).toHaveBeenCalledWith('service-token', 'statement-1')
    expect(await screen.findByText('Service statement marked settled.')).toBeInTheDocument()
  })

  it('lets merchants draft and propose agreement terms for an active relationship', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('form', { name: 'Create service agreement form' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create agreement draft' }))

    expect(apiMock.createServiceAgreement).toHaveBeenCalledWith('service-token', expect.objectContaining({
      relationshipId: 'relationship-1',
      title: 'Standard fulfillment terms',
      serviceScopes: ['INBOUND_RECEIVING', 'STORAGE', 'PICK_PACK', 'SHIPMENT_HANDOFF'],
      slaPolicy: expect.objectContaining({
        receivingSlaHours: 24,
        pickPackSlaHours: 24,
        shipmentHandoffSlaHours: 24,
      }),
    }))
    expect(await screen.findByText('Agreement draft created.')).toBeInTheDocument()
  })

  it('trims copied service agreement terms before submit', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('form', { name: 'Create service agreement form' })
    const titleInput = screen.getByLabelText('Title')
    const notesInput = screen.getByLabelText('Notes')
    await user.clear(titleInput)
    await user.type(titleInput, '  Regional SLA terms  ')
    await user.clear(notesInput)
    await user.type(notesInput, '  Review monthly handoff exceptions  ')
    await user.click(screen.getByRole('button', { name: 'Create agreement draft' }))

    expect(apiMock.createServiceAgreement).toHaveBeenCalledWith('service-token', expect.objectContaining({
      title: 'Regional SLA terms',
      serviceNotes: 'Review monthly handoff exceptions',
    }))
  })

  it('lets merchants propose drafted agreement terms to the warehouse partner', async () => {
    const user = userEvent.setup()
    apiMock.serviceAgreements.mockResolvedValue([serviceAgreementFixture('DRAFT')])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Propose terms' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request review' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Propose terms' }))

    expect(apiMock.proposeServiceAgreement).toHaveBeenCalledWith('service-token', 'agreement-1')
    expect(await screen.findByText('Agreement proposed to the warehouse partner.')).toBeInTheDocument()
  })

  it('keeps auditors in read-only service evidence review mode', async () => {
    renderPage({
      ...merchantAuth,
      user: {
        ...merchantAuth.user!,
        id: 'auditor-user',
        role: 'AUDITOR',
      },
    })

    expect(await screen.findByRole('heading', { name: 'Service Accountability' })).toBeInTheDocument()
    expect(screen.getByLabelText('Service accountability review')).toHaveTextContent('reviews evidence without creating partner review work')
    expect(screen.getAllByText('Read-only evidence review').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Request review' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolve dispute' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalize statement' })).not.toBeInTheDocument()
    expect(apiMock.createServiceReview).not.toHaveBeenCalled()
    expect(apiMock.resolveServiceDispute).not.toHaveBeenCalled()
    expect(apiMock.finalizeServiceStatement).not.toHaveBeenCalled()
    expect(apiMock.orderImports).not.toHaveBeenCalled()
  })

  it('shows agreement prerequisites instead of a disabled review action for fresh stakeholders', async () => {
    apiMock.serviceAgreements.mockResolvedValue([])
    apiMock.serviceStatements.mockResolvedValue([])
    apiMock.serviceDisputes.mockResolvedValue([])
    apiMock.serviceClaims.mockResolvedValue([])
    apiMock.serviceReviews.mockResolvedValue([])
    apiMock.serviceSlaStatuses.mockResolvedValue([])
    apiMock.orderImports.mockResolvedValue([])
    apiMock.merchantWarehouseRelationships.mockResolvedValue([])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Service Accountability' })).toBeInTheDocument()
    expect(screen.getByLabelText('Service accountability review')).toHaveTextContent('Start by creating or activating a service agreement')
    expect(screen.getByText(/statement correction ledgers are outside the local model/i)).toBeInTheDocument()
    expect(screen.getByText(/not as uploaded file attachments/i)).toBeInTheDocument()
    expect(screen.getByText('No service accountability risks are active')).toBeInTheDocument()
    expect(screen.getByText('Agreement required')).toHaveClass('data-chip')
    expect(screen.getByText('No service agreements yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request review' })).not.toBeInTheDocument()
    expect(apiMock.createServiceReview).not.toHaveBeenCalled()
  })
})
