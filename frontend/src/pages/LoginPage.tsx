import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { appIcons } from '../components/AppIcons'
import { PublicAuthPanel } from '../components/PublicAuthPanel'

export function LoginPage() {
  const { login, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/'
      navigate(from, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.details[0] ?? caught.message)
      } else {
        setError('Unable to sign in.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PublicAuthPanel
      title="Operations Console"
      subtitle="Sign in with an enabled MerHouse account."
      icon={appIcons.login}
      cues={[
        { label: 'Access boundary', detail: 'Role and tenant scope are checked after sign-in.' },
        { label: 'Account support', detail: 'Recovery and access requests keep a reviewable delivery history.' },
      ]}
      footer={(
        <>
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/request-access">Request access</Link>
          <Link to="/how-to-use">How to use</Link>
        </>
      )}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label htmlFor="login-email">
          <span>Email</span>
          <input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
        </label>
        <label htmlFor="login-password">
          <span>Password</span>
          <input
            id="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          <appIcons.login size={16} aria-hidden="true" />
          {submitting ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </PublicAuthPanel>
  )
}
