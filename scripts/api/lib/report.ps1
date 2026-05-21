function New-SmokeReport {
    param(
        [Parameter(Mandatory = $true)] [hashtable] $Context
    )

    $allOrderIds = @($Context.Order.id) + @($Context.ConcurrentOrders | ForEach-Object { $_.id })
    if ($Context.V4IdempotentOrder) {
        $allOrderIds += $Context.V4IdempotentOrder.id
    }
    if ($Context.V4PartialOrder) {
        $allOrderIds += $Context.V4PartialOrder.id
    }
    if ($Context.FulfilledBackorderOrder) {
        $allOrderIds += $Context.FulfilledBackorderOrder.id
    }
    if ($Context.CancelledBackorderOrder) {
        $allOrderIds += $Context.CancelledBackorderOrder.id
    }
    if ($Context.UnauthorizedStockOrder) {
        $allOrderIds += $Context.UnauthorizedStockOrder.id
    }
    $quotedOrderIds = ($allOrderIds | ForEach-Object { "'$_'::uuid" }) -join ", "

    $tableState = [ordered]@{
        tenants = Invoke-PostgresTableQuery -Sql @"
SELECT id, name, type, created_at
FROM tenants
WHERE id IN ('$($Context.Merchant.id)'::uuid, '$($Context.WarehouseProvider.id)'::uuid)
ORDER BY created_at
"@
        warehouses = Invoke-PostgresTableQuery -Sql @"
SELECT id, tenant_id, name, address, latitude, longitude, capacity, created_at
FROM warehouses
WHERE id = '$($Context.Warehouse.id)'::uuid
"@
        inventory_items = Invoke-PostgresTableQuery -Sql @"
SELECT id, merchant_id, sku, name, attributes, created_at
FROM inventory_items
WHERE id = '$($Context.Item.id)'::uuid
"@
        warehouse_inventory = Invoke-PostgresTableQuery -Sql @"
SELECT warehouse_id, inventory_item_id, quantity, reserved_quantity, version, updated_at
FROM warehouse_inventory
WHERE warehouse_id = '$($Context.Warehouse.id)'::uuid
  AND inventory_item_id IN ('$($Context.Item.id)'::uuid, '$($Context.InboundItem.id)'::uuid)
"@
        inventory_audit_logs = Invoke-PostgresTableQuery -Sql @"
SELECT id, warehouse_id, inventory_item_id, action, before_quantity, after_quantity, before_reserved_quantity, after_reserved_quantity, occurred_at
FROM inventory_audit_logs
WHERE warehouse_id = '$($Context.Warehouse.id)'::uuid
  AND inventory_item_id IN ('$($Context.Item.id)'::uuid, '$($Context.InboundItem.id)'::uuid)
ORDER BY occurred_at DESC
"@
        merchant_warehouse_relationships = Invoke-PostgresTableQuery -Sql @"
SELECT id, merchant_id, warehouse_provider_id, status, service_notes, created_at, approved_at
FROM merchant_warehouse_relationships
WHERE id = '$($Context.MerchantWarehouseRelationship.id)'::uuid
"@
        inbound_stock_requests = Invoke-PostgresTableQuery -Sql @"
SELECT id, relationship_id, merchant_id, warehouse_provider_id, warehouse_id, inventory_item_id, requested_quantity, received_quantity, damaged_quantity, status, merchant_reference, created_at, received_at
FROM inbound_stock_requests
WHERE id = '$($Context.InboundStockRequest.id)'::uuid
"@
        service_agreements = Invoke-PostgresTableQuery -Sql @"
SELECT id, relationship_id, merchant_id, warehouse_provider_id, status, title, version_number, effective_date, renewal_review_date, cancellation_window_days, service_scopes, created_at, proposed_at, accepted_at, activated_at
FROM service_agreements
WHERE id = '$($Context.ServiceAgreement.id)'::uuid
"@
        service_statements = Invoke-PostgresTableQuery -Sql @"
SELECT id, agreement_id, merchant_id, warehouse_provider_id, status, period_start, period_end, due_date, subtotal_amount, coordination_fee_amount, adjustment_amount, total_amount, idempotency_key, finalized_at, settlement_marked_at
FROM service_statements
WHERE id = '$($Context.ServiceStatement.id)'::uuid
"@
        service_statement_lines = Invoke-PostgresTableQuery -Sql @"
SELECT id, statement_id, line_type, source_type, source_id, description, quantity, unit_amount, line_amount
FROM service_statement_lines
WHERE statement_id = '$($Context.ServiceStatement.id)'::uuid
ORDER BY id
"@
        service_disputes = Invoke-PostgresTableQuery -Sql @"
SELECT id, agreement_id, statement_id, statement_line_id, status, reason, created_at, resolved_at
FROM service_disputes
WHERE id = '$($Context.ServiceDispute.id)'::uuid
"@
        service_claims = Invoke-PostgresTableQuery -Sql @"
SELECT id, agreement_id, status, source_type, source_id, claim_type, reason, created_at, resolved_at
FROM service_claims
WHERE id = '$($Context.ServiceClaim.id)'::uuid
"@
        service_review_requests = Invoke-PostgresTableQuery -Sql @"
SELECT id, agreement_id, review_type, status, reason, requested_by, created_at, reviewed_at
FROM service_review_requests
WHERE id = '$($Context.ServiceReview.id)'::uuid
"@
        order_import_batches = Invoke-PostgresTableQuery -Sql @"
SELECT id, merchant_id, mode, status, source_label, total_rows, created_rows, rejected_rows, created_at
FROM order_import_batches
WHERE id = '$($Context.OrderImport.id)'::uuid
"@
        order_import_rows = Invoke-PostgresTableQuery -Sql @"
SELECT id, batch_id, created_order_id, status, row_number, merchant_order_reference, sku, quantity, failure_reason
FROM order_import_rows
WHERE batch_id = '$($Context.OrderImport.id)'::uuid
ORDER BY row_number
"@
        customer_orders = Invoke-PostgresTableQuery -Sql @"
SELECT id, merchant_id, customer_address, status, created_at
FROM customer_orders
WHERE id IN ($quotedOrderIds)
ORDER BY created_at
"@
        order_items = Invoke-PostgresTableQuery -Sql @"
SELECT id, order_id, inventory_item_id, quantity
FROM order_items
WHERE order_id IN ($quotedOrderIds)
ORDER BY id
"@
        fulfillment_allocations = Invoke-PostgresTableQuery -Sql @"
SELECT id, order_id, warehouse_id, status, created_at
FROM fulfillment_allocations
WHERE order_id IN ($quotedOrderIds)
ORDER BY created_at
"@
        shipments = Invoke-PostgresTableQuery -Sql @"
SELECT id, allocation_id, carrier, tracking_number, status, metadata, created_at
FROM shipments
WHERE allocation_id IN (
    SELECT id
    FROM fulfillment_allocations
    WHERE order_id IN ($quotedOrderIds)
)
"@
        fulfillment_allocation_items = Invoke-PostgresTableQuery -Sql @"
SELECT fai.id, fai.allocation_id, fai.inventory_item_id, fai.quantity
FROM fulfillment_allocation_items fai
JOIN fulfillment_allocations fa ON fa.id = fai.allocation_id
WHERE fa.order_id IN ($quotedOrderIds)
ORDER BY fai.id
"@
        backorder_items = Invoke-PostgresTableQuery -Sql @"
SELECT id, order_id, inventory_item_id, quantity, status, created_at
FROM backorder_items
WHERE order_id IN ($quotedOrderIds)
ORDER BY created_at
"@
        idempotency_records = Invoke-PostgresTableQuery -Sql @"
SELECT id, idempotency_key, method, request_path, response_status, created_at
FROM idempotency_records
WHERE idempotency_key LIKE 'smoke-%-$($Context.Suffix)'
ORDER BY created_at
"@
        outbox_events = Invoke-PostgresTableQuery -Sql @"
SELECT id, event_type, aggregate_type, aggregate_id, status, attempts, processed_at, next_attempt_at, last_error, created_at
FROM outbox_events
WHERE aggregate_id IN ($quotedOrderIds)
   OR aggregate_id IN (
       SELECT id
       FROM shipments
       WHERE allocation_id IN (
           SELECT id
           FROM fulfillment_allocations
           WHERE order_id IN ($quotedOrderIds)
       )
)
ORDER BY created_at
"@
        carrier_dispatches = Invoke-PostgresTableQuery -Sql @"
SELECT id, outbox_event_id, shipment_id, event_type, carrier, tracking_number, status, attempts, external_reference, created_at
FROM carrier_dispatches
WHERE shipment_id IN (
    SELECT id
    FROM shipments
    WHERE allocation_id IN (
        SELECT id
        FROM fulfillment_allocations
        WHERE order_id IN ($quotedOrderIds)
    )
)
ORDER BY created_at
"@
        app_users = Invoke-PostgresTableQuery -Sql @"
SELECT id, tenant_id, email, role, enabled, created_at
FROM app_users
WHERE email IN ('admin@merhouse.local', '$($Context.MerchantUser.email)', '$($Context.OperatorUser.email)', '$($Context.DisabledUser.email)', '$($Context.SecondaryAdminUser.email)')
ORDER BY created_at
"@
        access_requests = Invoke-PostgresTableQuery -Sql @"
SELECT id, requester_email, requested_role, status, reviewed_at, created_at
FROM access_requests
WHERE requester_email IN ('$($Context.AccessRequest.requesterEmail)', '$($Context.RejectedAccessRequest.requesterEmail)', '$($Context.BoundaryAccessRequest.requesterEmail)')
ORDER BY created_at
"@
    }

    [ordered]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString("o")
        baseUrl = $Context.BaseUrl
        testRun = $Context.Suffix
        status = "PASSED"
        apiResponses = [ordered]@{
            merchantTenant = $Context.Merchant
            warehouseProviderTenant = $Context.WarehouseProvider
            warehouse = $Context.Warehouse
            inventoryItem = $Context.Item
            stock = $Context.Stock
            merchantWarehouseRelationship = $Context.MerchantWarehouseRelationship
            inboundItem = $Context.InboundItem
            inboundStockRequest = $Context.InboundStockRequest
            inboundInventory = $Context.InboundInventoryRows
            inboundAuditLogs = $Context.InboundAuditRows
            authorizedStock = $Context.AuthorizedStockRows
            otherMerchantInboundRows = $Context.OtherMerchantInboundRows
            wrongProviderInboundRows = $Context.WrongProviderInboundRows
            unauthorizedStockOrder = $Context.UnauthorizedStockOrder
            serviceAgreement = $Context.ServiceAgreement
            merchantAgreementRows = $Context.MerchantAgreementRows
            providerAgreementRows = $Context.ProviderAgreementRows
            serviceStatement = $Context.ServiceStatement
            serviceSlaStatuses = $Context.ServiceSlaStatuses
            serviceDispute = $Context.ServiceDispute
            serviceClaim = $Context.ServiceClaim
            serviceReview = $Context.ServiceReview
            orderImport = $Context.OrderImport
            v12PlatformSummary = $Context.V12PlatformSummary
            v12TenantHealthDetail = $Context.V12TenantHealthDetail
            v12GovernedTenant = $Context.V12GovernedTenant
            v12Relationship = $Context.V12Relationship
            v12ConvertedAccessRequest = $Context.V12ConvertedAccessRequest
            v12DeadLetterEvent = $Context.V12DeadLetterEvent
            v12AuditEvents = $Context.V12AuditEvents
            removedStock = $Context.RemovedStock
            warehouseInventory = $Context.InventoryRows
            initialAuditLogs = $Context.AuditRows
            removeAuditLogs = $Context.RemoveAuditRows
            order = $Context.Order
            allocatedOrder = $Context.AllocatedOrder
            reservedWarehouseInventory = $Context.ReservedRows
            reservationAuditLogs = $Context.ReservationAuditRows
            cancelledOrder = $Context.CancelledOrder
            releasedWarehouseInventory = $Context.ReleasedRows
            releaseAuditLogs = $Context.ReleaseAuditRows
            concurrentOrders = $Context.ConcurrentOrders
            concurrencyResults = $Context.ConcurrencyResults
            concurrentWarehouseInventory = $Context.ConcurrentRows
            pickingAllocation = $Context.PickingAllocation
            packedAllocation = $Context.PackedAllocation
            shipment = $Context.Shipment
            shippedOrder = $Context.ShippedOrder
            deliveredShipment = $Context.DeliveredShipment
            deliveredOrder = $Context.DeliveredOrder
            failedShipment = $Context.FailedShipment
            failedShipmentOrder = $Context.FailedShipmentOrder
            returnedShipment = $Context.ReturnedShipment
            returnedShipmentOrder = $Context.ReturnedShipmentOrder
            v4IdempotentOrder = $Context.V4IdempotentOrder
            v4IdempotentReplay = $Context.V4IdempotentReplay
            v4PartialOrder = $Context.V4PartialOrder
            v4PartialAllocatedOrder = $Context.V4PartialAllocatedOrder
            adminLogin = $Context.AdminLogin
            merchantUser = $Context.MerchantUser
            operatorUser = $Context.OperatorUser
            disabledUser = $Context.DisabledUser
            secondaryAdminUser = $Context.SecondaryAdminUser
            merchantConsoleItem = $Context.MerchantConsoleItem
            merchantConsoleOrder = $Context.MerchantConsoleOrder
            v5MerchantItem = $Context.V5MerchantItem
            v6OutboxProcess = $Context.V6OutboxProcess
            backorderOnlyItem = $Context.BackorderOnlyItem
            fulfilledBackorderOrder = $Context.FulfilledBackorderOrder
            cancelledBackorderOrder = $Context.CancelledBackorderOrder
            merchantLoginAfterReset = $Context.MerchantLoginAfterReset
            approvedAccessRequest = $Context.ApprovedAccessRequest
            rejectedAccessRequest = $Context.RejectedAccessRequest
            boundaryAccessRequest = $Context.BoundaryAccessRequest
            openApiContractPaths = @($Context.OpenApiContract.paths.PSObject.Properties.Name)
        }
        tableStateAfterTransactions = $tableState
    }
}

