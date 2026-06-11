import { useEffect, useState } from 'react'
import { api, ApiError } from '../../../api/client'
import type { AdminAuditEvent } from '../../../api/types'
import { useAuth } from '../../../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../../../components/DataState'
import { shortId } from '../../../components/format'
import { Metric } from '../../../components/Metric'
import { GuidancePanel, PageHeading } from '../../../components/PageChrome'
import { StatusBadge } from '../../../components/StatusBadge'

export function AdminAuditPage() {
  const { token } = useAuth()
  const [events, setEvents] = useState<AdminAuditEvent[]>([])
  const [filter, setFilter] = useState<'ALL' | 'ASSISTANT'>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.adminAuditEvents(token)
      .then(setEvents)
      .catch((caught) => setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load audit events.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <LoadingState label="Loading admin audit events" />

  const assistantEvents = events.filter((event) => event.action.startsWith('ASSISTANT_'))
  const assistantCounts = {
    summaries: assistantEvents.filter((event) => event.action === 'ASSISTANT_SUMMARY').length,
    suggestions: assistantEvents.filter((event) => event.action === 'ASSISTANT_SUGGESTION').length,
    refusals: assistantEvents.filter((event) => event.action === 'ASSISTANT_REFUSAL').length,
    accepted: assistantEvents.filter((event) => event.action === 'ASSISTANT_SUGGESTION_ACCEPTED').length,
    rejected: assistantEvents.filter((event) => event.action === 'ASSISTANT_SUGGESTION_REJECTED').length,
  }
  const visibleEvents = filter === 'ASSISTANT' ? assistantEvents : events

  return (
    <div className="page-stack">
      <PageHeading title="Admin Audit" subtitle="Review privileged platform actions, reasons, actors, and affected records." />
      {error ? <ErrorState title={error} /> : null}
      <section className="metric-grid" aria-label="Assistant audit summary">
        <Metric label="Assistant summaries" value={assistantCounts.summaries} />
        <Metric label="Assistant suggestions" value={assistantCounts.suggestions} />
        <Metric label="Assistant refusals" value={assistantCounts.refusals} />
        <Metric label="Suggestions accepted" value={assistantCounts.accepted} />
        <Metric label="Suggestions rejected" value={assistantCounts.rejected} />
      </section>
      <section className="table-section">
        <GuidancePanel title="Audit review lens">
          Use the assistant filter to isolate summaries, suggestions, refusals, and review decisions without losing the broader privileged-action trail.
        </GuidancePanel>
        <div className="table-toolbar">
          <h2>Recent Privileged Actions</h2>
          <div className="compact-field">
            <label htmlFor="admin-audit-filter">Audit filter</label>
            <select id="admin-audit-filter" value={filter} onChange={(event) => setFilter(event.target.value as 'ALL' | 'ASSISTANT')}>
              <option value="ALL">All events</option>
              <option value="ASSISTANT">Assistant events</option>
            </select>
          </div>
        </div>
        <div className="status-narration" role="status" aria-live="polite">
          Showing {visibleEvents.length} {filter === 'ASSISTANT' ? 'assistant audit' : 'audit'} events. Focus the table region to scroll dense records with the keyboard on narrow screens.
        </div>
        {visibleEvents.length ? (
          <div className="table-wrap keyboard-scroll-region" tabIndex={0} aria-label="Scrollable admin audit table">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Record</th>
                  <th>Reason</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={event.id}>
                    <td><StatusBadge value={event.action} /></td>
                    <td>{event.actorEmail ?? 'System'}</td>
                    <td>{event.aggregateType} <span className="mono-cell">{shortId(event.aggregateId)}</span></td>
                    <td className="note-cell">{event.reason ?? 'No reason recorded'}</td>
                    <td><TimestampCell value={event.createdAt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No admin audit events yet" guidance="Privileged account, tenant, relationship, assistant, and diagnostic actions will appear here for review." />
        )}
      </section>
    </div>
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
