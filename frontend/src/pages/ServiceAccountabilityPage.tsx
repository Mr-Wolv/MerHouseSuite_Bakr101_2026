import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type {
  AttentionSignal,
  OrderImportBatch,
  ServiceAgreement,
  ServiceClaim,
  ServiceDispute,
  MerchantWarehouseRelationship,
  ServiceReview,
  ServiceScope,
  ServiceStatement,
  SlaStatus,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { Metric } from '../components/Metric'
import { GuidancePanel, QuantityCell } from '../components/PageChrome'
import { StatusBadge } from '../components/StatusBadge'
import { AttentionQueue } from '../components/AttentionQueue'

type ServiceData = {
  agreements: ServiceAgreement[]
  relationships: MerchantWarehouseRelationship[]
  statements: ServiceStatement[]
  disputes: ServiceDispute[]
  claims: ServiceClaim[]
  reviews: ServiceReview[]
  imports: OrderImportBatch[]
}

const defaultAgreementScopes: ServiceScope[] = ['INBOUND_RECEIVING', 'STORAGE', 'PICK_PACK', 'SHIPMENT_HANDOFF']

export function ServiceAccountabilityPage() {
  const { token, user } = useAuth()
  const [data, setData] = useState<ServiceData | null>(null)
  const [slaStatuses, setSlaStatuses] = useState<SlaStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [agreementRelationshipId, setAgreementRelationshipId] = useState('')
  const [agreementTitle, setAgreementTitle] = useState('Standard fulfillment terms')
  const [agreementEffectiveDate, setAgreementEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [agreementNotes, setAgreementNotes] = useState('Receiving, storage, pick-pack, and shipment handoff terms for connected fulfillment work.')
  const canUseOrderImport = user?.role === 'MERCHANT'
  const canRequestReview = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MERCHANT' || user?.role === 'WAREHOUSE_OPERATOR'
  const canDraftAgreement = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MERCHANT'
  const canAcceptAgreement = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_OPERATOR'

  const activeAgreement = useMemo(() => (
    data?.agreements.find((agreement) => agreement.status === 'ACTIVE') ?? null
  ), [data?.agreements])

  const load = useCallback(async () => {
    if (!token || !user) return
    await Promise.resolve()
    setLoading(true)
    setError('')
    try {
      const [agreements, relationships, statements, disputes, claims, reviews, imports] = await Promise.all([
        api.serviceAgreements(token),
        api.merchantWarehouseRelationships(token),
        api.serviceStatements(token),
        api.serviceDisputes(token),
        api.serviceClaims(token),
        api.serviceReviews(token),
        canUseOrderImport ? api.orderImports(token, user.tenantId) : Promise.resolve([]),
      ])
      const nextActiveAgreement = agreements.find((agreement) => agreement.status === 'ACTIVE') ?? agreements[0]
      const nextSlaStatuses = nextActiveAgreement ? await api.serviceSlaStatuses(token, nextActiveAgreement.id) : []
      setData({ agreements, relationships, statements, disputes, claims, reviews, imports })
      setAgreementRelationshipId((current) => current || (relationships.find((relationship) => relationship.status === 'ACTIVE')?.id ?? ''))
      setSlaStatuses(nextSlaStatuses)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load service accountability.')
    } finally {
      setLoading(false)
    }
  }, [token, user, canUseOrderImport])

  useEffect(() => {
    if (!token || !user) return
    Promise.all([
      api.serviceAgreements(token),
      api.merchantWarehouseRelationships(token),
      api.serviceStatements(token),
      api.serviceDisputes(token),
      api.serviceClaims(token),
      api.serviceReviews(token),
      canUseOrderImport ? api.orderImports(token, user.tenantId) : Promise.resolve([]),
    ])
      .then(async ([agreements, relationships, statements, disputes, claims, reviews, imports]) => {
        const nextActiveAgreement = agreements.find((agreement) => agreement.status === 'ACTIVE') ?? agreements[0]
        const nextSlaStatuses = nextActiveAgreement ? await api.serviceSlaStatuses(token, nextActiveAgreement.id) : []
        setData({ agreements, relationships, statements, disputes, claims, reviews, imports })
        setAgreementRelationshipId((current) => current || (relationships.find((relationship) => relationship.status === 'ACTIVE')?.id ?? ''))
        setSlaStatuses(nextSlaStatuses)
      })
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load service accountability.')
      })
      .finally(() => setLoading(false))
  }, [token, user, canUseOrderImport])

  async function handleRequestReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !activeAgreement) return
    setSubmitting(true)
    setError('')
    try {
      await api.createServiceReview(token, activeAgreement.id, {
        reviewType: 'MANUAL_ADJUSTMENT',
        reason: 'Manual service adjustment needs partner review',
        evidenceNote: 'Created from the service accountability page.',
      })
      setMessage('Review request created.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to create review request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !agreementRelationshipId) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await api.createServiceAgreement(token, {
        relationshipId: agreementRelationshipId,
        title: agreementTitle,
        effectiveDate: agreementEffectiveDate,
        renewalReviewDate: null,
        cancellationWindowDays: 30,
        serviceScopes: defaultAgreementScopes,
        serviceNotes: agreementNotes,
        rateCard: {
          coordinationFeePercent: 3,
          fixedCoordinationFee: 0,
        },
        slaPolicy: {
          receivingSlaHours: 24,
          pickPackSlaHours: 24,
          shipmentHandoffSlaHours: 24,
          exceptionResponseSlaHours: 24,
        },
      })
      setMessage('Agreement draft created.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to create service agreement.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateAgreementStatus(agreement: ServiceAgreement, action: 'propose' | 'accept') {
    if (!token) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      if (action === 'propose') {
        await api.proposeServiceAgreement(token, agreement.id)
        setMessage('Agreement proposed to the warehouse partner.')
      } else {
        await api.acceptServiceAgreement(token, agreement.id)
        setMessage('Agreement accepted and activated.')
      }
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to update service agreement.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState />
  if (error && !data) return <ErrorState title={error} />
  if (!data) return <EmptyState label="No service-accountability data available" guidance="Create service agreements before reviewing statements, SLA risk, or partner issues." />

  const openDisputes = data.disputes.filter((item) => item.status === 'OPEN').length
  const openClaims = data.claims.filter((item) => item.status === 'OPEN').length
  const pendingReviews = data.reviews.filter((item) => item.status === 'PENDING').length
  const activeRelationships = data.relationships.filter((relationship) => relationship.status === 'ACTIVE')
  const canCreateReview = canRequestReview && Boolean(activeAgreement)
  const canCreateAgreement = canDraftAgreement && activeRelationships.length > 0 && Boolean(agreementRelationshipId)
  const serviceAttentionSignals = [
    ...slaStatuses.map((status) => status.attentionSignal).filter((signal): signal is AttentionSignal => Boolean(signal)),
    ...data.disputes.filter((item) => item.status === 'OPEN').map((item) => serviceSignal(
      `service-dispute-${item.id}`,
      'ACTION_NEEDED',
      'Open service dispute',
      'A dispute is waiting for partner review and supporting evidence.',
      'ServiceDispute',
      item.id,
      item.createdAt,
    )),
    ...data.claims.filter((item) => item.status === 'OPEN').map((item) => serviceSignal(
      `service-claim-${item.id}`,
      'ACTION_NEEDED',
      'Open service claim',
      `${item.claimType.replaceAll('_', ' ')} claim is waiting for partner review.`,
      'ServiceClaim',
      item.id,
      item.createdAt,
    )),
    ...data.reviews.filter((item) => item.status === 'PENDING').map((item) => serviceSignal(
      `service-review-${item.id}`,
      'REVIEW',
      'Pending service review',
      `${item.reviewType.replaceAll('_', ' ')} review is waiting for a decision.`,
      'ServiceReviewRequest',
      item.id,
      item.createdAt,
    )),
  ]

  return (
    <div className="page-stack">
      <PageHeading
        title="Service Accountability"
        subtitle={canUseOrderImport
          ? 'Review partner terms, SLA risk, statements, service issues, and imports.'
          : 'Review partner terms, SLA risk, statements, and service issues.'}
      />
      <GuidancePanel title="Service accountability review">
        {canRequestReview && activeAgreement
          ? 'Start with open disputes, claims, and pending reviews. Request partner review from the active agreement.'
          : canRequestReview
            ? 'Start by creating or activating a service agreement; disputes, claims, reviews, and SLA records appear after partner work begins.'
          : 'Start with open disputes, claims, and pending reviews. This role reviews evidence without creating partner review work.'}
      </GuidancePanel>
      <AttentionQueue
        signals={serviceAttentionSignals}
        description="At-risk SLA records and unresolved service issues lead this page; agreements and statements remain below as supporting history."
        emptyLabel="No service accountability risks are active"
      />
      {error && <ErrorState title={error} />}
      {message ? <div className="inline-success">{message}</div> : null}

      <div className="metric-grid">
        <Metric label="Agreements" value={data.agreements.length} />
        <Metric label="Statements" value={data.statements.length} />
        <Metric label="Open disputes" value={openDisputes} />
        <Metric label="Open claims" value={openClaims} />
        <Metric label="Pending reviews" value={pendingReviews} />
        {canUseOrderImport && <Metric label="Imports" value={data.imports.length} />}
      </div>

      <section className="table-section">
        <div className="section-header">
          <h2>Agreement Terms</h2>
          {canCreateReview ? (
            <form onSubmit={handleRequestReview}>
              <button className="primary-button warning-button" type="submit" disabled={submitting}>
                Request review
              </button>
            </form>
          ) : canRequestReview ? (
            <span className="data-chip warning-chip">Agreement required</span>
          ) : (
            <span className="data-chip">Read-only evidence review</span>
          )}
        </div>
        {canDraftAgreement ? (
          <form className="panel-form" aria-label="Create service agreement form" onSubmit={handleCreateAgreement}>
            <h3>Record partner terms</h3>
            <p className="field-help">
              Draft terms against an active merchant-warehouse relationship, then propose them for warehouse acceptance.
            </p>
            {activeRelationships.length ? (
              <div className="form-grid">
                <label htmlFor="service-agreement-relationship">
                  <span>Relationship</span>
                  <select
                    id="service-agreement-relationship"
                    value={agreementRelationshipId}
                    onChange={(event) => setAgreementRelationshipId(event.target.value)}
                    required
                  >
                    {activeRelationships.map((relationship) => (
                      <option key={relationship.id} value={relationship.id}>
                        {relationship.merchantName} and {relationship.warehouseProviderName}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="service-agreement-title">
                  <span>Title</span>
                  <input
                    id="service-agreement-title"
                    value={agreementTitle}
                    onChange={(event) => setAgreementTitle(event.target.value)}
                    required
                  />
                </label>
                <label htmlFor="service-agreement-effective-date">
                  <span>Effective date</span>
                  <input
                    id="service-agreement-effective-date"
                    type="date"
                    value={agreementEffectiveDate}
                    onChange={(event) => setAgreementEffectiveDate(event.target.value)}
                    required
                  />
                </label>
                <label className="wide-field" htmlFor="service-agreement-notes">
                  <span>Notes</span>
                  <textarea
                    id="service-agreement-notes"
                    value={agreementNotes}
                    onChange={(event) => setAgreementNotes(event.target.value)}
                  />
                </label>
              </div>
            ) : (
              <span className="data-chip warning-chip">Activate a warehouse relationship before drafting terms.</span>
            )}
            {canCreateAgreement ? (
              <button className="primary-button fit-button" type="submit" disabled={submitting}>
                {submitting ? 'Creating agreement' : 'Create agreement draft'}
              </button>
            ) : null}
          </form>
        ) : null}
        {data.agreements.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agreement</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Scopes</th>
                  <th>Coordination fee</th>
                  <th>SLA</th>
                  <th>Notes</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {data.agreements.map((agreement) => (
                  <tr key={agreement.id}>
                    <td>{agreement.title}</td>
                    <td>{agreement.warehouseProviderName}</td>
                    <td><StatusBadge value={agreement.status} /></td>
                    <td><QuantityCell value={agreement.versionNumber} tone="neutral" /></td>
                    <td>
                      <div className="chip-list">
                        {agreement.serviceScopes.map((scope) => <span className="data-chip" key={scope}>{scope.replaceAll('_', ' ')}</span>)}
                      </div>
                    </td>
                    <td>{agreement.rateCard.coordinationFeePercent}% + {money(agreement.rateCard.fixedCoordinationFee)}</td>
                    <td>
                      <div className="chip-list">
                        <span className="data-chip">{agreement.slaPolicy.receivingSlaHours}h receiving</span>
                        <span className="data-chip">{agreement.slaPolicy.pickPackSlaHours}h pick/pack</span>
                        <span className="data-chip">{agreement.slaPolicy.shipmentHandoffSlaHours}h handoff</span>
                      </div>
                    </td>
                    <td className="note-cell">{agreement.serviceNotes ?? 'None'}</td>
                    <td>
                      {agreement.status === 'DRAFT' && canDraftAgreement ? (
                        <button className="table-button" type="button" onClick={() => void updateAgreementStatus(agreement, 'propose')}>
                          Propose terms
                        </button>
                      ) : agreement.status === 'PROPOSED' && canAcceptAgreement ? (
                        <button className="table-button" type="button" onClick={() => void updateAgreementStatus(agreement, 'accept')}>
                          Accept terms
                        </button>
                      ) : agreement.status === 'ACTIVE' ? (
                        <span className="data-chip">Active agreement</span>
                      ) : agreement.status === 'PROPOSED' ? (
                        <span className="data-chip warning-chip">Waiting for warehouse acceptance</span>
                      ) : (
                        <span className="data-chip">No agreement action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No service agreements yet" guidance="Create or activate a partner relationship, then record agreement terms." />
        )}
      </section>

      <section className="table-section">
        <h2>SLA Status</h2>
        {slaStatuses.length ? (
          <div className="status-row">
            {slaStatuses.map((status) => (
              <div className="status-count" key={`${status.sourceType}-${status.sourceId}`}>
                <StatusBadge value={status.status} />
                <span>{status.sourceType.replaceAll('_', ' ')}</span>
                <strong className={status.elapsedHours > status.targetHours ? 'data-chip warning-chip' : ''}>{status.elapsedHours}/{status.targetHours}h</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="No SLA records for the selected agreement" guidance="SLA records appear after service work starts under this agreement." />
        )}
      </section>

      <section className="table-section">
        <h2>Service Statements</h2>
        {data.statements.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Period</th>
                  <th>Due</th>
                  <th>Lines</th>
                  <th>Total</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.statements.map((statement) => (
                  <tr key={statement.id}>
                    <td><StatusBadge value={statement.status} /></td>
                    <td>{statement.periodStart} to {statement.periodEnd}</td>
                    <td>{statement.dueDate}</td>
                    <td><QuantityCell value={statement.lines.length} tone="ready" /></td>
                    <td>{money(statement.totalAmount)}</td>
                    <td className="note-cell">{statement.note ?? 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No service statements yet" guidance="Statements appear after a service period closes." />
        )}
      </section>

      <section className="table-section">
        <h2>Disputes, Claims, Reviews</h2>
        <IssueTable disputes={data.disputes} claims={data.claims} reviews={data.reviews} />
      </section>

      {canUseOrderImport && (
        <section className="table-section">
          <h2>Order Import History</h2>
          {data.imports.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Rejected</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {data.imports.map((batch) => (
                    <tr key={batch.id}>
                      <td>{batch.sourceLabel}</td>
                      <td><StatusBadge value={batch.status} /></td>
                      <td><QuantityCell value={batch.createdRows} tone={batch.createdRows > 0 ? 'ready' : 'neutral'} /></td>
                      <td><QuantityCell value={batch.rejectedRows} tone={batch.rejectedRows > 0 ? 'risk' : 'neutral'} /></td>
                      <td className="note-cell">{batch.createdRows} created from {batch.totalRows} rows on {batch.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No import batches yet" guidance="Import history appears after order-intake files are submitted." />
          )}
        </section>
      )}
    </div>
  )
}

function IssueTable({
  disputes,
  claims,
  reviews,
}: {
  disputes: ServiceDispute[]
  claims: ServiceClaim[]
  reviews: ServiceReview[]
}) {
  const rows = [
    ...disputes.map((item) => ({
      id: item.id,
      type: 'Dispute',
      status: item.status,
      reason: item.reason,
      evidence: item.evidenceNote,
      outcome: item.outcomeNote,
    })),
    ...claims.map((item) => ({
      id: item.id,
      type: `Claim ${item.claimType}`,
      status: item.status,
      reason: item.reason,
      evidence: item.evidenceNote,
      outcome: item.outcomeNote,
    })),
    ...reviews.map((item) => ({
      id: item.id,
      type: `Review ${item.reviewType}`,
      status: item.status,
      reason: item.reason,
      evidence: item.evidenceNote,
      outcome: item.outcomeNote,
    })),
  ]
  if (!rows.length) return <EmptyState label="No review records yet" guidance="Partner issues appear here when disputes, claims, or reviews are opened." />

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Evidence</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="name-cell">{row.type.replaceAll('_', ' ')}</td>
              <td><StatusBadge value={row.status} /></td>
              <td className="note-cell">{row.reason}</td>
              <td className="note-cell">{row.evidence ?? 'No evidence note'}</td>
              <td className="note-cell">{row.outcome ?? 'Open'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PageHeading({ title, subtitle }: { title: string, subtitle: string }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

function money(value: number) {
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} service units`
}

function serviceSignal(
  id: string,
  severity: AttentionSignal['severity'],
  title: string,
  body: string,
  sourceType: string,
  sourceId: string,
  createdAt: string,
): AttentionSignal {
  return {
    id,
    severity,
    title,
    body,
    ownerRole: 'MERCHANT',
    nextActionLabel: 'Review service record',
    route: '/service-accountability',
    sourceType,
    sourceId,
    createdAt,
    resolved: false,
  }
}
