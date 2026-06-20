import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { appIcons } from '../components/AppIcons'
import { PublicAuthPanel } from '../components/PublicAuthPanel'
import { friendlyAuthError, saveEmailForSignIn, sendSignInLink } from '../lib/firebase-auth'

/**
 * Public page where a user enters their email to receive a passwordless
 * sign-in link (magic link / OTP login link).
 *
 * On submit we save the email to localStorage and send the link. The user
 * then checks their email inbox, clicks the link, and lands on
 * /sign-in/complete where the sign-in is finalized.
 */
export function PasswordlessSignInPage() {
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
      saveEmailForSignIn(email.trim())
      await sendSignInLink(email.trim())
      setMessage('If an enabled account exists for that email, a sign-in link has been sent.')
    } catch (caught) {
      setError(friendlyAuthError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel
      title="Passwordless Sign In"
      subtitle="Receive a sign-in link via email — no password needed."
      icon={appIcons.login}
      cues={[
        { label: 'Magic link', detail: 'A one-time sign-in link will be sent to your email.' },
        { label: 'Generic response', detail: 'The page does not reveal whether an email exists.' },
        { label: 'Browser required', detail: 'Open the link in the same browser where you request access.' },
      ]}
      footer={(
        <>
          <Link to="/login">Sign in with password</Link>
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/request-access">Request access</Link>
        </>
      )}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="passwordless-email">
          <span>Email</span>
          <input
            id="passwordless-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            aria-describedby="passwordless-help"
            required
          />
        </label>
        <p id="passwordless-help" className="field-help">
          A one-time sign-in link will be sent to your email if an enabled account exists.
          Open the link in this browser to sign in automatically.
        </p>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        {message ? (
          <div className="inline-success" role="status">
            <span>{message}</span>
          </div>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          <appIcons.login size={16} aria-hidden="true" />
          {submitting ? 'Sending link' : 'Send sign-in link'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}
