import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthState } from '../auth/AuthContextValue'
import { AuthContext } from '../auth/AuthContextValue'
import { ServiceAccountabilityPage } from './ServiceAccountabilityPage'

const apiMock = vi.hoisted(() => ({
  serviceAgreements: vi.fn(),
  serviceStatements: vi.fn(),
  serviceDisputes: vi.fn(),
  serviceClaims: vi.fn(),
  serviceReviews: vi.fn(),
  serviceSlaStatuses: vi.fn(),
  orderImports: vi.fn(),
  createServiceReview: vi.fn(),
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

describe('ServiceAccountabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.serviceAgreements.mockResolvedValue([{
      id: 'agreement-1',
      relationshipId: 'relationship-1',
      merchantId: 'merchant-tenant',
      merchantName: 'Merchant Tenant',
      warehouseProviderId: 'warehouse-tenant',
      warehouseProviderName: 'Cairo Hub',
      status: 'ACTIVE',
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
      proposedAt: null,
      acceptedAt: null,
      activatedAt: '2026-05-17T00:00:00Z',
      suspendedAt: null,
      endedAt: null,
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
  })

  it('renders service accountability guidance, severity, and dense evidence tables', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Service Accountability' })).toBeInTheDocument()
    expect(screen.getByLabelText('Service accountability review')).toHaveTextContent('disputes, claims, reviews, and import evidence')
    expect(screen.getByText('Priority support for fragile orders.')).toHaveClass('note-cell')
    expect(screen.getByText('Mismatch in handoff count.')).toHaveClass('note-cell')
    expect(screen.getByText('Carrier dispatch shows one fewer package.')).toHaveClass('note-cell')
    expect(screen.getByText('Photo evidence recorded by receiver.')).toHaveClass('note-cell')
    expect(screen.getByText('Includes May handoff adjustments.')).toHaveClass('note-cell')
    expect(screen.getByText('8/6h')).toHaveClass('data-chip', 'warning-chip')
    expect(screen.getAllByText('2').some((node) => node.classList.contains('quantity-risk'))).toBe(true)
    expect(apiMock.orderImports).toHaveBeenCalledWith('service-token', 'merchant-tenant')
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
})
