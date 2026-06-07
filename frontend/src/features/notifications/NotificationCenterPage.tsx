import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Check, CircleCheck, Info, RefreshCcw, TriangleAlert } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import type {
  NotificationDelivery,
  NotificationPreference,
} from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import { GuidancePanel } from '../../components/PageChrome'
import { StatusBadge } from '../../components/StatusBadge'
import { statusAccessibleLabel, statusExplanation } from '../../components/StatusLanguage'
import {
  channelLabels,
  deliveryStageLabels,
  displayDeliveryBody,
  notificationSeverity,
  notificationSourceHref,
  providerStatusLabels,
  severityLabels,
  shortNotificationSourceId,
  topicLabels,
} from './display'
import type { NotificationSeverity } from './display'
import { notifyUnreadChanged } from '../../notifications/notificationEvents'

function notificationSeverityIcon(severity: NotificationSeverity) {
  if (severity === 'critical') return TriangleAlert
  if (severity === 'action') return BellRing
  if (severity === 'cleared') return CircleCheck
  return Info
}

export function NotificationCenterPage() {
  const { token } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async (showLoading = true) => {
    if (!token) return
    if (showLoading) {
      setLoading(true)
    }
    setError(null)
    try {
      const [nextPreferences, nextDeliveries] = await Promise.all([
        api.notificationPreferences(token),
        api.notificationDeliveries(token, 50),
      ])
      setPreferences(nextPreferences)
      setDeliveries(nextDeliveries)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    const interval = window.setInterval(() => {
      void load(false)
    }, 15000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [load])

  const unreadCount = useMemo(
    () => deliveries.filter((delivery) => delivery.status === 'RECORDED' && !delivery.readAt).length,
    [deliveries],
  )
  const enabledPreferences = useMemo(
    () => preferences.filter((preference) => preference.enabled).length,
    [preferences],
  )
  const providerReadyCount = useMemo(
    () => deliveries.filter((delivery) => delivery.providerStatus === 'READY_FOR_PROVIDER').length,
    [deliveries],
  )
  const severityCounts = useMemo(() => {
    return deliveries.reduce(
      (counts, delivery) => {
        counts[notificationSeverity(delivery)] += 1
        return counts
      },
      { critical: 0, action: 0, review: 0, cleared: 0 } satisfies Record<NotificationSeverity, number>,
    )
  }, [deliveries])
  const actionableCount = severityCounts.critical + severityCounts.action

  async function togglePreference(preference: NotificationPreference) {
    if (!token) return
    setBusyKey(preference.id)
    setError(null)
    setMessage(null)
    try {
      const updated = await api.updateNotificationPreference(token, {
        topic: preference.topic,
        channel: preference.channel,
        enabled: !preference.enabled,
      })
      setPreferences((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setMessage(`${topicLabels[updated.topic]} ${channelLabels[updated.channel].toLowerCase()} updated.`)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to update preference.')
    } finally {
      setBusyKey(null)
    }
  }

  async function markRead(delivery: NotificationDelivery) {
    if (!token) return
    setBusyKey(delivery.id)
    setError(null)
    setMessage(null)
    try {
      const updated = await api.markNotificationRead(token, delivery.id)
      setDeliveries((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      if (delivery.status === 'RECORDED' && !delivery.readAt && (updated.status === 'READ' || updated.readAt)) {
        notifyUnreadChanged(-1)
      }
      setMessage('Notification marked read.')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to mark notification read.')
    } finally {
      setBusyKey(null)
    }
  }

  if (loading) return <LoadingState label="Loading notifications" />

  return (
    <div className="page-stack">
      <div className="page-heading">
        <span className="eyebrow">Alert center</span>
        <h1>Notifications</h1>
        <p>Review alerts that may need action. Cleared history stays available below.</p>
      </div>
      <GuidancePanel title="Alert rules">
        Start with the inbox. Preferences stay below when channels need tuning.
      </GuidancePanel>

      {error ? <ErrorState title={error} /> : null}
      {message ? <div className="inline-success">{message}</div> : null}

      <section className="metric-grid" aria-label="Notification summary">
        <div className="metric">
          <span>Unread</span>
          <strong>{unreadCount}</strong>
        </div>
        <div className="metric">
          <span>Action needed</span>
          <strong>{actionableCount}</strong>
        </div>
        <div className="metric">
          <span>Enabled preferences</span>
          <strong>{enabledPreferences}/{preferences.length}</strong>
        </div>
        <div className="metric">
          <span>Provider handoffs</span>
          <strong>{providerReadyCount}</strong>
        </div>
      </section>

      <section className="table-section">
        <div className="table-toolbar">
          <h2>Alert inbox</h2>
          <span>{deliveries.length} records</span>
        </div>
        {deliveries.length ? (
          <div className="queue-list">
            {deliveries.map((delivery) => {
              const canMarkRead = delivery.status === 'RECORDED' && !delivery.readAt
              const severity = notificationSeverity(delivery)
              const Icon = notificationSeverityIcon(severity)
              const sourceHref = notificationSourceHref(delivery)
              return (
                <article className={`queue-card notification-card notification-${severity}`} key={delivery.id}>
                  <div className="queue-card-header">
                    <div className="queue-card-title">
                      <Icon size={18} aria-hidden="true" />
                      <strong>{delivery.title}</strong>
                      <StatusBadge value={delivery.status} />
                      {canMarkRead ? <span className="data-chip warning-chip">Unread</span> : <span className="data-chip">Read</span>}
                    </div>
                    <div className="queue-card-meta">
                      <span className={`data-chip severity-chip severity-${severity}`}>
                        {severityLabels[severity]}
                      </span>
                      <span className="data-chip">{topicLabels[delivery.topic]}</span>
                    </div>
                  </div>
                  <p className="note-cell">{displayDeliveryBody(delivery.body)}</p>
                  <div className="action-row">
                    <span className="data-chip">{channelLabels[delivery.channel]}</span>
                    <span
                      className="data-chip"
                      aria-label={statusAccessibleLabel(delivery.deliveryStage)}
                      title={statusExplanation(delivery.deliveryStage)}
                    >
                      {deliveryStageLabels[delivery.deliveryStage]}
                    </span>
                    <span
                      className={delivery.providerStatus === 'READY_FOR_PROVIDER' ? 'data-chip warning-chip' : 'data-chip'}
                      aria-label={statusAccessibleLabel(delivery.providerStatus)}
                      title={statusExplanation(delivery.providerStatus)}
                    >
                      {providerStatusLabels[delivery.providerStatus]}
                    </span>
                    <span className="data-chip">{new Date(delivery.createdAt).toLocaleString()}</span>
                    {delivery.sourceType ? <span className="data-chip">{delivery.sourceType}</span> : null}
                    {delivery.sourceId ? <span className="data-chip mono-cell">{shortNotificationSourceId(delivery.sourceId)}</span> : null}
                    {sourceHref ? (
                      <Link className="table-button text-link" to={sourceHref}>
                        Open source
                      </Link>
                    ) : null}
                    <button
                      className="table-button"
                      type="button"
                      disabled={!canMarkRead || busyKey === delivery.id}
                      onClick={() => void markRead(delivery)}
                    >
                      <Check size={15} aria-hidden="true" />
                      {delivery.readAt ? 'Read' : 'Mark read'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            label="No alerts yet"
            guidance="New account, operations, service, or outbox alerts will appear here. Keep only the channels you own enabled."
          />
        )}
      </section>

      <section className="table-section">
        <div className="table-toolbar">
          <h2>Preferences</h2>
          <button className="icon-text-button" type="button" onClick={() => void load()}>
            <RefreshCcw size={16} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((preference) => (
                <tr key={preference.id}>
                  <td>{topicLabels[preference.topic]}</td>
                  <td>{channelLabels[preference.channel]}</td>
                  <td><StatusBadge value={preference.enabled ? 'enabled' : 'disabled'} /></td>
                  <td><span className="timestamp-cell">{new Date(preference.updatedAt).toLocaleString()}</span></td>
                  <td>
                    <button
                      className={preference.enabled ? 'table-button warning-button' : 'table-button'}
                      type="button"
                      disabled={busyKey === preference.id}
                      onClick={() => void togglePreference(preference)}
                    >
                      {preference.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

