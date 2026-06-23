import type { ReactNode } from 'react'
import { useId } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { appIcons } from './AppIcons'

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state-panel state-loading" role="status" aria-live="polite">
      <span className="state-loading-icon" aria-hidden="true">
        <LoaderCircle size={18} />
      </span>
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
  const titleId = useId()
  const guidanceId = useId()
  return (
    <section
      className="state-panel empty-state"
      aria-labelledby={titleId}
      aria-describedby={guidance ? guidanceId : undefined}
    >
      <span className="empty-state-icon" aria-hidden="true">
        <EmptyStateGlyph label={label} guidance={guidance} />
      </span>
      <div>
        <strong id={titleId}>{label}</strong>
        {guidance ? <p id={guidanceId}>{guidance}</p> : null}
      </div>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </section>
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
  const titleId = useId()
  const detailsId = useId()
  return (
    <div
      className="state-panel state-error"
      role="alert"
      aria-labelledby={titleId}
      aria-describedby={details?.length ? detailsId : undefined}
    >
      <span className="state-error-icon" aria-hidden="true">
        <TriangleAlert size={18} />
      </span>
      <div>
        {pageTitle ? <h1 id={titleId}>{title}</h1> : <strong id={titleId}>{title}</strong>}
        {details?.length ? <p id={detailsId}>{details.join(' ')}</p> : null}
      </div>
    </div>
  )
}

function EmptyStateGlyph({ label, guidance = '' }: { label: string; guidance?: string }) {
  const text = `${label} ${guidance}`.toLowerCase()
  if (text.includes('unavailable') || text.includes('not found')) return <appIcons.notFound size={20} />
  if (text.includes('alert') || text.includes('notification')) return <appIcons.alertsActive size={20} />
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
