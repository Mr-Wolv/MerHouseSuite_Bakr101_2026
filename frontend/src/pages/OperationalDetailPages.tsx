import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type {
  FulfillmentAllocationDetail,
  InboundStockRequestDetail,
  InventoryItemDetail,
  MerchantWarehouseRelationshipDetail,
  OrderDetail,
  ShipmentDetail,
  TimelineEvent,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { shortId } from '../components/format'
import { Metric } from '../components/Metric'
import { PageHeading, QuantityCell } from '../components/PageChrome'
import { StatusBadge } from '../components/StatusBadge'

type DetailState<T> = {
  data: T | null
  loading: boolean
  error: string
}

function useDetail<T>(loader: (token: string, key: string) => Promise<T>, key: string | undefined) {
  const { token } = useAuth()
  const [state, setState] = useState<DetailState<T>>({ data: null, loading: true, error: '' })

  useEffect(() => {
    if (!token || !key) return
    queueMicrotask(() => setState({ data: null, loading: true, error: '' }))
    loader(token, key)
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((caught) => {
        setState({
          data: null,
          loading: false,
          error: caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load operational detail.',
        })
      })
  }, [key, loader, token])

  return state
}

export function OrderDetailPage() {
  const { orderId } = useParams()
  const load = useCallback((token: string, id: string) => api.orderDetail(token, id), [])
  const state = useDetail<OrderDetail>(load, orderId)
  if (state.loading) return <LoadingState />
  if (state.error) return <ErrorState title={state.error} pageTitle />
  if (!state.data) return <EmptyState label="Order detail is unavailable" guidance="Return to the order queue and open a current order link so allocation, shipment, timeline, and outbox evidence stay in sync." />

  const { order, timeline, shipments, carrierDispatches, outboxEvents } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Order Detail" subtitle={order.customerAddress} />
      <DetailGuidancePanel title="Order lifecycle review">
        Scan status, linked allocations, shipments, timeline, and outbox evidence together before acting from the order queue.
      </DetailGuidancePanel>
      <div className="metric-grid">
        <Metric label="Items" value={order.items.length} />
        <Metric label="Allocations" value={order.allocations.length} />
        <Metric label="Backorders" value={order.backorders.length} />
        <Metric label="Shipments" value={shipments.length} />
      </div>
      <SummaryRows rows={[
        ['Order', shortId(order.id)],
        ['Merchant', shortId(order.merchantId)],
        ['Status', <StatusBadge value={order.status} />],
        ['Created', formatDate(order.createdAt)],
      ]} />
      <ItemsTable rows={order.items.map((item) => [item.sku, item.itemName, item.quantity])} />
      <RelatedLinks
        rows={[
          ...order.allocations.map((allocation) => ({
            label: `Allocation ${shortId(allocation.id)}`,
            to: `/fulfillment-allocations/${allocation.id}`,
            meta: allocation.warehouseName,
          })),
          ...shipments.map((shipment) => ({
            label: `Shipment ${shortId(shipment.id)}`,
            to: `/shipments/${shipment.id}`,
            meta: `${shipment.carrier} ${shipment.trackingNumber ?? ''}`,
          })),
        ]}
      />
      <TimelinePanel events={timeline} />
      <EvidenceCounts dispatches={carrierDispatches.length} outbox={outboxEvents.length} />
    </div>
  )
}

