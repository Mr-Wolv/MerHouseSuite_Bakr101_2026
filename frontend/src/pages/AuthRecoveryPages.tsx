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
  const [recoveryLink, setRecoveryLink] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [useRecoveryKey, setUseRecoveryKey] = useState(false)
  const [recoveryResult, setRecoveryResult] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [newRecoveryKey, setNewRecoveryKey] = useState('')
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setRecoveryLink('')
    setSubmitting(true)
    // Always try Firebase email (may not arrive on Spark plan)
    try {
      await sendFirebasePasswordReset(email.trim())
      setMessage('If an enabled account exists for that email, a password reset link has been sent.')
    } catch (caught) {
      setError(friendlyAuthError(caught))
      setSubmitting(false)
      return
    }

    // Also request a backend reset token so the link can be used in-app
    // Separated from Firebase try/catch so backend failure doesn't overwrite success
    try {
      const backend = await api.requestPasswordReset(email.trim())
      if (backend.resetPath) {
        setRecoveryLink(backend.resetPath)
      }
    } catch {
      // Backend unavailable — the Firebase email was still attempted
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRecoveryKeyReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRecoveryError('')
    setRecoveryResult('')
    setNewRecoveryKey('')
    setRecoveryKeyCopied(false)
    setRecoverySubmitting(true)
    try {
      const response = await api.resetWithRecoveryKey(email.trim(), recoveryKey.trim(), newPassword)
      setRecoveryResult(response.message)
      setNewRecoveryKey(response.recoveryKey)
      setRecoveryKey('')
      setNewPassword('')
    } catch (caught) {
      setRecoveryError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Recovery failed. Check your key and email.')
    } finally {
      setRecoverySubmitting(false)
    }
  }

  async function handleRecoveryKeyCopy() {
    try {
      await navigator.clipboard.writeText(newRecoveryKey)
      setRecoveryKeyCopied(true)
      setTimeout(() => setRecoveryKeyCopied(false), 2000)
    } catch {
      // Fallback: select the text manually
    }
  }

  return (
    <PublicAuthPanel
      title="Password Recovery"
      subtitle="Request a reset for an enabled MerHouse account."
      icon={appIcons.password}
      cues={[
        { label: 'Reset link', detail: 'A secure reset link will be sent to your email.' },
        { label: 'Recovery key', detail: 'Use the key shown at sign-up to reset without email.' },
      ]}
      footer={<Link className="text-link" to="/login">Back to sign in</Link>}
    >
      <div className="recovery-tabs">
        <button
          className={`tab-button ${!useRecoveryKey ? 'active' : ''}`}
          type="button"
          onClick={() => setUseRecoveryKey(false)}
        >
          Email reset
        </button>
        <button
          className={`tab-button ${useRecoveryKey ? 'active' : ''}`}
          type="button"
          onClick={() => setUseRecoveryKey(true)}
        >
          Recovery key
        </button>
      </div>

      {useRecoveryKey ? (
        <form className="form-stack" onSubmit={handleRecoveryKeyReset}>
          <p className="field-help">Enter the recovery key you saved at sign-up along with your email and a new password.</p>
          <label htmlFor="recovery-key-email">
            <span>Email</span>
            <input
              id="recovery-key-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label htmlFor="recovery-key-input">
            <span>Recovery key</span>
            <input
              id="recovery-key-input"
              value={recoveryKey}
              onChange={(event) => setRecoveryKey(event.target.value.toUpperCase())}
              placeholder="AB12-CD34-EF56-GH78"
              maxLength={19}
              required
            />
          </label>
          <label htmlFor="recovery-key-new-password">
            <span>New password</span>
            <input
              id="recovery-key-new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {recoveryError ? <div className="inline-error" role="alert">{recoveryError}</div> : null}
          {recoveryResult ? (
            <div className="inline-success" role="status">
              <span>{recoveryResult} <Link to="/login">Sign in now</Link></span>
            </div>
          ) : null}
          {newRecoveryKey ? (
            <div className="recovery-key-display" role="alert">
              <strong className="warning-text">⚠ Save this new recovery key — it will not be shown again!</strong>
              <div className="recovery-key-box">
                <code className="recovery-key-value" data-testid="recovery-key-value">{newRecoveryKey}</code>
                <button className="table-button" type="button" onClick={handleRecoveryKeyCopy}>
                  {recoveryKeyCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="recovery-key-help">
                Use this key at <strong>/forgot-password</strong> if you ever lose access to your email.
              </p>
            </div>
          ) : null}
          <button className="primary-button" type="submit" disabled={recoverySubmitting}>
            <appIcons.recovery size={16} aria-hidden="true" />
            {recoverySubmitting ? 'Resetting' : 'Reset with recovery key'}
          </button>
        </form>
      ) : (
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
          {recoveryLink ? (
            <div className="inline-success" role="status">
              <span>
                Email not arriving?{' '}
                <Link to={recoveryLink} className="text-link">
                  Use recovery link directly
                </Link>
              </span>
            </div>
          ) : null}
          <button className="primary-button" type="submit" disabled={submitting}>
            <appIcons.password size={16} aria-hidden="true" />
            {submitting ? 'Sending link' : 'Send reset link'}
          </button>
        </form>
      )}
    </PublicAuthPanel>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const oobCode = useMemo(() => params.get('oobCode') ?? '', [params])
  const backendToken = useMemo(() => params.get('token') ?? '', [params])
  const isBackendFlow = !!backendToken

  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [verifying, setVerifying] = useState(() => !!oobCode)
  const [verifyError, setVerifyError] = useState(() =>
    oobCode ? '' : backendToken ? '' : 'No reset code provided. Please request a new reset link.',
  )

  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Verify Firebase oobCode on mount
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
      if (isBackendFlow) {
        const result = await api.confirmPasswordReset(backendToken, newPassword)
        setMessage(result.message)
      } else {
        await confirmFirebasePasswordReset(oobCode, newPassword)
        setMessage('Your password has been reset. You can now sign in with your new password.')
      }
      setNewPassword('')
    } catch (caught) {
      if (isBackendFlow) {
        const err = caught as { message?: string; details?: string[] }
        setError(err.details?.[0] ?? err.message ?? 'Reset failed. Please request a new link.')
      } else {
        setError(friendlyAuthError(caught))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isBackendFlow && verifying) {
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

  if (!isBackendFlow && verifyError) {
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
      subtitle={`Choose a new password${verifiedEmail ? ' for ' + verifiedEmail : '.'}`}
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
            value={isBackendFlow ? '' : verifiedEmail}
            readOnly
            type="email"
            autoComplete="email"
            placeholder={isBackendFlow ? 'Backend recovery token' : ''}
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

export function SignUpPage() {
  const [organizationName, setOrganizationName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [requestedRole, setRequestedRole] = useState<'MERCHANT' | 'WAREHOUSE_OPERATOR'>('MERCHANT')
  const [message, setMessage] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setRecoveryKey('')
    setCopied(false)
    setSubmitting(true)
    try {
      const response = await api.signUp({
        organizationName: organizationName.trim(),
        email: email.trim(),
        password,
        requestedRole,
      })
      setMessage(`Account created for ${response.user.email}.`)
      setRecoveryKey(response.recoveryKey)
      setOrganizationName('')
      setEmail('')
      setPassword('')
      setRequestedRole('MERCHANT')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to create account.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(recoveryKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text manually
    }
  }

  return (
    <PublicAuthPanel
      title="Sign Up"
      subtitle="Create a new MerHouse account for your organization."
      icon={appIcons.onboarding}
      cues={[
        { label: 'Direct registration', detail: 'Your tenant and account are created immediately — no review needed.' },
        { label: 'Recovery key', detail: 'Save your recovery key at sign-up to reset your password without email.' },
      ]}
      footer={<Link className="text-link" to="/login">Already have an account? Sign in</Link>}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="signup-organization">
          <span>Organization</span>
          <input id="signup-organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} autoComplete="organization" required />
        </label>
        <label htmlFor="signup-email">
          <span>Email</span>
          <input id="signup-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
        </label>
        <label htmlFor="signup-password">
          <span>Password</span>
          <input
            id="signup-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label htmlFor="signup-role">
          <span>Role</span>
          <select id="signup-role" value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as typeof requestedRole)}>
            <option value="MERCHANT">Merchant</option>
            <option value="WAREHOUSE_OPERATOR">Warehouse operator</option>
          </select>
        </label>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        {message ? (
          <div className="inline-success" role="status">
            <span>{message} <Link to="/login">Sign in now</Link></span>
          </div>
        ) : null}
        {recoveryKey ? (
          <div className="recovery-key-display" role="alert">
            <strong className="warning-text">⚠ Save this recovery key — it will not be shown again!</strong>
            <div className="recovery-key-box">
              <code className="recovery-key-value" data-testid="recovery-key-value">{recoveryKey}</code>
              <button className="table-button" type="button" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="recovery-key-help">
              Use this key at <strong>/forgot-password</strong> if you ever lose access to your email.
            </p>
          </div>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          <appIcons.onboarding size={16} aria-hidden="true" />
          {submitting ? 'Creating account' : 'Create account'}
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
