import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { appIcons } from '../components/AppIcons'
import { PublicAuthPanel } from '../components/PublicAuthPanel'
import {
  applyEmailVerificationCode,
  friendlyAuthError,
} from '../lib/firebase-auth'
import { useAuth } from '../auth/useAuth'

/**
 * This page handles the email-verification link redirect.
 *
 * When the user clicks the verification link in their email, they land here
 * with `oobCode` and `mode=verifyEmail` in the URL.
 *
 * The page:
 * 1. Detects whether the URL contains a valid verification link
 * 2. Applies the out-of-band code to confirm verification
 * 3. Refreshes the emailVerified status in AuthContext
 * 4. Shows success or error state
 */
export function EmailVerifyPage() {
  const { refreshEmailVerified: refreshVerified } = useAuth()
  const [searchParams] = useState(() => new URLSearchParams(window.location.search))
  const oobCode = useMemo(() => searchParams.get('oobCode') ?? '', [searchParams])

  const [verifying, setVerifying] = useState(() => !!oobCode)
  const [verified, setVerified] = useState(false)
  const [verifyError, setVerifyError] = useState(() =>
    oobCode ? '' : 'No verification code provided. Please request a new verification email.',
  )

  // Apply the verification code on mount
  useEffect(() => {
    if (!oobCode) return
    let cancelled = false

    applyEmailVerificationCode(oobCode)
      .then(async () => {
        if (cancelled) return
        // Refresh the emailVerified status in AuthContext
        await refreshVerified()
        if (!cancelled) {
          setVerified(true)
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
  }, [oobCode, refreshVerified])

  if (verifying) {
    return (
      <PublicAuthPanel
        title="Verify Email"
        subtitle="Verifying your email address..."
        icon={appIcons.recovery}
        cues={[]}
        footer={<Link className="text-link" to="/login">Back to sign in</Link>}
      >
        <p role="status">Verifying email, please wait.</p>
      </PublicAuthPanel>
    )
  }

  if (verified) {
    return (
      <PublicAuthPanel
        title="Verify Email"
        subtitle="Your email has been verified."
        icon={appIcons.recovery}
        cues={[
          { label: 'Verified', detail: 'Your email address is now verified. You can sign in and use all features.' },
        ]}
        footer={<Link className="text-link" to="/login">Back to sign in</Link>}
      >
        <div className="inline-success" role="status">
          Your email has been verified successfully. You can now sign in.
        </div>
        <p><Link to="/login">Go to sign in</Link></p>
      </PublicAuthPanel>
    )
  }

  return (
    <PublicAuthPanel
      title="Verify Email"
      subtitle="The verification link could not be processed."
      icon={appIcons.recovery}
      cues={[]}
      footer={<Link className="text-link" to="/login">Back to sign in</Link>}
    >
      <div className="inline-error" role="alert">{verifyError}</div>
      <p><Link to="/login">Go to sign in</Link></p>
    </PublicAuthPanel>
  )
}