export function InventoryItemDetailPage() {
  const { inventoryItemId } = useParams()
  const load = useCallback((token: string, id: string) => api.inventoryItemDetail(token, id), [])
  const state = useDetail<InventoryItemDetail>(load, inventoryItemId)
  if (state.loading) return <LoadingState />
  if (state.error) {
    return (
      <RecoverableDetailState
        title={state.error}
        guidance="This item may have been archived, removed, or belongs to another merchant context. Return to Stock and open a current item link."
        actionLabel="Back to Stock"
        to="/merchant/inventory"
      />
    )
  }
  if (!state.data) {
    return (
      <RecoverableDetailState
        title="Inventory item detail is unavailable"
        guidance="Return to Stock and open a current item link from the table to review stock and audit evidence."
        actionLabel="Back to Stock"
        to="/merchant/inventory"
      />
    )
  }

  const { item, auditLogs, inboundRequests, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Inventory Item Detail" subtitle={`${item.sku} - ${item.name}`} />
      <DetailGuidancePanel title="Inventory evidence review">
        Review inbound records, audit changes, and lifecycle events together so stock changes have visible operational evidence.
      </DetailGuidancePanel>
      <div className="metric-grid">
        <Metric label="Audit events" value={auditLogs.length} />
        <Metric label="Inbound requests" value={inboundRequests.length} />
        <Metric label="Attributes" value={Object.keys(item.attributes ?? {}).length} />
        <Metric label="Merchant" value={shortId(item.merchantId)} />
      </div>
      <RelatedLinks rows={inboundRequests.map((request) => ({
        label: `Inbound ${request.merchantReference ?? shortId(request.id)}`,
        to: `/inbound-stock-requests/${request.id}`,
        meta: request.warehouseName,
      }))} />
      <AuditLogTable logs={auditLogs} />
      <TimelinePanel events={timeline} />
    </div>
  )
}

export function InboundStockRequestDetailPage() {
  const { inboundStockRequestId } = useParams()
  const load = useCallback((token: string, id: string) => api.inboundStockRequestDetail(token, id), [])
  const state = useDetail<InboundStockRequestDetail>(load, inboundStockRequestId)
  if (state.loading) return <LoadingState />
  if (state.error) return <ErrorState title={state.error} pageTitle />
  if (!state.data) return <EmptyState label="Inbound stock detail is unavailable" guidance="Return to inbound stock requests and open a current receiving record." />

  const { inboundStockRequest: inbound, relationship, auditLogs, outboxEvents, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Inbound Stock Detail" subtitle={`${inbound.merchantName} to ${inbound.warehouseProviderName}`} />
      <DetailGuidancePanel title="Inbound receiving evidence">
        Compare requested, received, damaged, and shortage counts with audit and outbox evidence before closing receiving work.
      </DetailGuidancePanel>
      <div className="metric-grid">
        <Metric label="Requested" value={inbound.requestedQuantity} />
        <Metric label="Received" value={inbound.receivedQuantity} />
        <Metric label="Damaged" value={inbound.damagedQuantity} />
        <Metric label="Shortage" value={inbound.shortageQuantity} />
      </div>
      <SummaryRows rows={[
        ['Status', <StatusBadge value={inbound.status} />],
        ['Requested', <QuantityCell value={inbound.requestedQuantity} tone="pending" />],
        ['Received', <QuantityCell value={inbound.receivedQuantity} tone={inbound.receivedQuantity >= inbound.requestedQuantity ? 'ready' : 'pending'} />],
        ['Damaged', <QuantityCell value={inbound.damagedQuantity} tone={inbound.damagedQuantity > 0 ? 'risk' : 'neutral'} />],
        ['Shortage', <QuantityCell value={inbound.shortageQuantity} tone={inbound.shortageQuantity > 0 ? 'risk' : 'ready'} />],
        ['Warehouse', inbound.warehouseName],
        ['Item', `${inbound.sku} - ${inbound.itemName}`],
        ['Relationship', <Link className="text-link" to={`/merchant-warehouse/relationships/${relationship.id}`}>{shortId(relationship.id)}</Link>],
        ['Receiving note', <span className="note-cell">{inbound.receivingNote ?? 'None'}</span>],
        ['Rejection reason', <span className="note-cell">{inbound.rejectionReason ?? 'None'}</span>],
      ]} />
      <AuditLogTable logs={auditLogs} />
      <TimelinePanel events={timeline} />
      <EvidenceCounts audits={auditLogs.length} outbox={outboxEvents.length} />
    </div>
  )
}

