import type { ReactNode } from 'react'

export type QuantityTone = 'neutral' | 'ready' | 'pending' | 'risk'

export function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}

export function GuidancePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="admin-guidance-panel" aria-label={title}>
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  )
}

export function WorkflowDivider({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="workflow-divider">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

export function FirstRunChecklist({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; done: boolean; detail: string }>
}) {
  return (
    <section className="first-run-checklist" aria-label={title}>
      <div className="section-heading-row">
        <h2>{title}</h2>
        <span>{items.filter((item) => item.done).length}/{items.length} ready</span>
      </div>
      <ol>
        {items.map((item) => (
          <li className={item.done ? 'is-complete' : ''} key={item.label}>
            <span className={item.done ? 'data-chip' : 'data-chip warning-chip'}>{item.done ? 'Ready' : 'Next'}</span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function QuantityCell({ value, tone = 'neutral' }: { value: number; tone?: QuantityTone }) {
  return <span className={`quantity-cell quantity-${tone}`}>{value}</span>
}
