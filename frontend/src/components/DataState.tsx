import type { ReactNode } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { appIcons } from './AppIcons'

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state-panel state-loading" role="status" aria-live="polite">
      <LoaderCircle size={18} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  label,
  guidance,
  action,
}: {
  label: string
  guidance?: string
  action?: ReactNode
}) {
  return (
    <div className="state-panel empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <EmptyStateGlyph label={label} guidance={guidance} />
      </span>
      <div>
        <strong>{label}</strong>
        {guidance ? <p>{guidance}</p> : null}
      </div>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title,
  details,
  pageTitle = false,
}: {
  title: string
  details?: string[]
  pageTitle?: boolean
}) {
  return (
    <div className="state-panel state-error">
      <span className="state-error-icon" aria-hidden="true">
        <TriangleAlert size={18} />
      </span>
      <div>
        {pageTitle ? <h1>{title}</h1> : <strong>{title}</strong>}
        {details?.length ? <span>{details.join(' ')}</span> : null}
      </div>
    </div>
  )
}

function EmptyStateGlyph({ label, guidance = '' }: { label: string; guidance?: string }) {
  const text = `${label} ${guidance}`.toLowerCase()
  if (text.includes('unavailable') || text.includes('not found')) return <appIcons.notFound size={20} />
  if (text.includes('alert') || text.includes('notification')) return <appIcons.alertsActive size={20} />
  if (text.includes('assistant')) return <appIcons.assistant size={20} />
  if (text.includes('inventory') || text.includes('stock') || text.includes('sku')) return <appIcons.inventory size={20} />
  if (text.includes('order') || text.includes('backorder')) return <appIcons.orders size={20} />
  if (text.includes('warehouse') || text.includes('fulfillment') || text.includes('allocation')) return <appIcons.warehouseWork size={20} />
  if (text.includes('shipment') || text.includes('carrier') || text.includes('package')) return <appIcons.shipments size={20} />
  if (text.includes('inbound') || text.includes('receiving')) return <appIcons.receiving size={20} />
  if (text.includes('relationship')) return <appIcons.relationships size={20} />
  if (text.includes('service') || text.includes('sla') || text.includes('statement')) return <appIcons.service size={20} />
  if (text.includes('audit') || text.includes('evidence')) return <appIcons.audit size={20} />
  if (text.includes('access') || text.includes('account')) return <appIcons.access size={20} />
  if (text.includes('tenant') || text.includes('platform')) return <appIcons.governance size={20} />
  return <appIcons.operations size={20} />
}