export function ShipmentDetailPage() {
  const { shipmentId } = useParams()
  const load = useCallback((token: string, id: string) => api.shipmentDetail(token, id), [])
  const state = useDetail<ShipmentDetail>(load, shipmentId)
  if (state.loading) return <LoadingState />
  if (state.error) return <ErrorState title={state.error} pageTitle />
  if (!state.data) return <EmptyState label="Shipment detail is unavailable" guidance="Return to the shipment or allocation queue and open a current shipment link." />

  const { shipment, allocation, order, carrierDispatches, outboxEvents, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Shipment Detail" subtitle={`${shipment.carrier} ${shipment.trackingNumber ?? ''}`} />
      <DetailGuidancePanel title="Shipment handoff review">
        Confirm carrier, tracking, package measurements, dispatch evidence, and order linkage before treating delivery status as final.
      </DetailGuidancePanel>
      <div className="metric-grid">
        <Metric label="Dispatches" value={carrierDispatches.length} />
        <Metric label="Outbox events" value={outboxEvents.length} />
        <Metric label="Allocation items" value={allocation.items.length} />
        <Metric label="Order items" value={order.items.length} />
      </div>
      <SummaryRows rows={[
        ['Status', <StatusBadge value={shipment.status} />],
        ['Order', <Link className="text-link" to={`/orders/${order.id}`}>{shortId(order.id)}</Link>],
        ['Allocation', <Link className="text-link" to={`/fulfillment-allocations/${allocation.id}`}>{shortId(allocation.id)}</Link>],
        ['Packages', typeof shipment.packageCount === 'number' ? <QuantityCell value={shipment.packageCount} tone="ready" /> : 'Unknown'],
        ['Weight kg', shipment.packageWeightKg ?? 'Unknown'],
        ['Dimensions', shipment.packageLengthCm && shipment.packageWidthCm && shipment.packageHeightCm
          ? `${shipment.packageLengthCm} x ${shipment.packageWidthCm} x ${shipment.packageHeightCm} cm`
          : 'Unknown'],
        ['Packing note', <span className="note-cell">{shipment.packingNote ?? 'None'}</span>],
        ['Customer', <span className="note-cell">{order.customerAddress}</span>],
      ]} />
      <PackageEvidenceTable packages={shipment.packages} />
      <TimelinePanel events={timeline} />
      <EvidenceCounts dispatches={carrierDispatches.length} outbox={outboxEvents.length} />
    </div>
  )
}

export function FulfillmentAllocationDetailPage() {
  const { allocationId } = useParams()
  const load = useCallback((token: string, id: string) => api.fulfillmentAllocationDetail(token, id), [])
  const state = useDetail<FulfillmentAllocationDetail>(load, allocationId)
  if (state.loading) return <LoadingState />
  if (state.error) return <ErrorState title={state.error} pageTitle />
  if (!state.data) return <EmptyState label="Allocation detail is unavailable" guidance="Return to fulfillment allocations and open a current pick or ship record." />

  const { allocation, order, shipments, carrierDispatches, outboxEvents, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Allocation Detail" subtitle={`${allocation.warehouseName} serving ${allocation.merchantName}`} />
      <DetailGuidancePanel title="Allocation pick and ship review">
        Review pick rows, scan code, pick-sheet state, shipment links, and dispatch evidence before moving warehouse work forward.
      </DetailGuidancePanel>
      <div className="metric-grid">
        <Metric label="Pick rows" value={allocation.items.length} />
        <Metric label="Shipments" value={shipments.length} />
        <Metric label="Dispatches" value={carrierDispatches.length} />
        <Metric label="Outbox events" value={outboxEvents.length} />
      </div>
      <SummaryRows rows={[
        ['Status', <StatusBadge value={allocation.status} />],
        ['Order', <Link className="text-link" to={`/orders/${order.id}`}>{shortId(order.id)}</Link>],
        ['Priority', <QuantityCell value={allocation.priority} tone={allocation.priority <= 2 ? 'risk' : 'pending'} />],
        ['Scan', allocation.scanCode ? <span className="data-chip">{allocation.scanCode}</span> : <span className="data-chip warning-chip">Scan pending</span>],
        ['Pick sheet', allocation.pickSheetPrintedAt ? formatDate(allocation.pickSheetPrintedAt) : <span className="data-chip warning-chip">Pick sheet needed</span>],
        ['Customer', <span className="note-cell">{allocation.customerAddress}</span>],
        ['Service relationship', allocation.merchantWarehouseRelationshipId ? (
          <Link className="text-link" to={`/merchant-warehouse/relationships/${allocation.merchantWarehouseRelationshipId}`}>
            {allocation.serviceRelationshipStatus ?? shortId(allocation.merchantWarehouseRelationshipId)}
          </Link>
        ) : 'Unlinked'],
      ]} />
      <ItemsTable rows={allocation.items.map((item) => [item.sku, item.itemName, item.quantity])} />
      <RelatedLinks rows={shipments.map((shipment) => ({
        label: `Shipment ${shortId(shipment.id)}`,
        to: `/shipments/${shipment.id}`,
        meta: shipment.status,
      }))} />
      <TimelinePanel events={timeline} />
      <EvidenceCounts dispatches={carrierDispatches.length} outbox={outboxEvents.length} />
    </div>
  )
}

