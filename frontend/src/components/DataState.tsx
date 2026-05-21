export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <div className="state-panel">{label}</div>
}

export function EmptyState({ label }: { label: string }) {
  return <div className="state-panel">{label}</div>
}

export function ErrorState({ title, details }: { title: string; details?: string[] }) {
  return (
    <div className="state-panel state-error">
      <strong>{title}</strong>
      {details?.length ? <span>{details.join(' ')}</span> : null}
    </div>
  )
}
