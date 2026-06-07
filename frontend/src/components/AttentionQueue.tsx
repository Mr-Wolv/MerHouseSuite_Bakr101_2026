import type { AttentionSignal } from '../api/types'
import { appIcons } from './AppIcons'
import { formatDateTime, shortId } from './format'

const severityLabel: Record<AttentionSignal['severity'], string> = {
  CRITICAL: 'Critical',
  ACTION_NEEDED: 'Action needed',
  REVIEW: 'Review',
  CLEARED: 'Cleared',
}

export function AttentionQueue({
  title = 'Needs Attention First',
  description,
  signals = [],
  emptyLabel = 'No active attention signals',
}: {
  title?: string
  description?: string
  signals?: AttentionSignal[]
  emptyLabel?: string
}) {
  const activeSignals = signals.filter((signal) => !signal.resolved)
  const resolvedSignals = signals.filter((signal) => signal.resolved)
  const AlertIcon = appIcons.alertsActive

  return (
    <section className="attention-queue" aria-label={title}>
      <div className="section-heading-row">
        <h2>{title}</h2>
        <span>{activeSignals.length} active</span>
      </div>
      {description ? <p className="section-description">{description}</p> : null}
      {activeSignals.length ? (
        <div className="attention-list">
          {activeSignals.map((signal) => (
            <article className={`attention-signal attention-${signal.severity.toLowerCase().replace('_', '-')}`} key={signal.id}>
              <div className="attention-icon" aria-hidden="true">
                <AlertIcon size={18} />
              </div>
              <div className="attention-body">
                <div className="attention-meta">
                  <span className="data-chip">{severityLabel[signal.severity]}</span>
                  <span className="data-chip">Owner: {signal.ownerRole.replaceAll('_', ' ')}</span>
                  {signal.sourceType ? <span className="data-chip">{signal.sourceType}{signal.sourceId ? ` ${shortId(signal.sourceId)}` : ''}</span> : null}
                </div>
                <h3>{signal.title}</h3>
                <p>{signal.body}</p>
                <div className="attention-actions">
                  <a className="text-link" href={signal.route}>{signal.nextActionLabel}</a>
                  <span>{formatDateTime(signal.createdAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="attention-empty">
          <AlertIcon size={18} aria-hidden="true" />
          <span>{emptyLabel}</span>
        </div>
      )}
      {resolvedSignals.length ? (
        <div className="attention-resolved" aria-label="Resolved attention history">
          <span>Resolved or history</span>
          <strong>{resolvedSignals.length}</strong>
        </div>
      ) : null}
    </section>
  )
}
