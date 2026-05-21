param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "25. Creating an order with an idempotency key"
$idempotencyKey = "smoke-order-$($Context.Suffix)"
$idempotentOrderBody = @{
    merchantId = $Context.Merchant.id
    customerAddress = "Idempotent Customer, Cairo"
    items = @(@{ inventoryItemId = $Context.Item.id; quantity = 1 })
}
$headers = @{ "Idempotency-Key" = $idempotencyKey }
$Context.V4IdempotentOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Body $idempotentOrderBody -Headers $headers
$Context.V4IdempotentReplay = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Body $idempotentOrderBody -Headers $headers
Assert-Equal -Actual $Context.V4IdempotentReplay.id -Expected $Context.V4IdempotentOrder.id -Message "Idempotent order replay returned a different order id."

Write-Host "26. Creating stock split across warehouses"
$Context.V4Item = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/items" -Body @{
    merchantId = $Context.Merchant.id
    sku = "V4-SKU-$($Context.Suffix)"
    name = "V4 Reliability Item"
    attributes = @{ testRun = $Context.Suffix; phase = "v4" }
}
$Context.V4SecondWarehouse = Invoke-Json -Context $Context -Method Post -Path "/api/v1/warehouses" -Body @{
    tenantId = $Context.WarehouseProvider.id
    name = "Smoke Giza DC $($Context.Suffix)"
    address = "Giza, Egypt"
    latitude = 30.0131
    longitude = 31.2089
    capacity = 5000
}
Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/stock" -Body @{
    warehouseId = $Context.Warehouse.id
    inventoryItemId = $Context.V4Item.id
    quantity = 4
} | Out-Null
Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/stock" -Body @{
    warehouseId = $Context.V4SecondWarehouse.id
    inventoryItemId = $Context.V4Item.id
    quantity = 3
} | Out-Null

Write-Host "27. Partially allocating an order with backorder remainder"
$Context.V4PartialOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "Partial Allocation Customer, Cairo"
    items = @(@{ inventoryItemId = $Context.V4Item.id; quantity = 10 })
}
$Context.V4PartialAllocatedOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/$($Context.V4PartialOrder.id)/allocate"
Assert-Equal -Actual $Context.V4PartialAllocatedOrder.status -Expected "PARTIALLY_ALLOCATED" -Message "Partial allocation order status mismatch."
Assert-Equal -Actual @($Context.V4PartialAllocatedOrder.allocations).Count -Expected 2 -Message "Partial allocation should create two warehouse allocations."
Assert-Equal -Actual @($Context.V4PartialAllocatedOrder.backorders).Count -Expected 1 -Message "Partial allocation should create one backorder row."
Assert-Equal -Actual $Context.V4PartialAllocatedOrder.backorders[0].quantity -Expected 3 -Message "Backorder quantity mismatch."

Write-Host "28. Verifying V4 reliability tables"
$Context.V4IdempotencyRows = Invoke-PostgresTableQuery -Sql @"
SELECT id, idempotency_key, method, request_path, response_status
FROM idempotency_records
WHERE idempotency_key = '$idempotencyKey'
"@
$Context.V4OutboxRows = Invoke-PostgresTableQuery -Sql @"
SELECT id, event_type, aggregate_type, aggregate_id, status
FROM outbox_events
WHERE aggregate_id IN ('$($Context.V4IdempotentOrder.id)'::uuid, '$($Context.V4PartialOrder.id)'::uuid)
ORDER BY created_at
"@
Assert-Equal -Actual @($Context.V4IdempotencyRows).Count -Expected 1 -Message "Idempotency record count mismatch."
Assert-Equal -Actual (@($Context.V4OutboxRows).Count -ge 3) -Expected $true -Message "Expected V4 outbox events were not recorded."
