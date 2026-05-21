import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [resetPath, setResetPath] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setResetPath(null)
    setSubmitting(true)
    try {
      const response = await api.requestPasswordReset(email)
      setMessage(response.message)
      setResetPath(response.resetPath)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to request reset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel title="Password Recovery" subtitle="Request a reset link for an enabled platform account.">
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="forgot-password-email">
          <span>Email</span>
          <input id="forgot-password-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        {error ? <div className="inline-error">{error}</div> : null}
        {message ? (
          <div className="inline-success">
            <span>{message}</span>
            {resetPath ? <Link to={resetPath}>Open reset link</Link> : null}
          </div>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Requesting' : 'Request reset'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const initialToken = useMemo(() => params.get('token') ?? '', [params])
  const [token, setToken] = useState(initialToken)
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const response = await api.confirmPasswordReset(token, newPassword)
      setMessage(response.message)
      setNewPassword('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel title="Set New Password" subtitle="Use the reset token from the recovery request.">
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="reset-password-token">
          <span>Reset token</span>
          <input id="reset-password-token" value={token} onChange={(event) => setToken(event.target.value)} required />
        </label>
        <label htmlFor="reset-password-new-password">
          <span>New password</span>
          <input
            id="reset-password-new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            type="password"
            required
          />
        </label>
        {error ? <div className="inline-error">{error}</div> : null}
        {message ? <div className="inline-success">{message} <Link to="/login">Return to sign in</Link></div> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Resetting' : 'Reset password'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}

export function RequestAccessPage() {
  const [organizationName, setOrganizationName] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [requestedRole, setRequestedRole] = useState<'MERCHANT' | 'WAREHOUSE_OPERATOR'>('MERCHANT')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const request = await api.submitAccessRequest({ organizationName, requesterEmail, requestedRole, notes })
      setMessage(`Access request ${request.status.toLowerCase()} for ${request.requesterEmail}.`)
      setOrganizationName('')
      setRequesterEmail('')
      setRequestedRole('MERCHANT')
      setNotes('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to submit access request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel title="Request Access" subtitle="Ask an admin to review a merchant or warehouse account request.">
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="request-access-organization">
          <span>Organization</span>
          <input id="request-access-organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
        </label>
        <label htmlFor="request-access-email">
          <span>Email</span>
          <input id="request-access-email" value={requesterEmail} onChange={(event) => setRequesterEmail(event.target.value)} type="email" required />
        </label>
        <label htmlFor="request-access-role">
          <span>Role</span>
          <select id="request-access-role" value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as typeof requestedRole)}>
            <option value="MERCHANT">Merchant</option>
            <option value="WAREHOUSE_OPERATOR">Warehouse operator</option>
          </select>
        </label>
        <label htmlFor="request-access-notes">
          <span>Notes</span>
          <textarea id="request-access-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
        </label>
        {error ? <div className="inline-error">{error}</div> : null}
        {message ? <div className="inline-success">{message}</div> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Submitting' : 'Submit request'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}

function PublicAuthPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="auth-title">
        <div>
          <span className="eyebrow">MerHouse</span>
          <h1 id="auth-title">{title}</h1>
          <p>{subtitle}</p>
        </div>
        {children}
        <Link className="text-link" to="/login">Back to sign in</Link>
      </section>
    </main>
  )
}
