import { useEffect, useState } from 'react'
import { api, ApiError } from '../../../api/client'
import type { CarrierDispatch, OutboxEvent, OutboxProcessResponse, OutboxSummary } from '../../../api/types'
import { useAuth } from '../../../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../../../components/DataState'
import { shortId } from '../../../components/format'
import { Metric } from '../../../components/Metric'
import { PageHeading } from '../../../components/PageChrome'
import { StatusBadge } from '../../../components/StatusBadge'
import { AttentionQueue } from '../../../components/AttentionQueue'

export function AdminOutboxPage() {
  const { token, user: currentUser } = useAuth()
  const [summary, setSummary] = useState<OutboxSummary | null>(null)
  const [events, setEvents] = useState<OutboxEvent[]>([])
  const [dispatches, setDispatches] = useState<CarrierDispatch[]>([])
  const [result, setResult] = useState<OutboxProcessResponse | null>(null)
  const [reason, setReason] = useState('Background work review')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const canMutatePlatform = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN'

  async function refreshOutbox() {
    if (!token) return
    setRefreshing(true)
    setError('')
    try {
      const [nextSummary, nextEvents, nextDispatches] = await Promise.all([
        api.outboxSummary(token),
        api.outboxEvents(token),
        api.carrierDispatches(token),
      ])
      setSummary(nextSummary)
      setEvents(nextEvents)
      setDispatches(nextDispatches)
      setLastRefreshedAt(new Date().toISOString())
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load outbox data.')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshOutbox()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function processOutbox() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      setResult(await api.processOutbox(token))
      await refreshOutbox()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to process outbox.')
    } finally {
      setLoading(false)
    }
  }

  async function retryEvent(eventId: string) {
    if (!token) return
    setError('')
    try {
      const updated = await api.retryOutboxEvent(token, eventId)
      setEvents((current) => current.map((event) => (event.id === updated.id ? updated : event)))
      await refreshOutbox()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to retry outbox event.')
    }
  }

  async function deadLetterEvent(eventId: string) {
    if (!token) return
    setError('')
    try {
      const updated = await api.deadLetterOutboxEvent(token, eventId, { reason })
      setEvents((current) => current.map((event) => (event.id === updated.id ? updated : event)))
      await refreshOutbox()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to move outbox event.')
    }
  }

  return (
    <div className="page-stack">
      <PageHeading title="Outbox" subtitle="Monitor side-effect events, retries, and carrier dispatch records." />
      {summary ? (
        <AttentionQueue
          signals={summary.attentionSignals}
          description="Failed and retryable work is shown before processed history and carrier diagnostics."
          emptyLabel="No reliability work is waiting"
        />
      ) : null}
      <div className="admin-action-panel">
        <div className="admin-action-copy">
          <h2>Diagnostic actions</h2>
          <p>Processing and dead-letter moves are local reliability controls. Dead-letter actions keep the reason below with the event trail.</p>
        </div>
        <div className="admin-action-controls">
          {canMutatePlatform ? (
            <button className="primary-button fit-button" type="button" onClick={processOutbox} disabled={loading}>
              {loading ? 'Processing' : 'Process outbox'}
            </button>
          ) : (
            <span className="data-chip warning-chip">Owner/admin action</span>
          )}
          <button className="icon-text-button" type="button" onClick={refreshOutbox} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
          <label className="inline-field" htmlFor="admin-outbox-action-reason">
            <span>Reason</span>
            <input id="admin-outbox-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
          </label>
        </div>
      </div>
      <div className="status-narration" role="status" aria-live="polite">
        {refreshing ? 'Refreshing outbox data.' : lastRefreshedAt ? `Outbox data refreshed ${formatDate(lastRefreshedAt)}.` : 'Outbox data has not refreshed yet.'}
      </div>
      {error ? <ErrorState title={error} /> : null}
      {summary ? (
        <div className="metric-grid">
          <Metric label="Pending" value={summary.pending} />
          <Metric label="Processed" value={summary.processed} />
          <Metric label="Failed" value={summary.failed} />
          <Metric label="Retryable failed" value={summary.retryableFailed} />
        </div>
      ) : refreshing ? (
        <LoadingState label="Loading outbox health" />
      ) : null}
      {summary ? (
        <div className={summary.failed || summary.retryableFailed ? 'severity-panel risk-card' : 'severity-panel'} aria-label="Outbox severity hierarchy">
          <strong>{summary.failed || summary.retryableFailed ? 'Attention required' : 'Outbox healthy'}</strong>
          <span>{summary.retryableFailed} retryable failed events and {summary.failed} total failed events.</span>
        </div>
      ) : null}
      {result ? (
        <div className="state-panel">
          Processed {result.processed} events with {result.failed} failures.
        </div>
      ) : null}
      <OutboxEventsTable
        events={[...events].sort((left, right) => Number(right.status === 'FAILED') - Number(left.status === 'FAILED'))}
        onRetry={canMutatePlatform ? retryEvent : undefined}
        onDeadLetter={canMutatePlatform ? deadLetterEvent : undefined}
      />
      <CarrierDispatchesTable dispatches={dispatches} />
    </div>
  )
}

