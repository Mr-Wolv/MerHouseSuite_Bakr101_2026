import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { appIcons } from '../components/AppIcons'
import { PublicAuthPanel } from '../components/PublicAuthPanel'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const response = await api.requestOtp(email.trim())
      setMessage(response.message)
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to request reset.')
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
        { label: 'One-time password', detail: 'A 6-digit code will be sent to your email.' },
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
        <p id="forgot-password-help" className="field-help">A one-time password will be sent to your email if an enabled account exists.</p>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        {message ? <div className="inline-success" role="status"><span>{message}</span></div> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          <appIcons.password size={16} aria-hidden="true" />
          {submitting ? 'Sending code' : 'Send reset code'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}

export function VerifyOtpPage() {
  const [params] = useSearchParams()
  const email = useMemo(() => params.get('email') ?? '', [params])
  const [otpCode, setOtpCode] = useState('')
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
      const response = await api.resetWithOtp(email, otpCode.trim(), newPassword)
      setMessage(response.message)
      setOtpCode('')
      setNewPassword('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel
      title="Verify Reset Code"
      subtitle="Enter the 6-digit code sent to your email and choose a new password."
      icon={appIcons.recovery}
      cues={[
        { label: 'Code expiry', detail: 'OTP codes expire in 15 minutes.' },
        { label: 'After reset', detail: 'Return to sign in and use the updated password.' },
      ]}
      footer={<Link className="text-link" to="/login">Back to sign in</Link>}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="verify-otp-email">
          <span>Email</span>
          <input
            id="verify-otp-email"
            value={email}
            readOnly
            type="email"
            autoComplete="email"
          />
        </label>
        <label htmlFor="verify-otp-code">
          <span>One-time password</span>
          <input
            id="verify-otp-code"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            autoComplete="one-time-code"
            aria-describedby="otp-code-help"
            required
          />
        </label>
        <p id="otp-code-help" className="field-help">Enter the 6-digit code from your email.</p>
        <label htmlFor="verify-otp-new-password">
          <span>New password</span>
          <input
            id="verify-otp-new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            type="password"
            autoComplete="new-password"
            aria-describedby="new-password-help"
            required
          />
        </label>
        <p id="new-password-help" className="field-help">Use at least 8 characters.</p>
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
      const response = await api.confirmPasswordReset(token.trim(), newPassword)
      setMessage(response.message)
      setNewPassword('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel
      title="Set New Password"
      subtitle="Confirm a local reset token and choose a replacement password."
      icon={appIcons.recovery}
      cues={[
        { label: 'Token boundary', detail: 'Expired, used, missing, disabled, and invalid tokens receive the same result.' },
        { label: 'After reset', detail: 'Return to sign in and use the updated password.' },
      ]}
      footer={<Link className="text-link" to="/login">Back to sign in</Link>}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="reset-password-token">
          <span>Reset token</span>
          <input
            id="reset-password-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="one-time-code"
            aria-describedby="reset-token-help"
            required
          />
        </label>
        <p id="reset-token-help" className="field-help">Tokens are single-use local credentials; keep them out of screenshots and reports.</p>
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
        <p id="reset-password-help" className="field-help">Use at least 8 characters for local development proof.</p>
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