function New-SmokeSummary {
    param(
        [Parameter(Mandatory = $true)] [hashtable] $Context,
        [Parameter(Mandatory = $true)] $Report
    )

    $tableState = $Report.tableStateAfterTransactions
    $successfulCount = @($Context.SuccessfulAllocations).Count
    $backorderedCount = @($Context.BackorderedAllocations).Count
    $failedCount = @($Context.FailedAllocations).Count
    $finalInventory = @($Context.ConcurrentRows)[0]
    $finalOrder = $Context.DeliveredOrder
    $finalShipment = $Context.DeliveredShipment
    $failedShipment = $Context.FailedShipment
    $returnedShipment = $Context.ReturnedShipment
    $fulfilledBackorderStatus = if ($Context.FulfilledBackorderOrder) { $Context.FulfilledBackorderOrder.backorders[0].status } else { "" }
    $cancelledBackorderStatus = if ($Context.CancelledBackorderOrder) { $Context.CancelledBackorderOrder.backorders[0].status } else { "" }
    $v4BackorderQuantity = if ($Context.V4PartialAllocatedOrder) { $Context.V4PartialAllocatedOrder.backorders[0].quantity } else { 0 }
    $v4AllocationCount = if ($Context.V4PartialAllocatedOrder) { @($Context.V4PartialAllocatedOrder.allocations).Count } else { 0 }
    $v4IdempotentOrderId = if ($Context.V4IdempotentOrder) { $Context.V4IdempotentOrder.id } else { "" }
    $v4PartialOrderId = if ($Context.V4PartialOrder) { $Context.V4PartialOrder.id } else { "" }
    $v4OutboxCount = @($Context.V4OutboxRows).Count
    $v5MerchantUserId = if ($Context.MerchantUser) { $Context.MerchantUser.id } else { "" }
    $v5OperatorUserId = if ($Context.OperatorUser) { $Context.OperatorUser.id } else { "" }
    $v5DisabledUserId = if ($Context.DisabledUser) { $Context.DisabledUser.id } else { "" }
    $v5SecondaryAdminUserId = if ($Context.SecondaryAdminUser) { $Context.SecondaryAdminUser.id } else { "" }
    $v7MerchantConsoleItemId = if ($Context.MerchantConsoleItem) { $Context.MerchantConsoleItem.id } else { "" }
    $v7MerchantConsoleOrderId = if ($Context.MerchantConsoleOrder) { $Context.MerchantConsoleOrder.id } else { "" }
    $v6ProcessedCount = @($Context.V6OutboxRows).Count
    $v6CarrierDispatchCount = @($Context.V6CarrierDispatchRows).Count
    $v8InboundReceivedQuantity = if ($Context.InboundStockRequest) { $Context.InboundStockRequest.receivedQuantity } else { 0 }
    $v8InboundDamagedQuantity = if ($Context.InboundStockRequest) { $Context.InboundStockRequest.damagedQuantity } else { 0 }
    $v8InboundShortageQuantity = if ($Context.InboundStockRequest) { $Context.InboundStockRequest.shortageQuantity } else { 0 }
    $v11AgreementStatus = if ($Context.ServiceAgreement) { $Context.ServiceAgreement.status } else { "" }
    $v11StatementStatus = if ($Context.ServiceStatement) { $Context.ServiceStatement.status } else { "" }
    $v11StatementTotal = if ($Context.ServiceStatement) { $Context.ServiceStatement.totalAmount } else { "" }
    $v11ImportStatus = if ($Context.OrderImport) { $Context.OrderImport.status } else { "" }
    $v12TenantStatus = if ($Context.V12GovernedTenant -and $Context.V12GovernedTenant.active) { "ACTIVE" } else { "UNKNOWN" }
    $v12RelationshipStatus = if ($Context.V12Relationship) { $Context.V12Relationship.status } else { "" }
    $v12DeadLetterStatus = if ($Context.V12DeadLetterEvent) { $Context.V12DeadLetterEvent.status } else { "" }

    $lines = @(
        "# API Smoke Test Summary",
        "",
        "- Status: PASSED",
        "- Generated at: $($Report.generatedAt)",
        "- Base URL: $($Context.BaseUrl)",
        "- Test run: $($Context.Suffix)",
        "",
        "## Scenario Results",
        "",
        "| Scenario | Result | Proof |",
        "| --- | --- | --- |",
        "| Inventory setup | PASS | Stock created with quantity 50 and available 50, then V10 reason-coded adjustment raised operational stock to $($Context.OperationalStockQuantity) |",
        "| Stock removal | PASS | Available stock removal wrote STOCK_REMOVED audit proof without consuming reserved stock |",
        "| V8/V10 merchant-warehouse loop | PASS | Relationship activated; inbound draft/submit/cancel and warehouse approval-before-receiving were verified; inbound request received $v8InboundReceivedQuantity units, recorded $v8InboundDamagedQuantity damaged and $v8InboundShortageQuantity short, merchant authorized-stock visibility was verified, wrong-role/wrong-merchant/wrong-provider access was blocked, and unauthorized warehouse stock backordered |",
        "| V11 service accountability | PASS | Service agreement reached $v11AgreementStatus; merchant/provider visibility and wrong-tenant denial were verified; idempotent generated statement creation reconciled to inbound work and reached $v11StatementStatus with total $v11StatementTotal without payment collection; SLA, dispute, claim, review, and $v11ImportStatus order-import proof passed |",
        "| V12 admin control plane | PASS | Platform summary and tenant health loaded; tenant governance returned $v12TenantStatus; relationship governance reached $v12RelationshipStatus; approved access request conversion created linked tenant/user setup; user recovery and self-demotion safety passed; one outbox diagnostic event reached $v12DeadLetterStatus and audit explorer rows were present |",
        "| Order allocation | PASS | Order moved CREATED -> ALLOCATED and reserved 12 units |",
        "| Cancellation | PASS | Order moved ALLOCATED -> CANCELLED and reserved stock returned to 0 |",
        "| Concurrency | PASS | $successfulCount orders allocated, $backorderedCount orders backordered, $failedCount HTTP failures against $($Context.OperationalStockQuantity) auditable units |",
        "| Shipment lifecycle | PASS | Operator queue exposed allocations; invalid transition was blocked; V10 workload scan/pick-sheet evidence, package history, merchant-visible exception report/resolve, dashboard summaries, and delivered/failed/returned shipment statuses were verified |",
        "| V9 operational details | PASS | Merchant, warehouse operator, and admin-readable order/inbound/shipment/allocation/relationship/inventory detail timelines were verified, and wrong-tenant detail reads were blocked |",
        "| V4 reliability | PASS | Idempotent order create, partial allocation/backorder, and outbox capture verified |",
        "| V5 admin/auth | PASS | Admin login, user creation, /me, RBAC blocks, and tenant ownership verified |",
        "| V6 outbox processing | PASS | $v6ProcessedCount scoped outbox rows processed and $v6CarrierDispatchCount carrier dispatches recorded |",
        "| Backorder status | PASS | Explicit backorder fulfillment and cancellation endpoints changed OPEN backorders to FULFILLED and CANCELLED |",
        "| V7.6 auth recovery/access | PASS | Password reset request/confirm, single-use rejection, access request submit/list/approve/reject verified |",
        "| API boundary checks | PASS | Injection-shaped access request data stayed inert, merchant access to admin APIs was blocked, invalid reset tokens failed safely, and OpenAPI exposed expected contract metadata |",
        "",
        "## Key IDs",
        "",
        "| Resource | ID |",
        "| --- | --- |",
        "| Merchant tenant | $($Context.Merchant.id) |",
        "| Warehouse provider tenant | $($Context.WarehouseProvider.id) |",
        "| Warehouse | $($Context.Warehouse.id) |",
        "| Inventory item | $($Context.Item.id) |",
        "| Merchant-warehouse relationship | $($Context.MerchantWarehouseRelationship.id) |",
        "| Inbound stock request | $($Context.InboundStockRequest.id) |",
        "| Inbound item | $($Context.InboundItem.id) |",
        "| Service agreement | $($Context.ServiceAgreement.id) |",
        "| Service statement | $($Context.ServiceStatement.id) |",
        "| Service dispute | $($Context.ServiceDispute.id) |",
        "| Service claim | $($Context.ServiceClaim.id) |",
        "| Service review | $($Context.ServiceReview.id) |",
        "| Order import | $($Context.OrderImport.id) |",
        "| V12 governed tenant | $($Context.V12GovernedTenant.id) |",
        "| V12 governed relationship | $($Context.V12Relationship.id) |",
        "| V12 converted access request | $($Context.V12ConvertedAccessRequest.id) |",
        "| Unauthorized stock order | $($Context.UnauthorizedStockOrder.id) |",
        "| Cancelled order | $($Context.Order.id) |",
        "| Delivered order | $($finalOrder.id) |",
        "| Shipment | $($finalShipment.id) |",
        "| Failed shipment | $($failedShipment.id) |",
        "| Returned shipment | $($returnedShipment.id) |",
        "| Fulfilled backorder order | $($Context.FulfilledBackorderOrder.id) |",
        "| Cancelled backorder order | $($Context.CancelledBackorderOrder.id) |",
        "| Merchant user | $v5MerchantUserId |",
        "| Warehouse operator user | $v5OperatorUserId |",
        "| Secondary admin user | $v5SecondaryAdminUserId |",
        "| Disabled user | $v5DisabledUserId |",
        "| Merchant console item | $v7MerchantConsoleItemId |",
        "| Merchant console order | $v7MerchantConsoleOrderId |",
        "",
        "## Inventory Invariant",
        "",
        "| Quantity | Reserved | Available | Version |",
        "| ---: | ---: | ---: | ---: |",
        "| $($finalInventory.quantity) | $($finalInventory.reservedQuantity) | $($finalInventory.availableQuantity) | $($finalInventory.version) |",
        "",
        "Expected after concurrency: quantity $($Context.OperationalStockQuantity), reserved $($Context.OperationalStockQuantity), available 0.",
        "",
        "## Final States",
        "",
        "| Object | State |",
        "| --- | --- |",
        "| Cancelled order | $($Context.CancelledOrder.status) |",
        "| Cancelled allocation | $($Context.CancelledOrder.allocations[0].status) |",
        "| Shipment | $($finalShipment.status) |",
        "| Failed shipment | $($failedShipment.status) |",
        "| Failed shipment order | $($Context.FailedShipmentOrder.status) |",
        "| Returned shipment | $($returnedShipment.status) |",
        "| Returned shipment order | $($Context.ReturnedShipmentOrder.status) |",
        "| Delivered order | $($finalOrder.status) |",
        "| Delivered order allocation | $($finalOrder.allocations[0].status) |",
        "| Fulfilled backorder | $fulfilledBackorderStatus |",
        "| Cancelled backorder | $cancelledBackorderStatus |",
        "",
        "## V4 Reliability Proof",
        "",
        "| Capability | Proof |",
        "| --- | --- |",
        "| Idempotency | Replayed POST /orders returned the same order $v4IdempotentOrderId |",
        "| Partial allocation | $v4AllocationCount warehouse allocations created for order $v4PartialOrderId |",
        "| Backorder | $v4BackorderQuantity units recorded as backordered |",
        "| Outbox | $v4OutboxCount V4 outbox rows captured |",
        "",
        "## V5 Admin/Auth Proof",
        "",
        "| Capability | Proof |",
        "| --- | --- |",
        "| Admin login | Seeded admin obtained a bearer token and resolved /auth/me |",
        "| User admin APIs | Merchant and warehouse operator users were created, and tenant-role mismatches were rejected |",
        "| RBAC | Anonymous tenant listing and operator order creation were blocked |",
        "| Tenant ownership | Merchant created own item and was blocked from cross-tenant item creation, listing, and order creation |",
        "| Operator access | Warehouse operator read its warehouse inventory |",
        "| Merchant console operations | Merchant created an item, created an order, allocated it to backorder, and cancelled it |",
        "| User disable | Admin self-disable was blocked, another admin could be disabled while one remained, disabled tokens were rejected, and disabled users could not log in |",
        "| Password recovery | Enabled-user reset produced a local dev token, missing account stayed generic, reset token was single-use, and login worked with the new password |",
        "| Access requests | Public merchant/warehouse requests were submitted and admin review moved them to approved/rejected states |",
        "",
        "## V6 Outbox Processing Proof",
        "",
        "| Capability | Proof |",
        "| --- | --- |",
        "| Manual drain | POST /admin/outbox/process processed $($Context.V6OutboxProcess.processed) events with $($Context.V6OutboxProcess.failed) failures |",
        "| Retry accounting | Processed smoke rows recorded attempts and processed_at timestamps |",
        "| Carrier adapter | $v6CarrierDispatchCount local carrier dispatch rows recorded for shipment events |",
        "",
        "## Table Rows Captured",
        "",
        "| Table | Rows in report |",
        "| --- | ---: |",
        "| tenants | $(@($tableState.tenants).Count) |",
        "| warehouses | $(@($tableState.warehouses).Count) |",
        "| inventory_items | $(@($tableState.inventory_items).Count) |",
        "| warehouse_inventory | $(@($tableState.warehouse_inventory).Count) |",
        "| inventory_audit_logs | $(@($tableState.inventory_audit_logs).Count) |",
        "| merchant_warehouse_relationships | $(@($tableState.merchant_warehouse_relationships).Count) |",
        "| inbound_stock_requests | $(@($tableState.inbound_stock_requests).Count) |",
        "| service_agreements | $(@($tableState.service_agreements).Count) |",
        "| service_statements | $(@($tableState.service_statements).Count) |",
        "| service_statement_lines | $(@($tableState.service_statement_lines).Count) |",
        "| service_disputes | $(@($tableState.service_disputes).Count) |",
        "| service_claims | $(@($tableState.service_claims).Count) |",
        "| service_review_requests | $(@($tableState.service_review_requests).Count) |",
        "| order_import_batches | $(@($tableState.order_import_batches).Count) |",
        "| order_import_rows | $(@($tableState.order_import_rows).Count) |",
        "| customer_orders | $(@($tableState.customer_orders).Count) |",
        "| order_items | $(@($tableState.order_items).Count) |",
        "| fulfillment_allocations | $(@($tableState.fulfillment_allocations).Count) |",
        "| shipments | $(@($tableState.shipments).Count) |",
        "| fulfillment_allocation_items | $(@($tableState.fulfillment_allocation_items).Count) |",
        "| backorder_items | $(@($tableState.backorder_items).Count) |",
        "| idempotency_records | $(@($tableState.idempotency_records).Count) |",
        "| outbox_events | $(@($tableState.outbox_events).Count) |",
        "| carrier_dispatches | $(@($tableState.carrier_dispatches).Count) |",
        "| app_users | $(@($tableState.app_users).Count) |",
        "| access_requests | $(@($tableState.access_requests).Count) |",
        "",
        "Full machine-readable details are in the matching JSON report."
    )

    $lines -join [Environment]::NewLine
}
