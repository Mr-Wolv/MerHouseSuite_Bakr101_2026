import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { appIcons } from '../components/AppIcons'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime } from '../components/format'

export function AccountPage() {
  const { token, user, emailVerified, sendEmailVerification, refreshEmailVerified } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)
  const [emailVerificationMessage, setEmailVerificationMessage] = useState('')
  const [emailVerificationError, setEmailVerificationError] = useState('')

  if (!user || !token) return null
  const authToken = token

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation must match.')
      return
    }
    setSubmitting(true)
    try {
      const response = await api.changeOwnPassword(authToken, { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setMessage(response.message)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to change password.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSendVerification() {
    setEmailVerificationError('')
    setEmailVerificationMessage('')
    setVerifyingEmail(true)
    try {
      await sendEmailVerification()
      setEmailVerificationMessage('Verification email sent. Check your inbox and click the link to verify your email.')
    } catch (caught) {
      setEmailVerificationError(caught instanceof Error ? caught.message : 'Unable to send verification email.')
    } finally {
      setVerifyingEmail(false)
    }
  }

  async function handleRefreshVerified() {
    setEmailVerificationError('')
    setEmailVerificationMessage('')
    const verified = await refreshEmailVerified()
    if (verified) {
      setEmailVerificationMessage('Email verification confirmed.')
    } else {
      setEmailVerificationError('Email is not yet verified. Check your inbox and click the verification link.')
    }
  }

  return (
    <div className="stacked-page">
      <section className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Account settings</span>
          <h1>Your MerHouse account</h1>
          <p>Review your signed-in account context and update your password without changing tenant or role ownership.</p>
        </div>
        <appIcons.account size={32} aria-hidden="true" />
      </section>

      <section className="attention-panel account-grid" aria-label="Account profile">
        <article className="queue-card">
          <div className="card-heading">
            <appIcons.account size={18} aria-hidden="true" />
            <h2>Profile</h2>
          </div>
          <dl className="detail-list">
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Role</dt><dd><StatusBadge value={user.role} /></dd></div>
            <div><dt>Status</dt><dd><StatusBadge value={user.enabled ? 'ENABLED' : 'DISABLED'} /></dd></div>
            <div><dt>Email verified</dt><dd><StatusBadge value={emailVerified ? 'VERIFIED' : 'UNVERIFIED'} /></dd></div>
            <div><dt>Tenant</dt><dd>{user.tenantId}</dd></div>
            <div><dt>Created</dt><dd>{formatDateTime(user.createdAt)}</dd></div>
          </dl>
        </article>

        <article className="queue-card">
          <div className="card-heading">
            <appIcons.password size={18} aria-hidden="true" />
            <h2>Security Boundary</h2>
          </div>
          <p className="muted-copy">
            Account settings can change only your own password. Email, role, tenant, and enabled state remain governed through platform account management.
          </p>
          <div className="chip-row">
            <span className="data-chip">Current password required</span>
            <span className="data-chip">No provider delivery claim</span>
            <span className="data-chip">Audit recorded</span>
          </div>
          <div className="button-row">
            <Link className="secondary-button fit-button" to="/notifications">
              <appIcons.alerts size={16} aria-hidden="true" />
              Alerts
            </Link>
            <Link className="secondary-button fit-button" to="/service-accountability">
              <appIcons.service size={16} aria-hidden="true" />
              Service review
            </Link>
          </div>
        </article>

        <article className="queue-card">
          <div className="card-heading">
            <appIcons.recovery size={18} aria-hidden="true" />
            <h2>Email Verification</h2>
          </div>
          <p className="muted-copy">
            {emailVerified
              ? 'Your email address has been verified. You can use passwordless sign-in and receive account notifications.'
              : 'Verify your email to use passwordless sign-in links and receive account notifications.'}
          </p>
          {emailVerificationError ? <div className="inline-error" role="alert">{emailVerificationError}</div> : null}
          {emailVerificationMessage ? <div className="inline-success" role="status">{emailVerificationMessage}</div> : null}
          <div className="button-row">
            {!emailVerified ? (
              <button className="primary-button fit-button" type="button" disabled={verifyingEmail} onClick={() => void handleSendVerification()}>
                <appIcons.recovery size={16} aria-hidden="true" />
                {verifyingEmail ? 'Sending...' : 'Send verification email'}
              </button>
            ) : null}
            <button className="secondary-button fit-button" type="button" onClick={() => void handleRefreshVerified()}>
              <appIcons.help size={16} aria-hidden="true" />
              Check verification status
            </button>
          </div>
        </article>
      </section>

      <section className="form-panel" aria-labelledby="account-password-heading">
        <div className="card-heading">
          <appIcons.password size={18} aria-hidden="true" />
          <h2 id="account-password-heading">Change password</h2>
        </div>
        <form className="form-stack compact-form" onSubmit={handlePasswordChange}>
          <label htmlFor="account-current-password">
            <span>Current password</span>
            <input
              id="account-current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={120}
              required
            />
          </label>
          <label htmlFor="account-new-password">
            <span>New password</span>
            <input
              id="account-new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={120}
              required
            />
          </label>
          <label htmlFor="account-confirm-new-password">
            <span>Confirm new password</span>
            <input
              id="account-confirm-new-password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={120}
              required
            />
          </label>
          {error ? <div className="inline-error" role="alert">{error}</div> : null}
          {message ? <div className="inline-success" role="status">{message}</div> : null}
          <button className="primary-button fit-button" type="submit" disabled={submitting}>
            <appIcons.password size={16} aria-hidden="true" />
            {submitting ? 'Changing password' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  )
}
