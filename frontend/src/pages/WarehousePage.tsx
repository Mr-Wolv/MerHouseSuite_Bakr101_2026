import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type {
  FulfillmentAllocation,
  FulfillmentException,
  FulfillmentStatus,
  InboundStockRequest,
  MerchantWarehouseRelationship,
  ShipmentStatus,
  Warehouse,
  DashboardSummary,
  WarehouseInventory,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { Metric } from '../components/Metric'
import { StatusBadge } from '../components/StatusBadge'

type ShipmentDraft = {
  carrier: string
  trackingNumber: string
  packageCount: number
  packageWeightKg: number
  packageLengthCm: number
  packageWidthCm: number
  packageHeightCm: number
  packingNote: string
}

const carrierOptions = ['Local Carrier', 'FedEx', 'DHL', 'UPS', 'Aramex']
const adjustmentReasons = [
  'CYCLE_COUNT_GAIN',
  'CYCLE_COUNT_SHORTAGE',
  'DAMAGED_STOCK',
  'RETURN_RESTOCK',
  'WAREHOUSE_CORRECTION',
]

export function WarehousePage() {
  const { token } = useAuth()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [inventory, setInventory] = useState<WarehouseInventory[]>([])
  const [allocations, setAllocations] = useState<FulfillmentAllocation[]>([])
  const [exceptions, setExceptions] = useState<FulfillmentException[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [relationships, setRelationships] = useState<MerchantWarehouseRelationship[]>([])
  const [inboundRequests, setInboundRequests] = useState<InboundStockRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<'ALL' | FulfillmentStatus>('ALL')
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, ShipmentDraft>>({})
  const [adjustmentDrafts, setAdjustmentDrafts] = useState<Record<string, { quantityDelta: number; reasonCode: string; reasonNote: string }>>({})
  const [loading, setLoading] = useState(true)
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.warehouses(token),
      api.fulfillmentAllocations(token),
      api.merchantWarehouseRelationships(token),
      api.inboundStockRequests(token),
      api.fulfillmentExceptions(token),
      api.warehouseDashboard(token),
    ])
      .then(([nextWarehouses, nextAllocations, nextRelationships, nextInboundRequests, nextExceptions, nextDashboard]) => {
        setWarehouses(nextWarehouses)
        setSelectedWarehouseId(nextWarehouses[0]?.id ?? '')
        setAllocations(nextAllocations)
        setRelationships(nextRelationships)
        setInboundRequests(nextInboundRequests)
        setExceptions(nextExceptions)
        setDashboard(nextDashboard)
      })
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load warehouse console.')
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token || !selectedWarehouseId) return
    queueMicrotask(() => setInventoryLoading(true))
    api.warehouseInventory(token, selectedWarehouseId)
      .then(setInventory)
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load warehouse inventory.')
      })
      .finally(() => setInventoryLoading(false))
  }, [selectedWarehouseId, token])

  const selected = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId)
  const warehouseAllocations = allocations.filter((allocation) => allocation.warehouseId === selectedWarehouseId)
  const warehouseInboundRequests = inboundRequests.filter((request) => request.warehouseId === selectedWarehouseId)
  const filteredAllocations = warehouseAllocations.filter((allocation) => statusFilter === 'ALL' || allocation.status === statusFilter)
  const recentShipments = warehouseAllocations
    .map((allocation) => allocation.shipment ? { allocation, shipment: allocation.shipment } : null)
    .filter((row): row is { allocation: FulfillmentAllocation; shipment: NonNullable<FulfillmentAllocation['shipment']> } => Boolean(row))
    .sort((left, right) => right.shipment.createdAt.localeCompare(left.shipment.createdAt))
  const counts = useMemo(() => {
    const next = new Map<FulfillmentStatus, number>()
    warehouseAllocations.forEach((allocation) => next.set(allocation.status, (next.get(allocation.status) ?? 0) + 1))
    return next
  }, [warehouseAllocations])

  async function advance(allocation: FulfillmentAllocation, nextStatus: FulfillmentStatus) {
    if (!token) return
    setActionError('')
    try {
      const updated = await api.advanceAllocation(token, allocation.id, { nextStatus })
      setAllocations((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to advance allocation.')
    }
  }

  async function activateRelationship(relationship: MerchantWarehouseRelationship) {
    if (!token) return
    setActionError('')
    try {
      const updated = await api.activateMerchantWarehouseRelationship(token, relationship.id)
      setRelationships((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to activate relationship.')
    }
  }

  async function startReceiving(request: InboundStockRequest) {
    if (!token) return
    setActionError('')
    try {
      const updated = await api.startReceivingInboundStock(token, request.id)
      setInboundRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to start receiving.')
    }
  }

  async function receiveAll(request: InboundStockRequest) {
    if (!token) return
    setActionError('')
    try {
      const updated = await api.receiveInboundStock(token, request.id, {
        receivedQuantity: request.requestedQuantity,
        damagedQuantity: 0,
        receivingNote: 'Received from warehouse console',
      })
      setInboundRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      if (request.warehouseId === selectedWarehouseId) {
        const nextInventory = await api.warehouseInventory(token, selectedWarehouseId)
        setInventory(nextInventory)
      }
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to receive inbound stock.')
    }
  }

  async function rejectInbound(request: InboundStockRequest) {
    if (!token) return
    setActionError('')
    try {
      const updated = await api.rejectInboundStock(token, request.id, {
        rejectionReason: 'Rejected from warehouse console',
      })
      setInboundRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to reject inbound stock.')
    }
  }

  function shipmentDraft(allocation: FulfillmentAllocation): ShipmentDraft {
    return shipmentDrafts[allocation.id] ?? defaultShipmentDraft(allocation)
  }

  async function approveInbound(request: InboundStockRequest) {
    if (!token) return
    setActionError('')
    try {
      const updated = await api.approveInboundStock(token, request.id)
      setInboundRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to approve inbound stock.')
    }
  }

  function updateShipmentDraft(allocation: FulfillmentAllocation, patch: Partial<ShipmentDraft>) {
    setShipmentDrafts((current) => ({
      ...current,
      [allocation.id]: {
        ...(current[allocation.id] ?? defaultShipmentDraft(allocation)),
        ...patch,
      },
    }))
  }

  async function createShipment(allocation: FulfillmentAllocation) {
    if (!token) return
    setActionError('')
    const draft = shipmentDraft(allocation)
    try {
      const shipment = await api.createShipment(token, {
        allocationId: allocation.id,
        carrier: draft.carrier,
        trackingNumber: draft.trackingNumber,
        packageCount: draft.packageCount,
        packageWeightKg: draft.packageWeightKg,
        packageLengthCm: draft.packageLengthCm,
        packageWidthCm: draft.packageWidthCm,
        packageHeightCm: draft.packageHeightCm,
        packingNote: draft.packingNote,
        metadata: { source: 'warehouse-console', evidence: 'operator-entered' },
      })
      setAllocations((current) => current.map((item) => (
        item.id === allocation.id ? { ...item, status: 'SHIPPED', shipment } : item
      )))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to create shipment.')
    }
  }

  async function markDelivered(allocation: FulfillmentAllocation) {
    await markShipment(allocation, 'DELIVERED')
  }

  async function markShipment(allocation: FulfillmentAllocation, nextStatus: ShipmentStatus) {
    if (!token || !allocation.shipment) return
    setActionError('')
    try {
      const shipment = nextStatus === 'DELIVERED'
        ? await api.markShipmentDelivered(token, allocation.shipment.id)
        : await api.advanceShipment(token, allocation.shipment.id, { nextStatus })
      setAllocations((current) => current.map((item) => (
        item.id === allocation.id ? { ...item, shipment } : item
      )))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to mark shipment delivered.')
    }
  }

  async function updateWorkload(
    allocation: FulfillmentAllocation,
    patch: { priority?: number; scanCode?: string; markPickSheetPrinted?: boolean }
  ) {
    if (!token) return
    setActionError('')
    try {
      const updated = await api.updateAllocationWorkload(token, allocation.id, patch)
      setAllocations((current) => current.map((item) => (
        item.id === updated.id
          ? {
              ...item,
              priority: updated.priority,
              scanCode: updated.scanCode,
              pickSheetPrintedAt: updated.pickSheetPrintedAt,
            }
          : item
      )))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to update workload.')
    }
  }

  async function reportException(allocation: FulfillmentAllocation, reasonCode: string) {
    if (!token) return
    setActionError('')
    try {
      const created = await api.reportFulfillmentException(token, {
        allocationId: allocation.id,
        shipmentId: allocation.shipment?.id ?? null,
        reasonCode,
        description: `${reasonCode} reported from warehouse console for allocation ${shortId(allocation.id)}.`,
      })
      setExceptions((current) => [created, ...current])
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to report exception.')
    }
  }

  async function adjustStock(row: WarehouseInventory) {
    if (!token) return
    setActionError('')
    const draft = adjustmentDraft(row)
    try {
      const updated = await api.adjustStock(token, {
        warehouseId: row.warehouseId,
        inventoryItemId: row.inventoryItemId,
        quantityDelta: draft.quantityDelta,
        reasonCode: draft.reasonCode,
        reasonNote: draft.reasonNote,
      })
      setInventory((current) => current.map((item) => (
        item.warehouseId === updated.warehouseId && item.inventoryItemId === updated.inventoryItemId ? updated : item
      )))
      setAdjustmentDrafts((current) => ({
        ...current,
        [row.inventoryItemId]: defaultAdjustmentDraft(updated),
      }))
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to adjust stock.')
    }
  }

  function adjustmentDraft(row: WarehouseInventory) {
    return adjustmentDrafts[row.inventoryItemId] ?? defaultAdjustmentDraft(row)
  }

  function updateAdjustmentDraft(row: WarehouseInventory, patch: Partial<{ quantityDelta: number; reasonCode: string; reasonNote: string }>) {
    setAdjustmentDrafts((current) => ({
      ...current,
      [row.inventoryItemId]: {
        ...(current[row.inventoryItemId] ?? defaultAdjustmentDraft(row)),
        ...patch,
      },
    }))
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState title={error} />

  const totalAvailable = inventory.reduce((sum, row) => sum + row.availableQuantity, 0)

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>Warehouse Console</h1>
        <p>Fulfillment queue, shipment actions, and inventory visibility for your warehouse tenant.</p>
      </div>
      <GuidancePanel title="Start with today's work">
        Pick urgent allocations, receive inbound stock, then clear exceptions. Change warehouse only when you need a different queue.
      </GuidancePanel>

      {warehouses.length ? (
        <>
          <label className="compact-field" htmlFor="warehouse-selector">
            <span>Warehouse</span>
            <select id="warehouse-selector" value={selectedWarehouseId} onChange={(event) => setSelectedWarehouseId(event.target.value)}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>

          <div className="metric-grid">
            <Metric label="Capacity" value={selected?.capacity ?? 0} />
            <Metric label="Queue" value={warehouseAllocations.length} />
            <Metric label="Inbound" value={warehouseInboundRequests.length} />
            <Metric label="Available units" value={totalAvailable} />
            <Metric label="Open exceptions" value={dashboard?.openExceptions ?? exceptions.filter((item) => item.status === 'OPEN').length} />
            <Metric label="Stock risk" value={dashboard?.stockRisk ?? 0} />
          </div>

          <section className="table-section">
            <h2>Fulfillment Status</h2>
            <div className="status-row">
              {(['PENDING', 'PICKING', 'PACKED', 'SHIPPED'] as FulfillmentStatus[]).map((status) => (
                <div className="status-count" key={status}>
                  <StatusBadge value={status} />
                  <strong>{counts.get(status) ?? 0}</strong>
                </div>
              ))}
            </div>
          </section>

          <div className="filter-row">
            <label htmlFor="warehouse-fulfillment-status-filter">
              <span>Status</span>
              <select id="warehouse-fulfillment-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PICKING">Picking</option>
                <option value="PACKED">Packed</option>
                <option value="SHIPPED">Shipped</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
          </div>

          {actionError ? <div className="inline-error">{actionError}</div> : null}
          <RelationshipsTable relationships={relationships} onActivate={(relationship) => void activateRelationship(relationship)} />
          <InboundRequestsTable
            requests={warehouseInboundRequests}
            onApprove={(request) => void approveInbound(request)}
            onStart={(request) => void startReceiving(request)}
            onReceive={(request) => void receiveAll(request)}
            onReject={(request) => void rejectInbound(request)}
          />
          <RecentShipmentsPanel rows={recentShipments} />
          <AllocationsTable
            allocations={filteredAllocations}
            shipmentDraft={(allocation) => shipmentDraft(allocation)}
            onShipmentDraftChange={(allocation, patch) => updateShipmentDraft(allocation, patch)}
            onPick={(allocation) => void advance(allocation, 'PICKING')}
            onPack={(allocation) => void advance(allocation, 'PACKED')}
            onShip={(allocation) => void createShipment(allocation)}
            onDeliver={(allocation) => void markDelivered(allocation)}
            onFail={(allocation) => void markShipment(allocation, 'FAILED')}
            onReturn={(allocation) => void markShipment(allocation, 'RETURNED')}
            onWorkload={(allocation, patch) => void updateWorkload(allocation, patch)}
            onReportException={(allocation, reasonCode) => void reportException(allocation, reasonCode)}
          />
          <WarehouseExceptionsTable exceptions={exceptions.filter((exception) => exception.warehouseProviderId === selected?.tenantId || !selected?.tenantId)} />
          {inventoryLoading ? (
            <LoadingState label="Loading inventory" />
          ) : (
            <InventoryTable
              inventory={inventory}
              adjustmentDraft={(row) => adjustmentDraft(row)}
              onAdjustmentDraftChange={(row, patch) => updateAdjustmentDraft(row, patch)}
              onAdjust={(row) => void adjustStock(row)}
            />
          )}
        </>
      ) : (
        <EmptyState label="No warehouses available for this account" guidance="Ask a platform admin to connect this operator to a warehouse provider before receiving or fulfillment work can begin." />
      )}
    </div>
  )
}

function RecentShipmentsPanel({
  rows,
}: {
  rows: Array<{ allocation: FulfillmentAllocation; shipment: NonNullable<FulfillmentAllocation['shipment']> }>
}) {
  if (!rows.length) {
    return <EmptyState label="No recent shipments for this warehouse" guidance="Shipment records appear after allocations are packed and handed to a carrier." />
  }

  return (
    <section className="table-section">
      <h2>Recent Shipments</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Shipment</th>
              <th>Merchant</th>
              <th>Status</th>
              <th>Carrier</th>
              <th>Packages</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map(({ allocation, shipment }) => (
              <tr key={shipment.id}>
                <td className="mono-cell">
                  <Link className="text-link" to={`/shipments/${shipment.id}`}>{shortId(shipment.id)}</Link>
                </td>
                <td>{allocation.merchantName}</td>
                <td><StatusBadge value={shipment.status} /></td>
                <td>{shipment.carrier} {shipment.trackingNumber ?? ''}</td>
                <td>
                  {shipment.packages?.length ? shipment.packages.map((pkg) => (
                    <span className="status-inline" key={pkg.id}>
                      {pkg.labelCode} {pkg.status}
                    </span>
                  )) : shipment.packageCount ?? 'Unknown'}
                </td>
                <td className="note-cell">{shipment.packingNote ?? 'No packing note'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function WarehouseExceptionsTable({ exceptions }: { exceptions: FulfillmentException[] }) {
  if (!exceptions.length) {
    return <EmptyState label="No fulfillment exceptions reported by this warehouse" guidance="Short picks, damage reports, and shipment issues will appear here when operators raise exceptions." />
  }

  return (
    <section className="table-section">
      <h2>Warehouse Exceptions</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reason</th>
              <th>Merchant</th>
              <th>Description</th>
              <th>Status</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((exception) => (
              <tr key={exception.id}>
                <td>{exception.reasonCode}</td>
                <td>{exception.merchantName}</td>
                <td className="note-cell">{exception.description}</td>
                <td><StatusBadge value={exception.status} /></td>
                <td className="note-cell">{exception.resolutionNote ?? 'Waiting for merchant'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AllocationsTable({
  allocations,
  shipmentDraft,
  onShipmentDraftChange,
  onPick,
  onPack,
  onShip,
  onDeliver,
  onFail,
  onReturn,
  onWorkload,
  onReportException,
}: {
  allocations: FulfillmentAllocation[]
  shipmentDraft: (allocation: FulfillmentAllocation) => ShipmentDraft
  onShipmentDraftChange: (allocation: FulfillmentAllocation, patch: Partial<ShipmentDraft>) => void
  onPick: (allocation: FulfillmentAllocation) => void
  onPack: (allocation: FulfillmentAllocation) => void
  onShip: (allocation: FulfillmentAllocation) => void
  onDeliver: (allocation: FulfillmentAllocation) => void
  onFail: (allocation: FulfillmentAllocation) => void
  onReturn: (allocation: FulfillmentAllocation) => void
  onWorkload: (
    allocation: FulfillmentAllocation,
    patch: { priority?: number; scanCode?: string; markPickSheetPrinted?: boolean }
  ) => void
  onReportException: (allocation: FulfillmentAllocation, reasonCode: string) => void
}) {
  if (!allocations.length) {
    return <EmptyState label="No fulfillment allocations for this warehouse" guidance="Allocations appear when merchant orders reserve stock in this warehouse. Start with active relationships, received inventory, and merchant demand." />
  }

  return (
    <section className="table-section">
      <div className="section-heading-row">
        <h2>Fulfillment Queue</h2>
        <span>{allocations.length} active allocations</span>
      </div>
      <div className="queue-list">
        {allocations.map((allocation) => {
          const canPick = allocation.status === 'PENDING'
          const canPack = allocation.status === 'PICKING'
          const canShip = allocation.status === 'PACKED'
          const canResolveShipment = allocation.status === 'SHIPPED' && allocation.shipment?.status === 'IN_TRANSIT'
          const needsShipmentEvidence = canShip || canResolveShipment
          const draft = shipmentDraft(allocation)
          const fieldPrefix = `warehouse-allocation-${allocation.id}`
          return (
            <article
              aria-label={`Allocation ${shortId(allocation.id)} ${allocation.merchantName} ${allocation.status} ${allocation.customerAddress} ${allocation.shipment?.trackingNumber ?? ''} ${allocation.shipment?.status ?? ''}`}
              className={needsShipmentEvidence ? 'queue-card risk-card' : 'queue-card'}
              key={allocation.id}
            >
              <div className="queue-card-header">
                <div className="queue-card-title">
                  <Link className="text-link mono-cell" to={`/fulfillment-allocations/${allocation.id}`}>{shortId(allocation.id)}</Link>
                  <StatusBadge value={allocation.status} />
                </div>
                <div className="queue-card-meta">
                  <span className="data-chip">{allocation.merchantName}</span>
                  {allocation.merchantWarehouseRelationshipId ? (
                    <Link className="data-chip text-link" to={`/merchant-warehouse/relationships/${allocation.merchantWarehouseRelationshipId}`}>
                      {allocation.serviceRelationshipStatus ?? 'Linked'}
                    </Link>
                  ) : <span className="data-chip">Unlinked</span>}
                  <span className="data-chip">Priority {allocation.priority}</span>
                  <span className={allocation.pickSheetPrintedAt ? 'data-chip' : 'data-chip warning-chip'}>
                    {allocation.pickSheetPrintedAt ? 'Pick sheet printed' : 'Pick sheet needed'}
                  </span>
                  <span className={allocation.scanCode ? 'data-chip' : 'data-chip warning-chip'}>
                    {allocation.scanCode ?? 'Scan pending'}
                  </span>
                </div>
              </div>

              <div className="queue-card-body">
                <div className="queue-card-section">
                  <h3>Items</h3>
                  <div className="chip-list">
                    {allocation.items.map((item) => (
                      <span className="data-chip" key={`${allocation.id}-${item.sku}`}>{item.sku} x{item.quantity}</span>
                    ))}
                  </div>
                </div>
                <div className="queue-card-section">
                  <h3>Customer</h3>
                  <p>{allocation.customerAddress}</p>
                </div>
                <div className="queue-card-section">
                  <h3>Shipment</h3>
                  {allocation.shipment ? (
                    <Link className="text-link" to={`/shipments/${allocation.shipment.id}`}>
                      {allocation.shipment.carrier} {allocation.shipment.trackingNumber ?? ''} {allocation.shipment.status}
                    </Link>
                  ) : <p>None</p>}
                </div>
              </div>

              <div className="queue-card-workbench">
                <div className="shipment-form compact-form" aria-label={`Workload controls for ${shortId(allocation.id)}`}>
                  <label htmlFor={`${fieldPrefix}-priority`}>
                    <span>Priority</span>
                    <select
                      id={`${fieldPrefix}-priority`}
                      value={allocation.priority}
                      onChange={(event) => onWorkload(allocation, { priority: Number(event.target.value) })}
                    >
                      {[1, 2, 3, 4, 5].map((priority) => (
                        <option key={priority} value={priority}>{priority}</option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor={`${fieldPrefix}-scan`}>
                    <span>Scan</span>
                    <input
                      id={`${fieldPrefix}-scan`}
                      defaultValue={allocation.scanCode ?? ''}
                      onBlur={(event) => onWorkload(allocation, { scanCode: event.target.value })}
                    />
                  </label>
                  <button className="table-button" type="button" onClick={() => onWorkload(allocation, { markPickSheetPrinted: true })}>
                    {allocation.pickSheetPrintedAt ? 'Reprint pick sheet' : 'Print pick sheet'}
                  </button>
                </div>

                {canShip ? (
                  <div className="shipment-form shipment-evidence" aria-label={`Shipment evidence for ${shortId(allocation.id)}`}>
                    <label htmlFor={`${fieldPrefix}-carrier`}>
                      <span>Carrier</span>
                      <select
                        id={`${fieldPrefix}-carrier`}
                        value={draft.carrier}
                        onChange={(event) => onShipmentDraftChange(allocation, { carrier: event.target.value })}
                      >
                        {carrierOptions.map((carrier) => (
                          <option key={carrier} value={carrier}>{carrier}</option>
                        ))}
                      </select>
                    </label>
                    <label htmlFor={`${fieldPrefix}-tracking`}>
                      <span>Tracking</span>
                      <input
                        id={`${fieldPrefix}-tracking`}
                        value={draft.trackingNumber}
                        onChange={(event) => onShipmentDraftChange(allocation, { trackingNumber: event.target.value })}
                      />
                    </label>
                    <div className="shipment-grid">
                      <label htmlFor={`${fieldPrefix}-packages`}>
                        <span>Packages</span>
                        <input
                          id={`${fieldPrefix}-packages`}
                          type="number"
                          min="1"
                          value={draft.packageCount}
                          onChange={(event) => onShipmentDraftChange(allocation, { packageCount: numberValue(event.target.value, 1) })}
                        />
                      </label>
                      <label htmlFor={`${fieldPrefix}-weight-kg`}>
                        <span>Weight kg</span>
                        <input
                          id={`${fieldPrefix}-weight-kg`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.packageWeightKg}
                          onChange={(event) => onShipmentDraftChange(allocation, { packageWeightKg: numberValue(event.target.value, 0.01) })}
                        />
                      </label>
                      <label htmlFor={`${fieldPrefix}-length-cm`}>
                        <span>L cm</span>
                        <input
                          id={`${fieldPrefix}-length-cm`}
                          type="number"
                          min="1"
                          value={draft.packageLengthCm}
                          onChange={(event) => onShipmentDraftChange(allocation, { packageLengthCm: numberValue(event.target.value, 1) })}
                        />
                      </label>
                      <label htmlFor={`${fieldPrefix}-width-cm`}>
                        <span>W cm</span>
                        <input
                          id={`${fieldPrefix}-width-cm`}
                          type="number"
                          min="1"
                          value={draft.packageWidthCm}
                          onChange={(event) => onShipmentDraftChange(allocation, { packageWidthCm: numberValue(event.target.value, 1) })}
                        />
                      </label>
                      <label htmlFor={`${fieldPrefix}-height-cm`}>
                        <span>H cm</span>
                        <input
                          id={`${fieldPrefix}-height-cm`}
                          type="number"
                          min="1"
                          value={draft.packageHeightCm}
                          onChange={(event) => onShipmentDraftChange(allocation, { packageHeightCm: numberValue(event.target.value, 1) })}
                        />
                      </label>
                    </div>
                    <label className="wide-field" htmlFor={`${fieldPrefix}-packing-note`}>
                      <span>Packing note</span>
                      <textarea
                        id={`${fieldPrefix}-packing-note`}
                        value={draft.packingNote}
                        onChange={(event) => onShipmentDraftChange(allocation, { packingNote: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="action-cluster">
                {canPick ? (
                  <button className="table-button" type="button" onClick={() => onPick(allocation)}>
                    Pick
                  </button>
                ) : null}
                {canPack ? (
                  <button className="table-button" type="button" onClick={() => onPack(allocation)}>
                    Pack
                  </button>
                ) : null}
                {canShip ? (
                  <button className="table-button" type="button" onClick={() => onShip(allocation)}>
                    Ship
                  </button>
                ) : null}
                {canResolveShipment ? (
                  <>
                    <button className="table-button" type="button" onClick={() => onDeliver(allocation)}>
                      Deliver
                    </button>
                    <button className="table-button destructive-button" type="button" onClick={() => onFail(allocation)}>
                      Mark failed
                    </button>
                    <button className="table-button warning-button" type="button" onClick={() => onReturn(allocation)}>
                      Mark returned
                    </button>
                  </>
                ) : null}
                <button className="table-button warning-button" type="button" onClick={() => onReportException(allocation, 'SHORT_PICK')}>
                  Report short pick
                </button>
                <button className="table-button destructive-button" type="button" onClick={() => onReportException(allocation, 'DAMAGED_ITEM')}>
                  Report damage
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function RelationshipsTable({
  relationships,
  onActivate,
}: {
  relationships: MerchantWarehouseRelationship[]
  onActivate: (relationship: MerchantWarehouseRelationship) => void
}) {
  if (!relationships.length) {
    return <EmptyState label="No merchant service relationships yet" guidance="Service relationships connect merchants to warehouse work. Platform or merchant users can request and activate the relationship before operations begin." />
  }

  return (
    <section className="table-section">
      <h2>Merchant Service Relationships</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {relationships.map((relationship) => {
              const canActivate = relationship.status === 'REQUESTED'
              return (
                <tr key={relationship.id}>
                  <td className="name-cell">
                    <Link className="text-link" to={`/merchant-warehouse/relationships/${relationship.id}`}>
                      {relationship.merchantName}
                    </Link>
                  </td>
                  <td><StatusBadge value={relationship.status} /></td>
                  <td className="note-cell">{relationship.serviceNotes ?? 'None'}</td>
                  <td>
                    <button className="table-button" type="button" disabled={!canActivate} onClick={() => onActivate(relationship)}>
                      {canActivate ? 'Activate' : relationship.status === 'ACTIVE' ? 'Active' : 'Locked'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function InboundRequestsTable({
  requests,
  onApprove,
  onStart,
  onReceive,
  onReject,
}: {
  requests: InboundStockRequest[]
  onApprove: (request: InboundStockRequest) => void
  onStart: (request: InboundStockRequest) => void
  onReceive: (request: InboundStockRequest) => void
  onReject: (request: InboundStockRequest) => void
}) {
  if (!requests.length) {
    return <EmptyState label="No inbound stock requests for this warehouse" guidance="Inbound requests appear when merchants send stock to this warehouse for receiving." />
  }

  return (
    <section className="table-section">
      <h2>Inbound Receiving</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Item</th>
              <th>Requested</th>
              <th>Received</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const canApprove = request.status === 'SUBMITTED'
              const canStart = request.status === 'APPROVED'
              const canResolve = request.status === 'APPROVED' || request.status === 'RECEIVING'
              return (
                <tr key={request.id}>
                  <td className="name-cell">
                    <Link className="text-link" to={`/inbound-stock-requests/${request.id}`}>
                      {request.merchantName}
                    </Link>
                  </td>
                  <td className="item-cell">{request.sku} - {request.itemName}</td>
                  <td><QuantityCell value={request.requestedQuantity} tone="pending" /></td>
                  <td><QuantityCell value={request.receivedQuantity} tone={request.receivedQuantity >= request.requestedQuantity ? 'ready' : 'pending'} /></td>
                  <td><StatusBadge value={request.status} /></td>
                  <td>
                    <div className="table-actions">
                      {canApprove ? (
                        <button className="table-button" type="button" onClick={() => onApprove(request)}>
                          Approve
                        </button>
                      ) : null}
                      {canStart ? (
                        <button className="table-button" type="button" onClick={() => onStart(request)}>
                          Start receiving
                        </button>
                      ) : null}
                      {canResolve ? (
                        <>
                          <button className="table-button" type="button" onClick={() => onReceive(request)}>
                            Receive all
                          </button>
                          <button className="table-button destructive-button" type="button" onClick={() => onReject(request)}>
                            Reject inbound
                          </button>
                        </>
                      ) : null}
                      {!canApprove && !canStart && !canResolve ? <span className="data-chip">No warehouse action</span> : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function InventoryTable({
  inventory,
  adjustmentDraft,
  onAdjustmentDraftChange,
  onAdjust,
}: {
  inventory: WarehouseInventory[]
  adjustmentDraft: (row: WarehouseInventory) => { quantityDelta: number; reasonCode: string; reasonNote: string }
  onAdjustmentDraftChange: (
    row: WarehouseInventory,
    patch: Partial<{ quantityDelta: number; reasonCode: string; reasonNote: string }>
  ) => void
  onAdjust: (row: WarehouseInventory) => void
}) {
  if (!inventory.length) {
    return <EmptyState label="No stock rows for this warehouse" guidance="Stock rows appear after inbound receiving posts available, damaged, or reserved inventory." />
  }

  return (
    <section className="table-section">
      <h2>Warehouse Inventory</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Adjustment Evidence</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((row) => {
              const draft = adjustmentDraft(row)
              const fieldPrefix = `warehouse-stock-${row.warehouseId}-${row.inventoryItemId}`
              return (
                <tr key={`${row.warehouseId}-${row.inventoryItemId}`}>
                  <td className="nowrap-cell">{row.sku}</td>
                  <td className="item-cell">{row.itemName}</td>
                  <td><QuantityCell value={row.quantity} tone={row.quantity > 0 ? 'ready' : 'risk'} /></td>
                  <td><QuantityCell value={row.reservedQuantity} tone={row.reservedQuantity > 0 ? 'pending' : 'neutral'} /></td>
                  <td><QuantityCell value={row.availableQuantity} tone={row.availableQuantity > 0 ? 'ready' : 'risk'} /></td>
                  <td>
                    <div className="adjustment-form" aria-label={`Stock adjustment for ${row.sku}`}>
                      <label htmlFor={`${fieldPrefix}-delta`}>
                        <span>Delta</span>
                        <input
                          id={`${fieldPrefix}-delta`}
                          type="number"
                          value={draft.quantityDelta}
                          onChange={(event) => onAdjustmentDraftChange(row, { quantityDelta: Number(event.target.value) })}
                        />
                      </label>
                      <label htmlFor={`${fieldPrefix}-reason`}>
                        <span>Reason</span>
                        <select
                          id={`${fieldPrefix}-reason`}
                          value={draft.reasonCode}
                          onChange={(event) => onAdjustmentDraftChange(row, { reasonCode: event.target.value })}
                        >
                          {adjustmentReasons.map((reason) => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                        </select>
                      </label>
                      <label htmlFor={`${fieldPrefix}-note`}>
                        <span>Note</span>
                        <input
                          id={`${fieldPrefix}-note`}
                          value={draft.reasonNote}
                          onChange={(event) => onAdjustmentDraftChange(row, { reasonNote: event.target.value })}
                        />
                      </label>
                      <button className="table-button warning-button" type="button" onClick={() => onAdjust(row)}>
                        Apply adjustment
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function GuidancePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="admin-guidance-panel" aria-label={title}>
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  )
}

function QuantityCell({
  value,
  tone = 'neutral',
}: {
  value: number
  tone?: 'neutral' | 'ready' | 'pending' | 'risk'
}) {
  return <span className={`quantity-cell quantity-${tone}`}>{value}</span>
}

function shortId(id: string) {
  return id.slice(0, 8)
}

function defaultShipmentDraft(allocation: FulfillmentAllocation): ShipmentDraft {
  const itemCount = allocation.items.reduce((sum, item) => sum + item.quantity, 0)
  return {
    carrier: 'FedEx',
    trackingNumber: `MH-${allocation.id.slice(0, 8)}`,
    packageCount: Math.max(1, itemCount),
    packageWeightKg: Math.max(1, itemCount),
    packageLengthCm: 40,
    packageWidthCm: 30,
    packageHeightCm: 20,
    packingNote: 'Packed with operator-entered package evidence for shipment handoff.',
  }
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function defaultAdjustmentDraft(row: WarehouseInventory) {
  return {
    quantityDelta: 1,
    reasonCode: 'CYCLE_COUNT_GAIN',
    reasonNote: `Cycle count adjustment for ${row.sku}.`,
  }
}
