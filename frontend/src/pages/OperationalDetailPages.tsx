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
import { Metric } from '../components/Metric'
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
  if (state.error) return <ErrorState title={state.error} />
  if (!state.data) return <EmptyState label="Order detail is unavailable" />

  const { order, timeline, shipments, carrierDispatches, outboxEvents } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Order Detail" subtitle={order.customerAddress} />
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
  if (state.error) return <ErrorState title={state.error} />
  if (!state.data) return <EmptyState label="Inventory item detail is unavailable" />

  const { item, auditLogs, inboundRequests, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Inventory Item Detail" subtitle={`${item.sku} - ${item.name}`} />
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
  if (state.error) return <ErrorState title={state.error} />
  if (!state.data) return <EmptyState label="Inbound stock detail is unavailable" />

  const { inboundStockRequest: inbound, relationship, auditLogs, outboxEvents, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Inbound Stock Detail" subtitle={`${inbound.merchantName} to ${inbound.warehouseProviderName}`} />
      <div className="metric-grid">
        <Metric label="Requested" value={inbound.requestedQuantity} />
        <Metric label="Received" value={inbound.receivedQuantity} />
        <Metric label="Damaged" value={inbound.damagedQuantity} />
        <Metric label="Shortage" value={inbound.shortageQuantity} />
      </div>
      <SummaryRows rows={[
        ['Status', <StatusBadge value={inbound.status} />],
        ['Warehouse', inbound.warehouseName],
        ['Item', `${inbound.sku} - ${inbound.itemName}`],
        ['Relationship', <Link className="text-link" to={`/merchant-warehouse/relationships/${relationship.id}`}>{shortId(relationship.id)}</Link>],
        ['Receiving note', inbound.receivingNote ?? 'None'],
        ['Rejection reason', inbound.rejectionReason ?? 'None'],
      ]} />
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
  if (state.error) return <ErrorState title={state.error} />
  if (!state.data) return <EmptyState label="Shipment detail is unavailable" />

  const { shipment, allocation, order, carrierDispatches, outboxEvents, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Shipment Detail" subtitle={`${shipment.carrier} ${shipment.trackingNumber ?? ''}`} />
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
        ['Packages', shipment.packageCount ?? 'Unknown'],
        ['Weight kg', shipment.packageWeightKg ?? 'Unknown'],
        ['Dimensions', shipment.packageLengthCm && shipment.packageWidthCm && shipment.packageHeightCm
          ? `${shipment.packageLengthCm} x ${shipment.packageWidthCm} x ${shipment.packageHeightCm} cm`
          : 'Unknown'],
        ['Packing note', shipment.packingNote ?? 'None'],
        ['Customer', order.customerAddress],
      ]} />
      <TimelinePanel events={timeline} />
    </div>
  )
}

export function FulfillmentAllocationDetailPage() {
  const { allocationId } = useParams()
  const load = useCallback((token: string, id: string) => api.fulfillmentAllocationDetail(token, id), [])
  const state = useDetail<FulfillmentAllocationDetail>(load, allocationId)
  if (state.loading) return <LoadingState />
  if (state.error) return <ErrorState title={state.error} />
  if (!state.data) return <EmptyState label="Allocation detail is unavailable" />

  const { allocation, order, shipments, carrierDispatches, outboxEvents, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Allocation Detail" subtitle={`${allocation.warehouseName} serving ${allocation.merchantName}`} />
      <div className="metric-grid">
        <Metric label="Pick rows" value={allocation.items.length} />
        <Metric label="Shipments" value={shipments.length} />
        <Metric label="Dispatches" value={carrierDispatches.length} />
        <Metric label="Outbox events" value={outboxEvents.length} />
      </div>
      <SummaryRows rows={[
        ['Status', <StatusBadge value={allocation.status} />],
        ['Order', <Link className="text-link" to={`/orders/${order.id}`}>{shortId(order.id)}</Link>],
        ['Customer', allocation.customerAddress],
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
    </div>
  )
}

export function MerchantWarehouseRelationshipDetailPage() {
  const { relationshipId } = useParams()
  const load = useCallback((token: string, id: string) => api.merchantWarehouseRelationshipDetail(token, id), [])
  const state = useDetail<MerchantWarehouseRelationshipDetail>(load, relationshipId)
  if (state.loading) return <LoadingState />
  if (state.error) return <ErrorState title={state.error} />
  if (!state.data) return <EmptyState label="Relationship detail is unavailable" />

  const { relationship, inboundStockRequests, allocations, outboxEvents, timeline } = state.data
  return (
    <div className="page-stack">
      <PageHeading title="Service Relationship Detail" subtitle={`${relationship.merchantName} and ${relationship.warehouseProviderName}`} />
      <div className="metric-grid">
        <Metric label="Inbound requests" value={inboundStockRequests.length} />
        <Metric label="Allocations" value={allocations.length} />
        <Metric label="Outbox events" value={outboxEvents.length} />
        <Metric label="Status" value={relationship.status} />
      </div>
      <SummaryRows rows={[
        ['Status', <StatusBadge value={relationship.status} />],
        ['Service notes', relationship.serviceNotes ?? 'None'],
        ['Requested', formatDate(relationship.createdAt)],
        ['Activated', relationship.approvedAt ? formatDate(relationship.approvedAt) : 'Not activated'],
      ]} />
      <RelatedLinks rows={[
        ...inboundStockRequests.map((request) => ({
          label: `Inbound ${request.merchantReference ?? shortId(request.id)}`,
          to: `/inbound-stock-requests/${request.id}`,
          meta: request.status,
        })),
        ...allocations.map((allocation) => ({
          label: `Allocation ${shortId(allocation.id)}`,
          to: `/fulfillment-allocations/${allocation.id}`,
          meta: allocation.status,
        })),
      ]} />
      <TimelinePanel events={timeline} />
    </div>
  )
}

export function TimelinePanel({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="timeline-section">
      <h2>Timeline</h2>
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
        <EmptyState label="No lifecycle events recorded yet" />
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

function ItemsTable({ rows }: { rows: Array<[string, string, number]> }) {
  if (!rows.length) return <EmptyState label="No item rows available" />
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
                <td>{quantity}</td>
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
    return <EmptyState label="No inventory audit events yet" />
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
                <td>{log.beforeQuantity} / reserved {log.beforeReservedQuantity}</td>
                <td>{log.afterQuantity} / reserved {log.afterReservedQuantity}</td>
                <td>{log.reasonCode ? `${log.reasonCode}: ${log.reasonNote ?? ''}` : 'System workflow'}</td>
                <td>{log.actorUserId ? shortId(log.actorUserId) : 'System'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RelatedLinks({ rows }: { rows: Array<{ label: string; to: string; meta: string }> }) {
  if (!rows.length) return <EmptyState label="No linked operational records yet" />
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

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function shortId(id: string) {
  return id.slice(0, 8)
}
