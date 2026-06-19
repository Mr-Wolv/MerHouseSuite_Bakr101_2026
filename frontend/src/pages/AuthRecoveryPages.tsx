import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { appIcons } from '../components/AppIcons'
import { PublicAuthPanel } from '../components/PublicAuthPanel'
import { ApiError, api } from '../api/client'
import {
  confirmFirebasePasswordReset,
  friendlyAuthError,
  sendFirebasePasswordReset,
  verifyResetCode,
} from '../lib/firebase-auth'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      await sendFirebasePasswordReset(email.trim())
      setMessage('If an enabled account exists for that email, a password reset link has been sent.')
    } catch (caught) {
      setError(friendlyAuthError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel
      title="Password Recovery"
      subtitle="Request a reset for an enabled MerHouse account."
      icon={appIcons.password}
      cues={[
        { label: 'Reset link', detail: 'A secure reset link will be sent to your email.' },
        { label: 'Generic response', detail: 'The page does not reveal whether an email exists.' },
      ]}
      footer={<Link className="text-link" to="/login">Back to sign in</Link>}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="forgot-password-email">
          <span>Email</span>
          <input
            id="forgot-password-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            aria-describedby="forgot-password-help"
            required
          />
        </label>
        <p id="forgot-password-help" className="field-help">A password reset link will be sent to your email if an enabled account exists.</p>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        {message ? (
          <div className="inline-success" role="status">
            <span>{message}</span>
          </div>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          <appIcons.password size={16} aria-hidden="true" />
          {submitting ? 'Sending link' : 'Send reset link'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const oobCode = useMemo(() => params.get('oobCode') ?? '', [params])

  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [verifying, setVerifying] = useState(() => !!oobCode)
  const [verifyError, setVerifyError] = useState(() =>
    oobCode ? '' : 'No reset code provided. Please request a new reset link.',
  )

  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Verify the oobCode on mount so the user sees whether the link is valid
  // before they type a new password.
  useEffect(() => {
    if (!oobCode) return
    let cancelled = false
    verifyResetCode(oobCode)
      .then((email) => {
        if (!cancelled) {
          setVerifiedEmail(email)
          setVerifying(false)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setVerifyError(friendlyAuthError(caught))
          setVerifying(false)
        }
      })
    return () => { cancelled = true }
  }, [oobCode])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      await confirmFirebasePasswordReset(oobCode, newPassword)
      setMessage('Your password has been reset. You can now sign in with your new password.')
      setNewPassword('')
    } catch (caught) {
      setError(friendlyAuthError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  if (verifying) {
    return (
      <PublicAuthPanel
        title="Set New Password"
        subtitle="Verifying your reset link..."
        icon={appIcons.recovery}
        cues={[]}
        footer={<Link className="text-link" to="/login">Back to sign in</Link>}
      >
        <p role="status">Verifying reset link, please wait.</p>
      </PublicAuthPanel>
    )
  }

  if (verifyError) {
    return (
      <PublicAuthPanel
        title="Set New Password"
        subtitle="The reset link could not be verified."
        icon={appIcons.recovery}
        cues={[]}
        footer={<Link className="text-link" to="/login">Back to sign in</Link>}
      >
        <div className="inline-error" role="alert">{verifyError}</div>
        <p><Link to="/forgot-password">Request a new reset link</Link></p>
      </PublicAuthPanel>
    )
  }

  return (
    <PublicAuthPanel
      title="Set New Password"
      subtitle={`Choose a new password for ${verifiedEmail}.`}
      icon={appIcons.recovery}
      cues={[
        { label: 'Single use', detail: 'This reset link can only be used once.' },
        { label: 'After reset', detail: 'Return to sign in and use the updated password.' },
      ]}
      footer={<Link className="text-link" to="/login">Back to sign in</Link>}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="reset-password-email">
          <span>Email</span>
          <input
            id="reset-password-email"
            value={verifiedEmail}
            readOnly
            type="email"
            autoComplete="email"
          />
        </label>
        <label htmlFor="reset-password-new-password">
          <span>New password</span>
          <input
            id="reset-password-new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            type="password"
            autoComplete="new-password"
            aria-describedby="reset-password-help"
            required
          />
        </label>
        <p id="reset-password-help" className="field-help">Use at least 8 characters.</p>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        {message ? <div className="inline-success" role="status">{message} <Link to="/login">Return to sign in</Link></div> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          <appIcons.recovery size={16} aria-hidden="true" />
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
      const request = await api.submitAccessRequest({
        organizationName: organizationName.trim(),
        requesterEmail: requesterEmail.trim(),
        requestedRole,
        notes: notes.trim(),
      })
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
    <PublicAuthPanel
      title="Request Access"
      subtitle="Submit a local merchant or warehouse onboarding request."
      icon={appIcons.onboarding}
      cues={[
        { label: 'Review queue', detail: 'Platform users review requests before any tenant or user is created.' },
        { label: 'Account readiness', detail: 'Approved requests create a reviewable account-ready record.' },
      ]}
      footer={<Link className="text-link" to="/login">Back to sign in</Link>}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="request-access-organization">
          <span>Organization</span>
          <input id="request-access-organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} autoComplete="organization" required />
        </label>
        <label htmlFor="request-access-email">
          <span>Email</span>
          <input id="request-access-email" value={requesterEmail} onChange={(event) => setRequesterEmail(event.target.value)} type="email" autoComplete="email" required />
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
          <textarea
            id="request-access-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            aria-describedby="request-access-notes-help"
          />
        </label>
        <p id="request-access-notes-help" className="field-help">Notes are stored for admin review; avoid secrets, keys, or production credentials.</p>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        {message ? <div className="inline-success" role="status">{message}</div> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          <appIcons.onboarding size={16} aria-hidden="true" />
          {submitting ? 'Submitting' : 'Submit request'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}
