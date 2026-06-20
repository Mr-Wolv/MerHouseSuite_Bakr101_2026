import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { appIcons } from '../components/AppIcons'
import { PublicAuthPanel } from '../components/PublicAuthPanel'
import {
  completeSignInWithLink,
  friendlyAuthError,
  getEmailForSignIn,
  isMagicSignInLink,
} from '../lib/firebase-auth'
import { useAuth } from '../auth/useAuth'

/**
 * This page handles the passwordless sign-in link redirect.
 *
 * When the user clicks the magic link in their email, they land here with
 * query parameters from Firebase (oobCode, mode=signIn, apiKey, etc.).
 *
 * The page:
 * 1. Detects whether the URL contains a valid sign-in link
 * 2. Recovers the email from localStorage (saved when the link was requested)
 * 3. Shows the email to the user and asks them to confirm / re-enter it
 * 4. Completes sign-in via `signInWithEmailLink`
 * 5. Redirects to the app home on success
 */
export function EmailSignInCompletePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const hasValidLink = useMemo(() => isMagicSignInLink(), [])

  const savedEmail = getEmailForSignIn()
  const [storedEmail, setStoredEmail] = useState<string | null>(savedEmail ?? null)
  const [email, setEmail] = useState(savedEmail ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // If already signed in, redirect
  if (user) {
    return <Navigate to="/" replace />
  }

  // No valid sign-in link found in the URL
  if (!hasValidLink) {
    return (
      <PublicAuthPanel
        title="Complete Sign In"
        subtitle="No sign-in link detected."
        icon={appIcons.recovery}
        cues={[]}
        footer={<Link className="text-link" to="/login">Back to sign in</Link>}
      >
        <div className="inline-error" role="alert">
          No sign-in link found in the current URL. Please request a new sign-in link.
        </div>
        <p><Link to="/passwordless-sign-in">Request a new sign-in link</Link></p>
      </PublicAuthPanel>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await completeSignInWithLink(email.trim())
      // On success, Firebase Auth state changes and triggers
      // onAuthStateChanged, which handles token/profile setup.
      // Navigate home.
      navigate('/', { replace: true })
    } catch (caught) {
      setError(friendlyAuthError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel
      title="Complete Sign In"
      subtitle="Confirm your email to sign in with the magic link."
      icon={appIcons.recovery}
      cues={[
        { label: 'One-time link', detail: 'This sign-in link can only be used once.' },
        { label: 'Same browser', detail: 'Complete sign-in in the same browser where you started.' },
      ]}
      footer={<Link className="text-link" to="/login">Back to sign in</Link>}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="signin-complete-email">
          <span>Email</span>
          <input
            id="signin-complete-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder={storedEmail ?? 'your@email.com'}
            aria-describedby="signin-complete-help"
            required
          />
        </label>
        <p id="signin-complete-help" className="field-help">
          {storedEmail
            ? `Signing in as ${storedEmail}. Confirm or update the email to match the link.`
            : 'Enter the email address where you requested the sign-in link.'}
        </p>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          <appIcons.login size={16} aria-hidden="true" />
          {submitting ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}
