import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, RefreshCcw } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationDeliveryStage,
  NotificationPreference,
  NotificationProviderStatus,
  NotificationTopic,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { StatusBadge } from '../components/StatusBadge'

const topicLabels: Record<NotificationTopic, string> = {
  ACCOUNT_LIFECYCLE: 'Account lifecycle',
  OPERATIONS: 'Operations',
  SERVICE_ACCOUNTABILITY: 'Service accountability',
  OUTBOX_HEALTH: 'Outbox health',
}

const channelLabels: Record<NotificationChannel, string> = {
  IN_APP: 'In app',
  EMAIL_PROTOTYPE: 'Email prototype',
}

const deliveryStageLabels: Record<NotificationDeliveryStage, string> = {
  PREPARED: 'Prepared',
  LOCAL_RECORDED: 'Local recorded',
  SKIPPED_BY_PREFERENCE: 'Skipped by preference',
}

const providerStatusLabels: Record<NotificationProviderStatus, string> = {
  NOT_CONFIGURED: 'Provider not configured',
  READY_FOR_PROVIDER: 'Ready for provider',
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
        <span className="eyebrow">Prototype-local</span>
        <h1>Notifications</h1>
        <p>Review local delivery records and tune account, operations, service, and outbox notification preferences.</p>
      </div>

      {error ? <ErrorState title={error} /> : null}
      {message ? <div className="inline-success">{message}</div> : null}

      <section className="metric-grid" aria-label="Notification summary">
        <div className="metric">
          <span>Unread</span>
          <strong>{unreadCount}</strong>
        </div>
        <div className="metric">
          <span>Delivery records</span>
          <strong>{deliveries.length}</strong>
        </div>
        <div className="metric">
          <span>Preferences</span>
          <strong>{preferences.length}</strong>
        </div>
        <div className="metric">
          <span>Prototype scope</span>
          <strong>Local</strong>
        </div>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((preference) => (
                <tr key={preference.id}>
                  <td>{topicLabels[preference.topic]}</td>
                  <td>{channelLabels[preference.channel]}</td>
                  <td><StatusBadge value={preference.enabled ? 'enabled' : 'disabled'} /></td>
                  <td>
                    <button
                      className="table-button"
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

      <section className="table-section">
        <div className="table-toolbar">
          <h2>Delivery History</h2>
          <span>{deliveries.length} local records</span>
        </div>
        {deliveries.length ? (
          <div className="queue-list">
            {deliveries.map((delivery) => {
              const canMarkRead = delivery.status === 'RECORDED' && !delivery.readAt
              return (
                <article className="queue-card" key={delivery.id}>
                  <div className="queue-card-header">
                    <div className="queue-card-title">
                      <Bell size={18} aria-hidden="true" />
                      <strong>{delivery.title}</strong>
                      <StatusBadge value={delivery.status} />
                    </div>
                    <div className="queue-card-meta">
                      {delivery.prototypeLocal ? <span className="data-chip">Prototype-local</span> : null}
                      <span className="data-chip">{topicLabels[delivery.topic]}</span>
                    </div>
                  </div>
                  <p>{delivery.body}</p>
                  <div className="action-row">
                    <span className="data-chip">{channelLabels[delivery.channel]}</span>
                    <span className="data-chip">{deliveryStageLabels[delivery.deliveryStage]}</span>
                    <span className="data-chip">{providerStatusLabels[delivery.providerStatus]}</span>
                    <span className="data-chip">{new Date(delivery.createdAt).toLocaleString()}</span>
                    {delivery.sourceType ? <span className="data-chip">{delivery.sourceType}</span> : null}
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
          <EmptyState label="No notification delivery records yet" />
        )}
      </section>
    </div>
  )
}