function OutboxEventsTable({
  events,
  onRetry,
  onDeadLetter,
}: {
  events: OutboxEvent[]
  onRetry?: (eventId: string) => void
  onDeadLetter?: (eventId: string) => void
}) {
  return (
    <section className="table-section">
      <h2>Recent Events</h2>
      {events.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Aggregate</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Failure detail</th>
                <th>Created</th>
                <th>Next attempt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const canRetry = event.status === 'FAILED' && Boolean(onRetry)
                const canDeadLetter = event.status === 'FAILED' && Boolean(onDeadLetter)
                const hasOwnerAction = canRetry || canDeadLetter
                return (
                  <tr key={event.id}>
                    <td>{event.eventType}</td>
                    <td>{event.aggregateType} <span className="mono-cell">{shortId(event.aggregateId)}</span></td>
                    <td><StatusBadge value={event.status} /></td>
                    <td><span className={event.attempts > 1 ? 'quantity-cell quantity-pending' : 'quantity-cell'}>{event.attempts}</span></td>
                    <td className="note-cell">{event.lastError ?? 'No failure recorded'}</td>
                    <td><TimestampCell value={event.createdAt} /></td>
                    <td>{event.nextAttemptAt ? <TimestampCell value={event.nextAttemptAt} /> : 'Not scheduled'}</td>
                    <td>
                      {onRetry || onDeadLetter ? (
                        <div className="action-row compact-actions">
                          {canRetry ? (
                            <button className="table-button" type="button" onClick={() => onRetry?.(event.id)}>
                              Retry
                            </button>
                          ) : null}
                          {canDeadLetter ? (
                            <button className="table-button destructive-button" type="button" onClick={() => onDeadLetter?.(event.id)}>
                              Dead-letter
                            </button>
                          ) : null}
                          {!hasOwnerAction ? <span className="data-chip">{outboxActionStateLabel(event.status)}</span> : null}
                        </div>
                      ) : (
                        <span className="data-chip">Read-only diagnostics</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label="No outbox events yet" guidance="Outbox events appear when operational changes need side-effect processing. Use this area to watch retries, failures, and dispatch handoffs." />
      )}
    </section>
  )
}

function outboxActionStateLabel(status: OutboxEvent['status']) {
  switch (status) {
    case 'PENDING':
      return 'Awaiting processing'
    case 'PROCESSED':
      return 'Processed'
    case 'DEAD_LETTER':
      return 'Dead-lettered'
    default:
      return 'No event action'
  }
}

function CarrierDispatchesTable({ dispatches }: { dispatches: CarrierDispatch[] }) {
  return (
    <section className="table-section">
      <h2>Carrier Dispatches</h2>
      {dispatches.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Carrier</th>
                <th>Tracking</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((dispatch) => (
                <tr key={dispatch.id}>
                  <td>{dispatch.eventType}</td>
                  <td>{dispatch.carrier ?? 'Unknown'}</td>
                  <td>{dispatch.trackingNumber ?? 'None'}</td>
                  <td><StatusBadge value={dispatch.status} /></td>
                  <td className="mono-cell">{dispatch.externalReference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label="No carrier dispatches yet" guidance="Carrier dispatch evidence appears after warehouse shipment handoff work begins." />
      )}
    </section>
  )
}

function TimestampCell({ value }: { value: string }) {
  return (
    <time className="timestamp-cell" dateTime={value}>
      {formatDate(value)}
    </time>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
