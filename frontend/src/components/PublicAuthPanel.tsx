import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

type PublicAuthCue = {
  label: string
  detail: string
}

type PublicAuthPanelProps = {
  title: string
  subtitle: string
  icon: LucideIcon
  cues: PublicAuthCue[]
  children: ReactNode
  footer?: ReactNode
}

export function PublicAuthPanel({ title, subtitle, icon: Icon, cues, children, footer }: PublicAuthPanelProps) {
  return (
    <main className="login-page public-auth-page">
      <section className="login-panel public-auth-panel" aria-labelledby="auth-title">
        <div className="public-theme-row">
          <ThemeToggle />
        </div>

        <div className="public-auth-heading">
          <span className="public-auth-icon" aria-hidden="true">
            <Icon size={22} strokeWidth={2.4} />
          </span>
          <div>
            <span className="eyebrow">MerHouse</span>
            <h1 id="auth-title">{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>

        <dl className="public-auth-cues" aria-label="Public account workflow guardrails">
          {cues.map((cue) => (
            <div key={cue.label}>
              <dt>{cue.label}</dt>
              <dd>{cue.detail}</dd>
            </div>
          ))}
        </dl>

        {children}
        {footer ? <nav className="login-actions" aria-label="Account help">{footer}</nav> : null}
      </section>
    </main>
  )
}
