import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type {
  InboundStockRequest,
  InventoryItem,
  MerchantAuthorizedStock,
  MerchantWarehouseRelationship,
  Order,
  OrderStatus,
  Shipment,
  CustomerContact,
  DashboardSummary,
  BackorderStatus,
  FulfillmentException,
  OrderImportBatch,
  WarehouseProviderOption,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { Metric } from '../components/Metric'
import { StatusBadge } from '../components/StatusBadge'

type MerchantData = {
  items: InventoryItem[]
  orders: Order[]
  dashboard: DashboardSummary | null
}

function useMerchantData() {
  const { token } = useAuth()
  const [data, setData] = useState<MerchantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    Promise.all([api.inventoryItems(token), api.orders(token), api.merchantDashboard(token)])
      .then(([items, orders, dashboard]) => setData({ items, orders, dashboard }))
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load merchant data.')
      })
      .finally(() => setLoading(false))
  }, [token])

  return { data, loading, error }
}

export function MerchantOverviewPage() {
  const { data, loading, error } = useMerchantData()
  const orderCounts = useMemo(() => {
    const counts = new Map<OrderStatus, number>()
    data?.orders.forEach((order) => counts.set(order.status, (counts.get(order.status) ?? 0) + 1))
    return Array.from(counts.entries())
  }, [data?.orders])

  if (loading) return <LoadingState />
  if (error) return <ErrorState title={error} />
  if (!data) return <EmptyState label="No merchant data available" guidance="Set up inventory, confirm warehouse relationships, and create the first order to start the merchant operating view." />

  const backorderedUnits = data.orders.flatMap((order) => order.backorders).reduce((sum, item) => sum + item.quantity, 0)
  const recentShipments = recentOrderShipments(data.orders)

  return (
    <div className="page-stack">
      <PageHeading title="Merchant Overview" subtitle="Watch stock risk, backorders, and exceptions before opening the queue." />
      <GuidancePanel title="Start with risk">
        Open Orders when risk rises; use Stock when a prerequisite is missing.
      </GuidancePanel>
      <div className="metric-grid">
        <Metric label="Inventory items" value={data.items.length} />
        <Metric label="Orders" value={data.orders.length} />
        <Metric label="Backordered units" value={backorderedUnits} />
        <Metric label="Delivered" value={data.orders.filter((order) => order.status === 'DELIVERED').length} />
        <Metric label="Open exceptions" value={data.dashboard?.openExceptions ?? 0} />
        <Metric label="Stock risk" value={data.dashboard?.stockRisk ?? 0} />
      </div>
      <section className="table-section">
        <h2>Order Status</h2>
        {orderCounts.length ? (
          <div className="status-row">
            {orderCounts.map(([status, count]) => (
              <div className="status-count" key={status}>
                <StatusBadge value={status} />
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="No orders yet" guidance="Create the first order once a SKU and active warehouse partner are ready." />
        )}
      </section>
      <RecentShipmentsPanel shipments={recentShipments} />
      <OrdersTable orders={data.orders.slice(0, 8)} />
    </div>
  )
}

export function MerchantInventoryPage() {
  const { token, user } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [relationships, setRelationships] = useState<MerchantWarehouseRelationship[]>([])
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseProviderOption[]>([])
  const [inboundRequests, setInboundRequests] = useState<InboundStockRequest[]>([])
  const [authorizedStock, setAuthorizedStock] = useState<MerchantAuthorizedStock[]>([])
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [warehouseProviderId, setWarehouseProviderId] = useState('')
  const [relationshipNote, setRelationshipNote] = useState('')
  const [relationshipId, setRelationshipId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [inventoryItemId, setInventoryItemId] = useState('')
  const [requestedQuantity, setRequestedQuantity] = useState(1)
  const [merchantReference, setMerchantReference] = useState('')
  const [merchantNote, setMerchantNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.inventoryItems(token),
      api.merchantWarehouseRelationships(token),
      api.merchantWarehouseWarehouseOptions(token),
      api.inboundStockRequests(token),
      api.merchantAuthorizedStock(token),
    ])
      .then(([nextItems, nextRelationships, nextWarehouseOptions, nextInboundRequests, nextAuthorizedStock]) => {
        const nextRelationship = nextRelationships.find((relationship) => relationship.status === 'ACTIVE')
        const nextWarehouse = nextWarehouseOptions.find((option) => (
          !nextRelationship || option.warehouseProviderId === nextRelationship.warehouseProviderId
        ))
        setItems(nextItems)
        setRelationships(nextRelationships)
        setWarehouseOptions(nextWarehouseOptions)
        setInboundRequests(nextInboundRequests)
        setAuthorizedStock(nextAuthorizedStock)
        setWarehouseProviderId(nextWarehouseOptions[0]?.warehouseProviderId ?? '')
        setRelationshipId(nextRelationship?.id ?? '')
        setWarehouseId(nextWarehouse?.warehouseId ?? '')
        setInventoryItemId(nextItems[0]?.id ?? '')
      })
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to load inventory.')
      })
      .finally(() => setLoading(false))
  }, [token])

  const providerOptions = useMemo(() => {
    const providers = new Map<string, WarehouseProviderOption>()
    warehouseOptions.forEach((option) => {
      if (!providers.has(option.warehouseProviderId)) {
        providers.set(option.warehouseProviderId, option)
      }
    })
    return Array.from(providers.values())
  }, [warehouseOptions])

  const activeRelationships = relationships.filter((relationship) => relationship.status === 'ACTIVE')
  const selectedRelationship = relationships.find((relationship) => relationship.id === relationshipId)
  const inboundWarehouseOptions = useMemo(() => (
    warehouseOptions.filter((option) => (
      !selectedRelationship || option.warehouseProviderId === selectedRelationship.warehouseProviderId
    ))
  ), [selectedRelationship, warehouseOptions])
  const selectedWarehouse = inboundWarehouseOptions.find((option) => option.warehouseId === warehouseId)
  const warehouseMatchesRelationship = Boolean(selectedRelationship && selectedWarehouse)
  const canCreateInbound = activeRelationships.length > 0 && items.length > 0 && Boolean(inventoryItemId) && warehouseMatchesRelationship
  const inboundBlocker = !activeRelationships.length
    ? 'Create or activate a warehouse relationship before submitting inbound stock.'
    : !items.length
      ? 'Create an inventory item before submitting inbound stock.'
      : !inboundWarehouseOptions.length
        ? 'The selected relationship has no warehouse available for inbound stock.'
        : !warehouseMatchesRelationship
          ? 'Choose a warehouse that belongs to the selected active service relationship.'
          : ''
  const inboundReadinessMessage = inboundBlocker || 'Ready to send stock to the selected warehouse.'
  const providerBlocker = providerOptions.length === 0
    ? 'No warehouse providers are available yet. Ask a platform admin to create a warehouse provider first.'
    : ''

  function handleRelationshipChange(nextRelationshipId: string) {
    const nextRelationship = relationships.find((relationship) => relationship.id === nextRelationshipId)
    const nextWarehouse = warehouseOptions.find((option) => (
      !nextRelationship || option.warehouseProviderId === nextRelationship.warehouseProviderId
    ))
    setRelationshipId(nextRelationshipId)
    setWarehouseId(nextWarehouse?.warehouseId ?? '')
  }

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !user) return
    setSubmitting(true)
    setError('')
    try {
      const created = await api.createInventoryItem(token, {
        merchantId: user.tenantId,
        sku,
        name,
        attributes: { source: 'merchant-console' },
      })
      setItems((current) => [...current, created])
      setSku('')
      setName('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to create inventory item.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !user) return
    setSubmitting(true)
    setError('')
    try {
      const created = await api.createMerchantWarehouseRelationship(token, {
        merchantId: user.tenantId,
        warehouseProviderId,
        serviceNotes: relationshipNote,
      })
      setRelationships((current) => [created, ...current])
      setRelationshipNote('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to request warehouse service.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitInbound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await createInboundRequest('submit')
  }

  async function createInboundRequest(mode: 'draft' | 'submit') {
    if (!token) return
    if (!canCreateInbound) {
      setError(inboundReadinessMessage)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        relationshipId,
        warehouseId,
        inventoryItemId,
        requestedQuantity,
        merchantReference,
        merchantNote,
      }
      const created = mode === 'draft'
        ? await api.createInboundStockDraft(token, payload)
        : await api.submitInboundStockRequest(token, payload)
      setInboundRequests((current) => [created, ...current])
      setMerchantReference('')
      setMerchantNote('')
      setRequestedQuantity(1)
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to save inbound stock.'
      setError(message.includes('Warehouse does not belong to the relationship warehouse provider')
        ? 'Choose a warehouse that belongs to the selected active service relationship.'
        : message)
    } finally {
      setSubmitting(false)
    }
  }

  async function transitionInbound(request: InboundStockRequest, action: 'submit' | 'cancel') {
    if (!token) return
    setSubmitting(true)
    setError('')
    try {
      const updated = action === 'submit'
        ? await api.submitInboundStockDraft(token, request.id)
        : await api.cancelInboundStock(token, request.id)
      setInboundRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to update inbound stock.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateItem(item: InventoryItem, patch: Partial<InventoryItem>) {
    if (!token) return
    setError('')
    try {
      const updated = await api.updateInventoryItem(token, item.id, {
        sku: patch.sku ?? item.sku,
        name: patch.name ?? item.name,
        attributes: patch.attributes ?? item.attributes,
        archived: patch.archived ?? item.archived,
      })
      setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to update item.')
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="page-stack">
      <PageHeading title="Inventory" subtitle="Create SKUs, connect warehouse partners, and send inbound stock." />
      <GuidancePanel title="Inventory and inbound readiness">
        Use the setup path below. Submit inbound only when a SKU and active partner are ready.
      </GuidancePanel>
      <FirstRunChecklist
        title="Merchant setup path"
        items={[
          { label: 'Create a SKU', done: items.length > 0, detail: 'Start with the item the warehouse will receive or allocate.' },
          { label: 'Connect a warehouse partner', done: activeRelationships.length > 0, detail: 'Request service, then wait for activation before inbound stock can move.' },
          { label: 'Send inbound stock', done: inboundRequests.length > 0, detail: 'Submit stock against an active relationship and target warehouse.' },
          { label: 'Create the first order', done: authorizedStock.some((row) => row.availableQuantity > 0), detail: 'Orders allocate cleanly after stock is available in a connected warehouse.' },
        ]}
      />
      <div className="metric-grid">
        <Metric label="Service providers" value={relationships.length} />
        <Metric label="Active relationships" value={activeRelationships.length} />
        <Metric label="Inbound requests" value={inboundRequests.length} />
        <Metric label="Authorized stock" value={authorizedStock.reduce((sum, row) => sum + row.availableQuantity, 0)} />
        <Metric label="Items" value={items.length} />
      </div>
      {error ? <div className="inline-error">{error}</div> : null}
      <form aria-label="Create inventory item form" className="panel-form" onSubmit={handleCreateItem}>
        <h2>Create Item</h2>
        <div className="form-grid">
          <label htmlFor="merchant-item-sku">
            <span>SKU</span>
            <input id="merchant-item-sku" value={sku} onChange={(event) => setSku(event.target.value)} maxLength={120} required />
          </label>
          <label htmlFor="merchant-item-name">
            <span>Name</span>
            <input id="merchant-item-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
          </label>
        </div>
        <button className="primary-button fit-button" type="submit" disabled={submitting}>
          {submitting ? 'Creating' : 'Create item'}
        </button>
      </form>
      <form aria-label="Request warehouse service form" className="panel-form" onSubmit={handleRequestRelationship}>
        <h2>Request Warehouse Service</h2>
        {providerBlocker ? <p className="field-help prerequisite-help">{providerBlocker}</p> : null}
        <div className="form-grid">
          <label htmlFor="merchant-service-provider">
            <span>Warehouse provider</span>
            <select
              id="merchant-service-provider"
              value={warehouseProviderId}
              onChange={(event) => setWarehouseProviderId(event.target.value)}
              required
            >
              {providerOptions.map((option) => (
                <option key={option.warehouseProviderId} value={option.warehouseProviderId}>
                  {option.warehouseProviderName}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field" htmlFor="merchant-service-notes">
            <span>Service notes</span>
            <input id="merchant-service-notes" value={relationshipNote} onChange={(event) => setRelationshipNote(event.target.value)} />
          </label>
        </div>
        <button className="primary-button fit-button" type="submit" disabled={submitting || providerOptions.length === 0} title={providerBlocker || undefined}>
          Request service
        </button>
      </form>
      <form aria-label="Submit inbound stock form" className="panel-form" onSubmit={handleSubmitInbound}>
        <h2>Submit Inbound Stock</h2>
        <p className="field-help">{inboundReadinessMessage}</p>
        <div className="form-grid">
          <label htmlFor="merchant-inbound-relationship">
            <span>Relationship</span>
            <select
              id="merchant-inbound-relationship"
              value={relationshipId}
              onChange={(event) => handleRelationshipChange(event.target.value)}
              required
            >
              {activeRelationships.map((relationship) => (
                <option key={relationship.id} value={relationship.id}>
                  {relationship.warehouseProviderName}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="merchant-inbound-warehouse">
            <span>Target warehouse</span>
            <select
              id="merchant-inbound-warehouse"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              disabled={!inboundWarehouseOptions.length}
              required
            >
              {inboundWarehouseOptions.map((option) => (
                <option key={option.warehouseId} value={option.warehouseId}>
                  {option.warehouseName}
                </option>
              ))}
            </select>
          </label>
          <label className="span-two-field" htmlFor="merchant-inbound-item">
            <span>Item</span>
            <select id="merchant-inbound-item" value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)} required>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} - {item.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="merchant-inbound-quantity">
            <span>Quantity</span>
            <input id="merchant-inbound-quantity" value={requestedQuantity} min={1} onChange={(event) => setRequestedQuantity(Number(event.target.value))} type="number" required />
          </label>
          <label htmlFor="merchant-inbound-reference">
            <span>Reference</span>
            <input id="merchant-inbound-reference" value={merchantReference} onChange={(event) => setMerchantReference(event.target.value)} />
          </label>
          <label className="wide-field" htmlFor="merchant-inbound-note">
            <span>Merchant note</span>
            <input id="merchant-inbound-note" value={merchantNote} onChange={(event) => setMerchantNote(event.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          {inboundBlocker ? <p className="field-help prerequisite-help">{inboundBlocker}</p> : null}
          <button
            className="secondary-button fit-button"
            type="button"
            disabled={submitting || !canCreateInbound}
            title={inboundBlocker || undefined}
            onClick={() => void createInboundRequest('draft')}
          >
            Save draft
          </button>
          <button className="primary-button fit-button" type="submit" disabled={submitting || !canCreateInbound} title={inboundBlocker || undefined}>
            Submit inbound
          </button>
        </div>
      </form>
      <RelationshipsTable relationships={relationships} />
      <AuthorizedStockTable stockRows={authorizedStock} />
      <InboundRequestsTable
        requests={inboundRequests}
        onSubmit={(request) => void transitionInbound(request, 'submit')}
        onCancel={(request) => void transitionInbound(request, 'cancel')}
      />
      <InventoryTable items={items} onToggleArchive={(item) => void updateItem(item, { archived: !item.archived })} />
    </div>
  )
}

export function MerchantOrdersPage() {
  const { token, user } = useAuth()
  const { data, loading, error } = useMerchantData()
  const [orders, setOrders] = useState<Order[]>([])
  const [inventoryItemId, setInventoryItemId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [draftItems, setDraftItems] = useState<Array<{ inventoryItemId: string; quantity: number }>>([])
  const [customerAddress, setCustomerAddress] = useState('')
  const [contacts, setContacts] = useState<CustomerContact[]>([])
  const [exceptions, setExceptions] = useState<FulfillmentException[]>([])
  const [importBatches, setImportBatches] = useState<OrderImportBatch[]>([])
  const [contactLabel, setContactLabel] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [csvText, setCsvText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      setOrders(data?.orders ?? [])
      if (!inventoryItemId && data?.items[0]) {
        setInventoryItemId(data.items[0].id)
      }
    })
  }, [data?.items, data?.orders, inventoryItemId])

  useEffect(() => {
    if (!token) return
    Promise.all([api.customerContacts(token), api.fulfillmentExceptions(token)])
      .then(([nextContacts, nextExceptions]) => {
        setContacts(nextContacts)
        setExceptions(nextExceptions)
      })
      .catch(() => {
        setContacts([])
        setExceptions([])
      })
  }, [token])

  useEffect(() => {
    if (!token || !user) return
    api.orderImports(token, user.tenantId)
      .then(setImportBatches)
      .catch(() => setImportBatches([]))
  }, [token, user])

  const filteredOrders = orders.filter((order) => statusFilter === 'ALL' || order.status === statusFilter)
  const recentShipments = recentOrderShipments(filteredOrders)

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !user) return
    setSubmitting(true)
    setActionError('')
    setActionMessage('')
    try {
      const created = await api.createOrder(token, {
        merchantId: user.tenantId,
        customerAddress,
        items: draftItems.length ? draftItems : [{ inventoryItemId, quantity }],
      })
      setOrders((current) => [created, ...current])
      setCustomerAddress('')
      setQuantity(1)
      setDraftItems([])
      setActionMessage('Order created.')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to create order.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateOrder(orderId: string, action: 'allocate' | 'cancel') {
    if (!token) return
    setActionError('')
    setActionMessage('')
    try {
      const updated = action === 'allocate'
        ? await api.allocateOrder(token, orderId)
        : await api.cancelOrder(token, orderId)
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)))
      setActionMessage(action === 'allocate' ? 'Order allocated.' : 'Order cancelled.')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : `Unable to ${action} order.`)
    }
  }

  function addDraftLine() {
    if (!inventoryItemId || quantity < 1) return
    setDraftItems((current) => [...current, { inventoryItemId, quantity }])
    setQuantity(1)
  }

  async function createContact() {
    if (!token || !user || !customerAddress || !contactLabel || !contactName) return
    setActionError('')
    setActionMessage('')
    try {
      const created = await api.createCustomerContact(token, {
        merchantId: user.tenantId,
        label: contactLabel,
        contactName,
        phone: contactPhone,
        address: customerAddress,
      })
      setContacts((current) => [created, ...current])
      setContactLabel('')
      setContactName('')
      setContactPhone('')
      setActionMessage('Contact saved.')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to save contact.')
    }
  }

  async function updateBackorder(orderId: string, backorderId: string, nextStatus: BackorderStatus) {
    if (!token) return
    setActionError('')
    setActionMessage('')
    try {
      const updated = await api.updateBackorder(token, orderId, backorderId, { nextStatus })
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)))
      setActionMessage(nextStatus === 'FULFILLED' ? 'Backorder marked fulfilled.' : 'Backorder cancelled.')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to update backorder.')
    }
  }

  async function resolveException(exceptionId: string) {
    if (!token) return
    setActionError('')
    setActionMessage('')
    try {
      const resolved = await api.resolveFulfillmentException(token, exceptionId, {
        resolutionNote: 'Merchant accepted the operational resolution and marked the customer notification state ready.',
      })
      setExceptions((current) => current.map((item) => (item.id === resolved.id ? resolved : item)))
      setActionMessage('Exception resolved.')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.details[0] ?? caught.message : 'Unable to resolve exception.')
    }
  }

  async function importCsvOrders() {
    if (!token || !user || !data) return
    setActionError('')
    setActionMessage('')
    const rows = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (!rows.length) return
    setSubmitting(true)
    try {
      const startedAt = Date.now()
      const batch = await api.createOrderImport(token, {
        merchantId: user.tenantId,
        mode: 'PARTIAL_ACCEPT',
        sourceLabel: 'Merchant pasted order rows',
        rows: rows.map((row, index) => {
          const [customerAddress, sku, qty, customerName, customerPhone] = row.split(',').map((part) => part.trim())
          if (!customerAddress || !sku) {
            throw new Error(`Import row ${index + 1} must use address, sku, quantity.`)
          }
          return {
            merchantOrderReference: `merchant-paste-${startedAt}-${index + 1}`,
            sku,
            quantity: Number(qty) || 1,
            customerAddress,
            customerName: customerName || null,
            customerPhone: customerPhone || null,
          }
        }),
      })
      setImportBatches((current) => [batch, ...current])
      setOrders(await api.orders(token))
      setCsvText('')
      setActionMessage(`Import batch recorded: ${batch.createdRows} accepted, ${batch.rejectedRows} rejected.`)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Unable to import CSV orders.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState title={error} />
  if (!data) return <EmptyState label="No merchant orders available" guidance="Add inventory, confirm stock availability, then create the first customer order from this page." />

  const createOrderBlocker = data.items.length === 0 ? 'Create a stock item before creating an order.' : ''

  return (
    <div className="page-stack">
      <PageHeading title="Orders" subtitle="Create orders, allocate available stock, and monitor backorders." />
      <GuidancePanel title="Order queue controls">
        Add the customer order, then allocate. Backorders stay on the order card until resolved.
      </GuidancePanel>
      {actionError ? <div className="inline-error">{actionError}</div> : null}
      {actionMessage ? <div className="inline-success">{actionMessage}</div> : null}
      <form aria-label="Create order form" className="panel-form" onSubmit={handleCreateOrder}>
        <h2>Create Order</h2>
        {createOrderBlocker ? <p className="field-help prerequisite-help">{createOrderBlocker}</p> : null}
        <div className="form-grid">
          <label htmlFor="merchant-order-item">
            <span>Item</span>
            <select id="merchant-order-item" value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)} required>
              {data.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} - {item.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="merchant-order-quantity">
            <span>Quantity</span>
            <input
              id="merchant-order-quantity"
              value={quantity}
              min={1}
              onChange={(event) => setQuantity(Number(event.target.value))}
              type="number"
              required
            />
          </label>
          <label className="wide-field" htmlFor="merchant-order-customer-address">
            <span>Customer address</span>
            <input
              id="merchant-order-customer-address"
              value={customerAddress}
              onChange={(event) => setCustomerAddress(event.target.value)}
              list="customer-contact-addresses"
              required
            />
            <datalist id="customer-contact-addresses">
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.address}>{contact.label} - {contact.contactName}</option>
              ))}
            </datalist>
          </label>
          <label htmlFor="merchant-order-contact-label">
            <span>Contact label</span>
            <input id="merchant-order-contact-label" value={contactLabel} onChange={(event) => setContactLabel(event.target.value)} />
          </label>
          <label htmlFor="merchant-order-contact-name">
            <span>Contact name</span>
            <input id="merchant-order-contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </label>
          <label htmlFor="merchant-order-contact-phone">
            <span>Contact phone</span>
            <input id="merchant-order-contact-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
          </label>
        </div>
        <div className="table-actions">
          <button className="secondary-button fit-button" type="button" disabled={!inventoryItemId || quantity < 1} onClick={addDraftLine}>
            Add line
          </button>
          <button className="secondary-button fit-button" type="button" disabled={!customerAddress || !contactLabel || !contactName} onClick={() => void createContact()}>
            Save contact
          </button>
        </div>
        {draftItems.length ? (
          <div className="status-row" aria-label="Draft order lines">
            {draftItems.map((line, index) => {
              const item = data.items.find((candidate) => candidate.id === line.inventoryItemId)
              return (
                <span className="status-count" key={`${line.inventoryItemId}-${index}`}>
                  {item?.sku ?? shortId(line.inventoryItemId)} x{line.quantity}
                  <button className="table-button" type="button" onClick={() => setDraftItems((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                    Remove
                  </button>
                </span>
              )
            })}
          </div>
        ) : null}
        <button className="primary-button fit-button" type="submit" disabled={submitting || data.items.length === 0} title={createOrderBlocker || undefined}>
          {submitting ? 'Creating' : 'Create order'}
        </button>
      </form>
      <section className="table-section">
        <h2>Audited Order Import</h2>
        <div className="panel-form">
          <label className="wide-field" htmlFor="merchant-order-import-rows">
            <span>Rows</span>
            <textarea
              id="merchant-order-import-rows"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder="Customer address,SKU,Quantity,Customer name,Customer phone"
            />
          </label>
          <button className="secondary-button fit-button" type="button" disabled={!csvText.trim() || submitting} onClick={() => void importCsvOrders()}>
            {submitting ? 'Submitting import' : 'Submit import batch'}
          </button>
        </div>
        {importBatches.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Accepted</th>
                  <th>Rejected</th>
                  <th>Latest row result</th>
                </tr>
              </thead>
              <tbody>
                {importBatches.slice(0, 5).map((batch) => {
                  const latestRejected = batch.rows.find((row) => row.status === 'REJECTED')
                  const latestCreated = batch.rows.find((row) => row.status === 'CREATED')
                  return (
                    <tr key={batch.id}>
                      <td>{batch.sourceLabel}</td>
                      <td><StatusBadge value={batch.status} /></td>
                      <td>{batch.totalRows}</td>
                      <td>{batch.createdRows}</td>
                      <td>{batch.rejectedRows}</td>
                      <td>{latestRejected?.failureReason ?? (latestCreated?.createdOrderId ? `Created ${shortId(latestCreated.createdOrderId)}` : 'No row results')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No audited import batches yet" guidance="Submit an import batch for bulk order intake and validation feedback." />
        )}
      </section>
      <div className="filter-row">
        <label htmlFor="merchant-order-status-filter">
          <span>Status</span>
          <select id="merchant-order-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="ALL">All statuses</option>
            <option value="CREATED">Created</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="PARTIALLY_ALLOCATED">Partially allocated</option>
            <option value="BACKORDERED">Backordered</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
      </div>
      <RecentShipmentsPanel shipments={recentShipments} />
      <MerchantExceptionsTable exceptions={exceptions} onResolve={(exceptionId) => void resolveException(exceptionId)} />
      <OrdersTable
        orders={filteredOrders}
        onAllocate={(id) => void updateOrder(id, 'allocate')}
        onCancel={(id) => void updateOrder(id, 'cancel')}
        onBackorder={(orderId, backorderId, status) => void updateBackorder(orderId, backorderId, status)}
      />
    </div>
  )
}

function RecentShipmentsPanel({ shipments }: { shipments: Shipment[] }) {
  if (!shipments.length) {
    return <EmptyState label="No recent shipments yet" guidance="Shipments appear after warehouse teams hand off allocated orders." />
  }

  return (
    <section className="table-section">
      <h2>Recent Shipments</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Shipment</th>
              <th>Status</th>
              <th>Carrier</th>
              <th>Packages</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {shipments.slice(0, 8).map((shipment) => (
              <tr key={shipment.id}>
                <td className="mono-cell">
                  <Link className="text-link" to={`/shipments/${shipment.id}`}>{shortId(shipment.id)}</Link>
                </td>
                <td><StatusBadge value={shipment.status} /></td>
                <td>{shipment.carrier} {shipment.trackingNumber ?? ''}</td>
                <td>{shipment.packageCount ?? 'Unknown'}</td>
                <td>{shipment.packingNote ?? 'No packing note'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function InventoryTable({ items, onToggleArchive }: { items: InventoryItem[], onToggleArchive: (item: InventoryItem) => void }) {
  if (!items.length) {
    return <EmptyState label="No inventory items yet" guidance="Create your first SKU, then connect it to inbound stock and orders." />
  }

  return (
    <section className="table-section">
      <h2>Items</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Status</th>
              <th>ID</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link className="text-link" to={`/inventory/items/${item.id}`}>{item.sku}</Link>
                </td>
                <td>{item.name}</td>
                <td><StatusBadge value={item.archived ? 'ARCHIVED' : 'ACTIVE'} /></td>
                <td className="mono-cell">{shortId(item.id)}</td>
                <td>
                  <button className={`table-button ${item.archived ? '' : 'warning-button'}`.trim()} type="button" onClick={() => onToggleArchive(item)}>
                    {item.archived ? 'Restore' : 'Archive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MerchantExceptionsTable({
  exceptions,
  onResolve,
}: {
  exceptions: FulfillmentException[]
  onResolve: (exceptionId: string) => void
}) {
  if (!exceptions.length) {
    return <EmptyState label="No fulfillment exceptions need merchant action" guidance="Short picks, damaged stock, and other warehouse exceptions will appear here when they need merchant review." />
  }

  return (
    <section className="table-section">
      <h2>Exception Resolution</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reason</th>
              <th>Warehouse</th>
              <th>Description</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((exception) => {
              const open = exception.status === 'OPEN'
              return (
                <tr key={exception.id}>
                  <td>{exception.reasonCode}</td>
                  <td>{exception.warehouseProviderName}</td>
                  <td>{exception.description}</td>
                  <td><StatusBadge value={exception.status} /></td>
                  <td>
                    <button className="table-button" type="button" disabled={!open} onClick={() => onResolve(exception.id)}>
                      {open ? 'Resolve and notify-ready' : 'Resolved'}
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

function RelationshipsTable({ relationships }: { relationships: MerchantWarehouseRelationship[] }) {
  if (!relationships.length) {
    return <EmptyState label="No warehouse service relationships yet" guidance="Request or activate a warehouse partner before sending stock or routing fulfillment." />
  }

  return (
    <section className="table-section">
      <h2>Warehouse Service Relationships</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {relationships.map((relationship) => (
              <tr key={relationship.id}>
                <td>
                  <Link className="text-link" to={`/merchant-warehouse/relationships/${relationship.id}`}>
                    {relationship.warehouseProviderName}
                  </Link>
                </td>
                <td><StatusBadge value={relationship.status} /></td>
                <td className="note-cell">{relationship.serviceNotes ?? 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AuthorizedStockTable({ stockRows }: { stockRows: MerchantAuthorizedStock[] }) {
  if (!stockRows.length) {
    return <EmptyState label="No authorized warehouse stock yet" guidance="Authorized stock appears after a connected warehouse receives inventory." />
  }

  return (
    <section className="table-section">
      <h2>Authorized Warehouse Stock</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Warehouse</th>
              <th>Item</th>
              <th>Available</th>
              <th>Reserved</th>
              <th>Inbound</th>
            </tr>
          </thead>
          <tbody>
            {stockRows.map((row) => (
              <tr key={`${row.relationshipId}-${row.warehouseId}-${row.inventoryItemId}`}>
                <td className="name-cell">{row.warehouseProviderName}</td>
                <td className="name-cell">{row.warehouseName}</td>
                <td className="item-cell">{row.sku} - {row.itemName}</td>
                <td><QuantityCell value={row.availableQuantity} tone={row.availableQuantity <= 0 ? 'risk' : 'ready'} /></td>
                <td><QuantityCell value={row.reservedQuantity} /></td>
                <td><QuantityCell value={row.inboundQuantity} tone={row.inboundQuantity > 0 ? 'pending' : 'neutral'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function InboundRequestsTable({
  requests,
  onSubmit,
  onCancel,
}: {
  requests: InboundStockRequest[]
  onSubmit: (request: InboundStockRequest) => void
  onCancel: (request: InboundStockRequest) => void
}) {
  if (!requests.length) {
    return <EmptyState label="No inbound stock requests yet" guidance="Create inbound stock once an active partner and SKU are ready." />
  }

  return (
    <section className="table-section">
      <h2>Inbound Stock</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Warehouse</th>
              <th>Item</th>
              <th>Requested</th>
              <th>Received</th>
              <th>Damaged</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const canSubmit = request.status === 'DRAFT'
              const canCancel = request.status === 'DRAFT' || request.status === 'SUBMITTED' || request.status === 'APPROVED'
              const submitLabel = request.status === 'DRAFT' ? 'Submit draft' : inboundClosedLabel(request.status)
              return (
                <tr key={request.id}>
                  <td>
                    <Link className="text-link" to={`/inbound-stock-requests/${request.id}`}>
                      {request.merchantReference ?? shortId(request.id)}
                    </Link>
                  </td>
                  <td className="name-cell">{request.warehouseName}</td>
                  <td className="nowrap-cell">{request.sku}</td>
                  <td>{request.requestedQuantity}</td>
                  <td>{request.receivedQuantity}</td>
                  <td>{request.damagedQuantity}</td>
                  <td><StatusBadge value={request.status} /></td>
                  <td>
                    <div className="table-actions">
                      <button className="table-button" type="button" disabled={!canSubmit} onClick={() => onSubmit(request)}>
                        {submitLabel}
                      </button>
                      <button className="table-button warning-button" type="button" disabled={!canCancel} onClick={() => onCancel(request)}>
                        {canCancel ? 'Cancel inbound' : 'Closed'}
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

function OrdersTable({
  orders,
  onAllocate,
  onCancel,
  onBackorder,
}: {
  orders: Order[]
  onAllocate?: (orderId: string) => void
  onCancel?: (orderId: string) => void
  onBackorder?: (orderId: string, backorderId: string, nextStatus: BackorderStatus) => void
}) {
  if (!orders.length) {
    return <EmptyState label="No orders yet" guidance="Create the first order once inventory can allocate." />
  }

  return (
    <section className="table-section">
      <div className="section-heading-row">
        <h2>Recent Orders</h2>
        <span>{orders.slice(0, 20).length} shown</span>
      </div>
      <div className="queue-list orders-list">
        {orders.slice(0, 20).map((order) => {
          const canAllocate = order.status === 'CREATED'
          const canCancel = ['CREATED', 'ALLOCATED', 'PARTIALLY_ALLOCATED', 'BACKORDERED'].includes(order.status)
          const cancelLabel = canCancel ? 'Cancel' : order.status === 'CANCELLED' ? 'Cancelled' : 'Locked'
          const hasOrderAction = canAllocate || canCancel
          const openBackorders = order.backorders.filter((item) => item.status === 'OPEN')
          return (
            <article
              aria-label={`Order ${shortId(order.id)} ${order.status} ${order.items.map((item) => `${item.sku} x${item.quantity}`).join(' ')}`}
              className={`queue-card ${openBackorders.length ? 'risk-card' : ''}`.trim()}
              key={order.id}
            >
              <div className="queue-card-header">
                <div className="queue-card-title">
                  <Link className="text-link mono-cell" to={`/orders/${order.id}`}>{shortId(order.id)}</Link>
                  <StatusBadge value={order.status} />
                </div>
                <div className="queue-card-meta">
                  <span className="data-chip">{order.items.length} item lines</span>
                  <span className="data-chip">{order.allocations.length} allocations</span>
                  <span className={`data-chip ${openBackorders.length ? 'warning-chip' : ''}`.trim()}>{order.backorders.length} backorders</span>
                </div>
              </div>

              <div className="queue-card-body">
                <div className="queue-card-section">
                  <h3>Items</h3>
                  <div className="chip-list">
                    {order.items.map((item) => (
                      <span className="data-chip" key={`${order.id}-${item.sku}`}>{item.sku} x{item.quantity}</span>
                    ))}
                  </div>
                </div>
                <div className="queue-card-section">
                  <h3>Allocations</h3>
                  {order.allocations.length ? (
                    <div className="chip-list">
                      {order.allocations.map((allocation) => (
                        <Link className="data-chip text-link" key={allocation.id} to={`/fulfillment-allocations/${allocation.id}`}>
                          {allocation.warehouseName}
                        </Link>
                      ))}
                    </div>
                  ) : <p>None</p>}
                </div>
                <div className="queue-card-section">
                  <h3>Backorders</h3>
                  {order.backorders.length ? (
                    <div className="backorder-list">
                      {order.backorders.map((item) => (
                        <div className="backorder-card" key={item.id}>
                          <div className="queue-card-title">
                            <span>{item.sku} x{item.quantity}</span>
                            <StatusBadge value={item.status} />
                          </div>
                          {onBackorder && item.status === 'OPEN' ? (
                            <div className="action-cluster compact-actions">
                              <button className="table-button" type="button" onClick={() => onBackorder(order.id, item.id, 'FULFILLED')}>
                                Mark fulfilled
                              </button>
                              <button className="table-button warning-button" type="button" onClick={() => onBackorder(order.id, item.id, 'CANCELLED')}>
                                Cancel line
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : <p>None</p>}
                </div>
              </div>

              {onAllocate || onCancel || onBackorder ? (
                <div className="action-cluster">
                  {onAllocate && canAllocate ? (
                    <button className="table-button" type="button" onClick={() => onAllocate(order.id)}>
                      Allocate
                    </button>
                  ) : null}
                  {onCancel && canCancel ? (
                    <button className="table-button warning-button" type="button" onClick={() => onCancel(order.id)}>
                      {cancelLabel}
                    </button>
                  ) : null}
                  {!hasOrderAction ? <span className="data-chip">No order actions available</span> : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
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

function GuidancePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="admin-guidance-panel" aria-label={title}>
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  )
}

function FirstRunChecklist({
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

function QuantityCell({ value, tone = 'neutral' }: { value: number; tone?: 'neutral' | 'ready' | 'pending' | 'risk' }) {
  return <span className={`quantity-cell quantity-${tone}`}>{value}</span>
}

function shortId(id: string) {
  return id.slice(0, 8)
}

function inboundClosedLabel(status: InboundStockRequest['status']) {
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted'
    case 'APPROVED':
      return 'Approved'
    case 'RECEIVING':
      return 'Receiving'
    case 'RECEIVED':
      return 'Received'
    case 'REJECTED':
      return 'Rejected'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return 'Closed'
  }
}

function recentOrderShipments(orders: Order[]) {
  return orders
    .flatMap((order) => order.allocations.map((allocation) => allocation.shipment).filter((shipment): shipment is Shipment => Boolean(shipment)))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}
