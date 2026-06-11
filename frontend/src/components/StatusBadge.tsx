import { statusAccessibleLabel, statusExplanation, statusLabel } from './StatusLanguage'

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll('_', '-')
  const accessibleLabel = statusAccessibleLabel(value)
  const explanation = statusExplanation(value)
  return (
    <span className={`status-badge status-${normalized}`} aria-label={accessibleLabel} title={explanation}>
      {statusLabel(value)}
    </span>
  )
}