export function MerchantWarehouseRelationshipDetailPage() {
  const { relationshipId } = useParams()
  const load = useCallback((token: string, id: string) => api.merchantWarehouseRelationshipDetail(token, id), [])
  const state = useDetail<MerchantWarehouseRelationshipDetail>(load, relationshipId)
  if (state.loading) return <LoadingState />
  if (state.error) return <ErrorState title={state.error} pageTitle />
  if (!state.data) return <EmptyState label="Relationship detail is unavailable" guidance="Return to relationship governance and open a current merchant-warehouse relationship." />

  const { relationship, inboundStockRequests, allocations, outboxEvents, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Service Relationship Detail" subtitle={`${relationship.merchantName} and ${relationship.warehouseProviderName}`} />
      <DetailGuidancePanel title="Relationship boundary review">
        Review merchant/provider ownership, lifecycle status, inbound work, allocation work, and outbox evidence before changing the service boundary.
      </DetailGuidancePanel>
      <div className="metric-grid">
        <Metric label="Inbound requests" value={inboundStockRequests.length} />
        <Metric label="Allocations" value={allocations.length} />
        <Metric label="Outbox events" value={outboxEvents.length} />
        <Metric label="Status" value={relationship.status} />
      </div>
      <SummaryRows rows={[
        ['Status', <StatusBadge value={relationship.status} />],
        ['Merchant', relationship.merchantName],
        ['Provider', relationship.warehouseProviderName],
        ['Service notes', <span className="note-cell">{relationship.serviceNotes ?? 'None'}</span>],
        ['Requested', <span className="timestamp-cell">{formatDate(relationship.createdAt)}</span>],
        ['Activated', relationship.approvedAt ? <span className="timestamp-cell">{formatDate(relationship.approvedAt)}</span> : <span className="data-chip warning-chip">Not activated</span>],
        ['Suspended', relationship.suspendedAt ? <span className="timestamp-cell">{formatDate(relationship.suspendedAt)}</span> : 'No'],
        ['Ended', relationship.endedAt ? <span className="timestamp-cell">{formatDate(relationship.endedAt)}</span> : 'No'],
        ['Status reason', <span className="note-cell">{relationship.statusReason ?? 'None'}</span>],
      ]} />
      <RelatedLinks rows={[
        ...inboundStockRequests.map((request) => ({
          label: `Inbound ${request.merchantReference ?? shortId(request.id)}`,
          to: `/inbound-stock-requests/${request.id}`,
          meta: `${request.status} · ${request.requestedQuantity} requested · ${request.receivedQuantity} received`,
        })),
        ...allocations.map((allocation) => ({
          label: `Allocation ${shortId(allocation.id)}`,
          to: `/fulfillment-allocations/${allocation.id}`,
          meta: `${allocation.status} · priority ${allocation.priority} · ${allocation.scanCode ?? 'scan pending'}`,
        })),
      ]} />
      <TimelinePanel events={timeline} />
      <EvidenceCounts outbox={outboxEvents.length} />
    </div>
  )
}

