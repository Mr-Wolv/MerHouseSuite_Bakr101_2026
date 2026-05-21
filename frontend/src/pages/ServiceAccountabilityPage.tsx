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
  if (!data) return <EmptyState label="No service-accountability data available" />

  const openIssues = data.disputes.filter((item) => item.status === 'OPEN').length
    + data.claims.filter((item) => item.status === 'OPEN').length
    + data.reviews.filter((item) => item.status === 'PENDING').length

  return (
    <div className="page-stack">
      <PageHeading
        title="Service Accountability"
        subtitle={canUseOrderImport
          ? 'Merchant-provider terms, service records, SLA review, and order import history.'
          : 'Merchant-provider terms, service records, and SLA review.'}
      />
      {error && <ErrorState title={error} />}
      {message ? <div className="inline-success">{message}</div> : null}

      <div className="metric-grid">
        <Metric label="Agreements" value={data.agreements.length} />
        <Metric label="Statements" value={data.statements.length} />
        <Metric label="Open reviews" value={openIssues} />
        {canUseOrderImport && <Metric label="Imports" value={data.imports.length} />}
      </div>

      <section className="table-section">
        <div className="section-header">
          <h2>Agreement Terms</h2>
          <form onSubmit={handleRequestReview}>
            <button className="primary-button" type="submit" disabled={!activeAgreement || submitting}>
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
                  <th>Coordination fee</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {data.agreements.map((agreement) => (
                  <tr key={agreement.id}>
                    <td>{agreement.title}</td>
                    <td>{agreement.warehouseProviderName}</td>
                    <td><StatusBadge value={agreement.status} /></td>
                    <td>{agreement.rateCard.coordinationFeePercent}% + {money(agreement.rateCard.fixedCoordinationFee)}</td>
                    <td>{agreement.slaPolicy.receivingSlaHours}h receiving</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No service agreements yet" />
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
                <strong>{status.elapsedHours}/{status.targetHours}h</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="No SLA records for the selected agreement" />
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
                  <th>Lines</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.statements.map((statement) => (
                  <tr key={statement.id}>
                    <td><StatusBadge value={statement.status} /></td>
                    <td>{statement.periodStart} to {statement.periodEnd}</td>
                    <td>{statement.lines.length}</td>
                    <td>{money(statement.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No service statements yet" />
        )}
      </section>

      <section className="table-section">
        <h2>Disputes, Claims, Reviews</h2>
        <div className="status-row">
          {data.disputes.slice(0, 3).map((item) => <IssuePill key={item.id} label={item.reason} status={item.status} />)}
          {data.claims.slice(0, 3).map((item) => <IssuePill key={item.id} label={item.claimType} status={item.status} />)}
          {data.reviews.slice(0, 3).map((item) => <IssuePill key={item.id} label={item.reviewType} status={item.status} />)}
        </div>
        {!data.disputes.length && !data.claims.length && !data.reviews.length && <EmptyState label="No review records yet" />}
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
                  </tr>
                </thead>
                <tbody>
                  {data.imports.map((batch) => (
                    <tr key={batch.id}>
                      <td>{batch.sourceLabel}</td>
                      <td><StatusBadge value={batch.status} /></td>
                      <td>{batch.createdRows}</td>
                      <td>{batch.rejectedRows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No import batches yet" />
          )}
        </section>
      )}
    </div>
  )
}

function IssuePill({ label, status }: { label: string, status: string }) {
  return (
    <div className="status-count">
      <StatusBadge value={status} />
      <span>{label}</span>
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
