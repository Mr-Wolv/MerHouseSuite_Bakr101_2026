import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Check, CircleCheck, Info, ListPlus, RefreshCcw, TriangleAlert } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import type {
  NotificationDelivery,
  NotificationPreference,
  NotificationSummary,
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

const DELIVERY_PAGE_SIZE = 50

function appendUniqueDeliveries(
  current: NotificationDelivery[],
  next: NotificationDelivery[],
) {
  const seen = new Set(current.map((delivery) => delivery.id))
  return [
    ...current,
    ...next.filter((delivery) => {
      if (seen.has(delivery.id)) return false
      seen.add(delivery.id)
      return true
    }),
  ]
}

function notificationSeverityIcon(severity: NotificationSeverity) {
  if (severity === 'critical') return TriangleAlert
  if (severity === 'action') return BellRing
  if (severity === 'cleared') return CircleCheck
  return Info
}

export function NotificationCenterPage() {
  const { token } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [actionDeliveries, setActionDeliveries] = useState<NotificationDelivery[]>([])
  const [deliveryHistory, setDeliveryHistory] = useState<NotificationDelivery[]>([])
  const [summary, setSummary] = useState<NotificationSummary | null>(null)
  const [actionPage, setActionPage] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [actionHasMore, setActionHasMore] = useState(false)
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState<'actions' | 'history' | null>(null)

  const load = useCallback(async (showLoading = true) => {
    if (!token) return
    if (showLoading) {
      setLoading(true)
    }
    setError(null)
    try {
      const [nextPreferences, nextActionDeliveries, nextDeliveries, nextSummary] = await Promise.all([
        api.notificationPreferences(token),
        api.notificationDeliveries(token, DELIVERY_PAGE_SIZE, 'RECORDED'),
        api.notificationDeliveries(token, DELIVERY_PAGE_SIZE),
        api.notificationSummary(token),
      ])
      setPreferences(nextPreferences)
      setActionDeliveries(nextActionDeliveries)
      setDeliveryHistory(nextDeliveries)
      setSummary(nextSummary)
      setActionPage(0)
      setHistoryPage(0)
      setActionHasMore(nextActionDeliveries.length === DELIVERY_PAGE_SIZE && nextActionDeliveries.length < nextSummary.unreadCount)
      setHistoryHasMore(nextDeliveries.length === DELIVERY_PAGE_SIZE)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [token])

  async function loadMoreActions() {
    if (!token || !summary) return
    const nextPage = actionPage + 1
    setLoadingMore('actions')
    setError(null)
    setMessage(null)
    try {
      const nextDeliveries = await api.notificationDeliveries(token, DELIVERY_PAGE_SIZE, 'RECORDED', nextPage)
      setActionDeliveries((current) => {
        const merged = appendUniqueDeliveries(current, nextDeliveries)
        setActionHasMore(nextDeliveries.length === DELIVERY_PAGE_SIZE && merged.length < summary.unreadCount)
        return merged
      })
      setActionPage(nextPage)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load more alerts.')
    } finally {
      setLoadingMore(null)
    }
  }

  async function loadMoreHistory() {
    if (!token) return
    const nextPage = historyPage + 1
    setLoadingMore('history')
    setError(null)
    setMessage(null)
    try {
      const nextDeliveries = await api.notificationDeliveries(token, DELIVERY_PAGE_SIZE, undefined, nextPage)
      setDeliveryHistory((current) => appendUniqueDeliveries(current, nextDeliveries))
      setHistoryHasMore(nextDeliveries.length === DELIVERY_PAGE_SIZE)
      setHistoryPage(nextPage)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load more delivery history.')
    } finally {
      setLoadingMore(null)
    }
  }

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

  const visibleActionDeliveries = useMemo(
    () => actionDeliveries.filter((delivery) => delivery.status === 'RECORDED' && !delivery.readAt),
    [actionDeliveries],
  )
  const historyDeliveries = useMemo(
    () => deliveryHistory.filter((delivery) => delivery.status !== 'RECORDED' || delivery.readAt),
    [deliveryHistory],
  )
  const visibleUnreadCount = visibleActionDeliveries.length
  const unreadCount = summary?.unreadCount ?? visibleUnreadCount
  const enabledPreferences = useMemo(
    () => preferences.filter((preference) => preference.enabled).length,
    [preferences],
  )
  const providerReadyCount = useMemo(
    () => [...visibleActionDeliveries, ...historyDeliveries].filter((delivery) => delivery.providerStatus !== 'NOT_CONFIGURED').length,
    [visibleActionDeliveries, historyDeliveries],
  )
  const severityCounts = useMemo(() => {
    return [...visibleActionDeliveries, ...historyDeliveries].reduce(
      (counts, delivery) => {
        counts[notificationSeverity(delivery)] += 1
        return counts
      },
      { critical: 0, action: 0, review: 0, cleared: 0 } satisfies Record<NotificationSeverity, number>,
    )
  }, [visibleActionDeliveries, historyDeliveries])
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
      setActionDeliveries((current) => current.filter((item) => item.id !== updated.id))
      setDeliveryHistory((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
      if (delivery.status === 'RECORDED' && !delivery.readAt && (updated.status === 'READ' || updated.readAt)) {
        setSummary((current) => current ? { ...current, unreadCount: Math.max(0, current.unreadCount - 1) } : current)
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
          <h2>Action inbox</h2>
          <span>
            {unreadCount > visibleActionDeliveries.length
              ? `Showing ${visibleActionDeliveries.length} of ${unreadCount} active`
              : `${visibleActionDeliveries.length} active`}
          </span>
        </div>
        {visibleActionDeliveries.length ? (
          <div className="queue-list">
            {visibleActionDeliveries.map((delivery) => {
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
                      className={delivery.providerStatus === 'READY_FOR_PROVIDER' || delivery.providerStatus === 'FAILED' ? 'data-chip warning-chip' : 'data-chip'}
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
            guidance="Unread operations, service, account, and outbox alerts that need attention will appear here before history."
          />
        )}
        {actionHasMore ? (
          <button
            className="icon-text-button"
            type="button"
            disabled={loadingMore === 'actions'}
            onClick={() => void loadMoreActions()}
          >
            <ListPlus size={16} aria-hidden="true" />
            <span>{loadingMore === 'actions' ? 'Loading alerts' : 'Load more alerts'}</span>
          </button>
        ) : null}
      </section>

      <section className="table-section">
        <div className="table-toolbar">
          <h2>Delivery history</h2>
          <span>{historyDeliveries.length} records</span>
        </div>
        {historyDeliveries.length ? (
          <div className="queue-list">
            {historyDeliveries.map((delivery) => {
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
                      <span className="data-chip">History</span>
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
                    <span className="data-chip">{deliveryStageLabels[delivery.deliveryStage]}</span>
                    <span className={delivery.providerStatus === 'READY_FOR_PROVIDER' || delivery.providerStatus === 'FAILED' ? 'data-chip warning-chip' : 'data-chip'}>
                      {providerStatusLabels[delivery.providerStatus]}
                    </span>
                    {delivery.providerError ? <span className="data-chip warning-chip">{delivery.providerError}</span> : null}
                    <span className="data-chip">{new Date(delivery.createdAt).toLocaleString()}</span>
                    {delivery.sourceType ? <span className="data-chip">{delivery.sourceType}</span> : null}
                    {delivery.sourceId ? <span className="data-chip mono-cell">{shortNotificationSourceId(delivery.sourceId)}</span> : null}
                    {sourceHref ? (
                      <Link className="table-button text-link" to={sourceHref}>
                        Open source
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            label="No delivery history yet"
            guidance="Read, skipped, or resolved local delivery records will stay here after the action inbox is clear."
          />
        )}
        {historyHasMore ? (
          <button
            className="icon-text-button"
            type="button"
            disabled={loadingMore === 'history'}
            onClick={() => void loadMoreHistory()}
          >
            <ListPlus size={16} aria-hidden="true" />
            <span>{loadingMore === 'history' ? 'Loading history' : 'Load more history'}</span>
          </button>
        ) : null}
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
