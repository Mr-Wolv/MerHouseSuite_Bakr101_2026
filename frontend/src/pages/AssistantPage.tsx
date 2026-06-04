import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Bot, RefreshCcw, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { AssistantInteraction, AssistantScope } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { StatusBadge } from '../components/StatusBadge'

const scopeLabels: Record<AssistantScope, string> = {
  PLATFORM_OVERVIEW: 'Platform overview',
  MERCHANT_OPERATIONS: 'Merchant operations',
  WAREHOUSE_OPERATIONS: 'Warehouse operations',
}

export function AssistantPage() {
  const { token, user } = useAuth()
  const [interactions, setInteractions] = useState<AssistantInteraction[]>([])
  const [prompt, setPrompt] = useState('')
  const [scope, setScope] = useState<AssistantScope>('PLATFORM_OVERVIEW')
  const [targetTenantId, setTargetTenantId] = useState('')
  const [decisionReason, setDecisionReason] = useState('Reviewed by operator')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [busyDecisionId, setBusyDecisionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableScopes = useMemo<AssistantScope[]>(() => {
    if (!user) return ['MERCHANT_OPERATIONS']
    if (['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'].includes(user.role)) {
      return ['PLATFORM_OVERVIEW', 'MERCHANT_OPERATIONS', 'WAREHOUSE_OPERATIONS']
    }
    if (user.role === 'WAREHOUSE_OPERATOR') return ['WAREHOUSE_OPERATIONS']
    return ['MERCHANT_OPERATIONS']
  }, [user])

  const canDecideSuggestions = user?.role !== 'AUDITOR'
  const activeScope = availableScopes.includes(scope) ? scope : availableScopes[0]
  const canOpenAudit = ['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'].includes(user?.role ?? '')
  const pendingSuggestions = interactions.filter((item) => item.actionStatus === 'PENDING').length
  const refusals = interactions.filter((item) => item.responseType === 'REFUSAL').length

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setInteractions(await api.assistantInteractions(token, 25))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load assistant history.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !prompt.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const interaction = await api.createAssistantInteraction(token, {
        scope: activeScope,
        targetTenantId: targetTenantId.trim() || null,
        prompt,
      })
      setInteractions((current) => [interaction, ...current])
      setPrompt('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to run assistant request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function decide(interaction: AssistantInteraction, decision: 'accept' | 'reject') {
    if (!token || !decisionReason.trim()) return
    setBusyDecisionId(interaction.id)
    setError(null)
    try {
      const updated = decision === 'accept'
        ? await api.acceptAssistantSuggestion(token, interaction.id, { reason: decisionReason })
        : await api.rejectAssistantSuggestion(token, interaction.id, { reason: decisionReason })
      setInteractions((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to decide assistant suggestion.')
    } finally {
      setBusyDecisionId(null)
    }
  }

  if (loading) return <LoadingState label="Loading assistant" />

  return (
    <div className="page-stack">
      <div className="page-heading">
        <span className="eyebrow">Review assistant</span>
        <h1>Assistant</h1>
        <p>Ask for a scoped second pass over operations risk.</p>
      </div>
      <GuidancePanel title="Assistant review boundary">
        Suggestions stay review-only. Accepting one records a decision; it does not change operations.
      </GuidancePanel>

      {error ? <ErrorState title={error} /> : null}

      <div className="status-row">
        <div className="status-count"><span>Review records</span><strong>{interactions.length}</strong></div>
        <div className="status-count"><span>Pending suggestions</span><strong>{pendingSuggestions}</strong></div>
        <div className="status-count"><span>Refusals</span><strong>{refusals}</strong></div>
        {canOpenAudit ? (
          <Link className="data-chip text-link" to="/admin/audit">Open assistant audit trail</Link>
        ) : (
          <span className="data-chip">Audit trail recorded</span>
        )}
      </div>

      <form className="panel-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="assistant-scope">Scope</label>
        <select id="assistant-scope" value={activeScope} onChange={(event) => setScope(event.target.value as AssistantScope)}>
            {availableScopes.map((item) => (
              <option key={item} value={item}>{scopeLabels[item]}</option>
            ))}
        </select>
        {['OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'].includes(user?.role ?? '') && activeScope !== 'PLATFORM_OVERVIEW' ? (
          <>
            <label htmlFor="assistant-target-tenant">Target tenant id</label>
            <input id="assistant-target-tenant" value={targetTenantId} onChange={(event) => setTargetTenantId(event.target.value)} />
          </>
        ) : null}
        <label htmlFor="assistant-prompt">Prompt</label>
        <textarea
          id="assistant-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Summarize what needs review next"
          rows={4}
        />
        <div className="action-row">
          <button className="icon-text-button" type="submit" disabled={submitting || !prompt.trim()}>
            <Send size={16} aria-hidden="true" />
            <span>{submitting ? 'Running' : 'Run assistant'}</span>
          </button>
          <button className="icon-text-button" type="button" onClick={() => void load()}>
            <RefreshCcw size={16} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </form>

      {canDecideSuggestions ? (
        <section className="admin-action-panel" aria-label="Suggestion decision controls">
          <div className="admin-action-copy">
            <h2>Suggestion decision controls</h2>
            <p>Decision buttons record review only; operations stay unchanged.</p>
          </div>
          <label className="compact-field" htmlFor="assistant-decision-reason">
            <span>Decision reason</span>
            <input
              id="assistant-decision-reason"
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
            />
          </label>
        </section>
      ) : null}

      <section className="table-section">
        <div className="table-toolbar">
          <h2>Interaction History</h2>
          <span>{interactions.length} review records</span>
        </div>
        {interactions.length ? (
          <div className="queue-list">
            {interactions.map((interaction) => (
              <article className={interaction.actionStatus === 'PENDING' ? 'queue-card risk-card' : 'queue-card'} key={interaction.id}>
                <div className="queue-card-header">
                  <div className="queue-card-title">
                    <Bot size={18} aria-hidden="true" />
                    <strong>{scopeLabels[interaction.scope]}</strong>
                    <StatusBadge value={interaction.responseType} />
                    <StatusBadge value={interaction.actionStatus} />
                  </div>
                  <div className="queue-card-meta">
                    {interaction.prototypeLocal ? <span className="data-chip">Review record</span> : null}
                    {interaction.targetTenantId ? <span className="data-chip">Target {shortId(interaction.targetTenantId)}</span> : null}
                    <span className="data-chip">{new Date(interaction.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="queue-card-body">
                  <div className="queue-card-section">
                    <h3>Request</h3>
                    <p>{displayAssistantText(interaction.requestText)}</p>
                  </div>
                  <div className="queue-card-section">
                    <h3>Response</h3>
                    <p>{displayAssistantText(interaction.responseText)}</p>
                  </div>
                  <div className="queue-card-section">
                    <h3>Audit</h3>
                    <p>{displayAssistantText(interaction.decisionNote ?? 'No decision recorded yet')}</p>
                    {interaction.decidedAt ? <span className="timestamp-cell">{new Date(interaction.decidedAt).toLocaleString()}</span> : null}
                  </div>
                </div>
                {interaction.actionStatus === 'PENDING' && canDecideSuggestions ? (
                  <div className="action-row">
                    <button
                      className="table-button warning-button"
                      type="button"
                      disabled={busyDecisionId === interaction.id || !decisionReason.trim()}
                      onClick={() => void decide(interaction, 'accept')}
                    >
                      Accept suggestion
                    </button>
                    <button
                      className="table-button destructive-button"
                      type="button"
                      disabled={busyDecisionId === interaction.id || !decisionReason.trim()}
                      onClick={() => void decide(interaction, 'reject')}
                    >
                      Reject suggestion
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            label="No assistant reviews yet"
            guidance="Start with a scoped summary. Suggestions stay review-only until a person records a decision."
          />
        )}
      </section>
    </div>
  )
}

function GuidancePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="admin-guidance-panel" aria-label={title}>
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  )
}

function shortId(id: string) {
  return id.slice(0, 8)
}

function displayAssistantText(value: string) {
  return value
    .replace(/\bV14 assistant\b/gi, 'assistant')
    .replace(/\bin V14\b/gi, '')
    .replace(/\bV14\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim()
}
