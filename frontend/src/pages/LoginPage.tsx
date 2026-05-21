import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'

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
      await login(email, password)
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
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <span className="eyebrow">MerHouse</span>
          <h1 id="login-title">Operations Console</h1>
          <p>Sign in with a platform account to continue.</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label htmlFor="login-email">
            <span>Email</span>
            <input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label htmlFor="login-password">
            <span>Password</span>
            <input
              id="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>
          {error ? <div className="inline-error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>
        <div className="login-actions" aria-label="Account help">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/request-access">Request access</Link>
        </div>
      </section>
    </main>
  )
}
