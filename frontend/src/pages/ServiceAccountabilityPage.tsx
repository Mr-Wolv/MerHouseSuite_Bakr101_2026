import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type {
  OrderImportBatch,
  ServiceAgreement,
  ServiceClaim,
  ServiceDispute,
  ServiceReview,
  ServiceStatement,
  SlaStatus,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { Metric } from '../components/Metric'
import { GuidancePanel, QuantityCell } from '../components/PageChrome'
import { StatusBadge } from '../components/StatusBadge'

type ServiceData = {
  agreements: ServiceAgreement[]
  statements: ServiceStatement[]
  disputes: ServiceDispute[]
  claims: ServiceClaim[]
  reviews: ServiceReview[]
  imports: OrderImportBatch[]
}

export function ServiceAccountabilityPage() {
  const { token, user } = useAuth()
  const [data, setData] = useState<ServiceData | null>(null)
  const [slaStatuses, setSlaStatuses] = useState<SlaStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canUseOrderImport = user?.role === 'MERCHANT'

  const activeAgreement = useMemo(() => (
    data?.agreements.find((agreement) => agreement.status === 'ACTIVE') ?? data?.agreements[0]
  ), [data?.agreements])

  const load = useCallback(async () => {
    if (!token || !user) return
    await Promise.resolve()
    setLoading(true)
    setError('')
    try {
      const [agreements, statements, disputes, claims, reviews, imports] = await Promise.all([
        api.serviceAgreements(token),
        api.serviceStatements(token),
        api.serviceDisputes(token),
        api.serviceClaims(token),
        api.serviceReviews(token),
        canUseOrderImport ? api.orderImports(token, user.tenantId) : Promise.resolve([]),
      ])
      const nextActiveAgreement = agreements.find((agreement) => agreement.status === 'ACTIVE') ?? agreements[0]
      const nextSlaStatuses = nextActiveAgreement ? await api.serviceSlaStatuses(token, nextActiveAgreement.id) : []
      setData({ agreements, statements, disputes, claims, reviews, imports })
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
      api.serviceStatements(token),
      api.serviceDisputes(token),
      api.serviceClaims(token),
      api.serviceReviews(token),
      canUseOrderImport ? api.orderImports(token, user.tenantId) : Promise.resolve([]),
    ])
      .then(async ([agreements, statements, disputes, claims, reviews, imports]) => {
        const nextActiveAgreement = agreements.find((agreement) => agreement.status === 'ACTIVE') ?? agreements[0]
        const nextSlaStatuses = nextActiveAgreement ? await api.serviceSlaStatuses(token, nextActiveAgreement.id) : []
        setData({ agreements, statements, disputes, claims, reviews, imports })
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

  if (loading) return <LoadingState />
  if (error && !data) return <ErrorState title={error} />
  if (!data) return <EmptyState label="No service-accountability data available" guidance="Create service agreements before reviewing statements, SLA risk, or partner issues." />

  const openDisputes = data.disputes.filter((item) => item.status === 'OPEN').length
  const openClaims = data.claims.filter((item) => item.status === 'OPEN').length
  const pendingReviews = data.reviews.filter((item) => item.status === 'PENDING').length

  return (
    <div className="page-stack">
      <PageHeading
        title="Service Accountability"
        subtitle={canUseOrderImport
          ? 'Review partner terms, SLA risk, statements, service issues, and imports.'
          : 'Review partner terms, SLA risk, statements, and service issues.'}
      />
      <GuidancePanel title="Service accountability review">
        Start with open disputes, claims, and pending reviews. Request partner review from the active agreement.
      </GuidancePanel>
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
          <form onSubmit={handleRequestReview}>
            <button className="primary-button warning-button" type="submit" disabled={!activeAgreement || submitting}>
              Request review
            </button>
          </form>
        </div>
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