export function TimelinePanel({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="timeline-section">
      <div className="section-heading-row">
        <h2>Timeline</h2>
        <span>{events.length} events</span>
      </div>
      {events.length ? (
        <ol className="timeline-list">
          {events.map((event, index) => (
            <li key={`${event.sourceType}-${event.sourceId}-${event.eventType}-${index}`}>
              <div>
                <strong>{event.label}</strong>
                <span>{formatDate(event.occurredAt)}</span>
              </div>
              <p>{event.detail}</p>
              <small>{event.sourceType} / {event.eventType}</small>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState label="No lifecycle events recorded yet" guidance="Lifecycle events will appear as this record moves through creation, review, receiving, fulfillment, shipment, or closure." />
      )}
    </section>
  )
}

function SummaryRows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <section className="table-section">
      <h2>Summary</h2>
      <div className="detail-grid">
        {rows.map(([label, value]) => (
          <div className="detail-cell" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function DetailGuidancePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="admin-guidance-panel" aria-label={title}>
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  )
}

function RecoverableDetailState({
  title,
  guidance,
  actionLabel,
  to,
}: {
  title: string
  guidance: string
  actionLabel: string
  to: string
}) {
  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>{title}</h1>
      </div>
      <EmptyState
        label={title}
        guidance={guidance}
        action={<Link className="icon-text-button" to={to}>{actionLabel}</Link>}
      />
    </div>
  )
}

function ItemsTable({ rows }: { rows: Array<[string, string, number]> }) {
  if (!rows.length) return <EmptyState label="No item rows available" guidance="Item rows appear when orders, inbound requests, allocations, or package records carry line-level work." />
  return (
    <section className="table-section">
      <h2>Items</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([sku, name, quantity]) => (
              <tr key={`${sku}-${name}`}>
                <td>{sku}</td>
                <td>{name}</td>
                <td><QuantityCell value={quantity} tone="ready" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PackageEvidenceTable({ packages }: { packages: ShipmentDetail['shipment']['packages'] }) {
  if (!packages.length) return <EmptyState label="No package evidence recorded yet" guidance="Package evidence appears after warehouse operators record carrier, measurement, and handoff details." />
  return (
    <section className="table-section">
      <h2>Package Evidence</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Label</th>
              <th>Status</th>
              <th>Weight</th>
              <th>Dimensions</th>
              <th>Events</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr key={pkg.id}>
                <td><QuantityCell value={pkg.packageNumber} tone="ready" /></td>
                <td className="mono-cell">{pkg.labelCode}</td>
                <td><StatusBadge value={pkg.status} /></td>
                <td>{pkg.weightKg} kg</td>
                <td>{pkg.lengthCm} x {pkg.widthCm} x {pkg.heightCm} cm</td>
                <td className="note-cell">
                  {pkg.events.length ? pkg.events.map((event) => event.note ?? event.eventType).join('; ') : 'No package events yet'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AuditLogTable({ logs }: { logs: InventoryItemDetail['auditLogs'] }) {
  if (!logs.length) {
    return <EmptyState label="No inventory audit events yet" guidance="Stock adjustments, reservations, releases, and receiving updates will create audit evidence here." />
  }

  return (
    <section className="table-section">
      <h2>Inventory Audit Evidence</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Before</th>
              <th>After</th>
              <th>Reason</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 12).map((log) => (
              <tr key={log.id}>
                <td><StatusBadge value={log.action} /></td>
                <td><StockChange before={log.beforeQuantity} reserved={log.beforeReservedQuantity} /></td>
                <td><StockChange before={log.afterQuantity} reserved={log.afterReservedQuantity} /></td>
                <td className="note-cell">{log.reasonCode ? `${log.reasonCode}: ${log.reasonNote ?? ''}` : 'System workflow'}</td>
                <td>{log.actorUserId ? shortId(log.actorUserId) : 'System'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function StockChange({ before, reserved }: { before: number; reserved: number }) {
  return (
    <span className="stock-change">
      <QuantityCell value={before} tone={before > 0 ? 'ready' : 'neutral'} />
      <small>reserved {reserved}</small>
    </span>
  )
}

function RelatedLinks({ rows }: { rows: Array<{ label: string; to: string; meta: string }> }) {
  if (!rows.length) return <EmptyState label="No linked operational records yet" guidance="Linked allocations, shipments, inbound requests, or relationship records appear when this workflow connects to downstream work." />
  return (
    <section className="table-section">
      <h2>Linked Records</h2>
      <div className="related-list">
        {rows.map((row) => (
          <Link className="related-link" key={`${row.to}-${row.label}`} to={row.to}>
            <strong>{row.label}</strong>
            <span>{row.meta}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function EvidenceCounts({ audits = 0, dispatches = 0, outbox = 0 }: { audits?: number; dispatches?: number; outbox?: number }) {
  return (
    <div className="status-row">
      <div className="status-count"><span>Audit events</span><strong>{audits}</strong></div>
      <div className="status-count"><span>Carrier dispatches</span><strong>{dispatches}</strong></div>
      <div className="status-count"><span>Outbox events</span><strong>{outbox}</strong></div>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
