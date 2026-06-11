param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "1. Checking API is reachable"
$initialTenants = Invoke-Json -Context $Context -Method Get -Path "/api/v1/tenants"
Assert-Equal -Actual ($initialTenants -is [array] -or $null -eq $initialTenants -or $initialTenants.Count -ge 0) -Expected $true -Message "Tenants endpoint did not return a readable response."

Write-Host "2. Creating merchant tenant"
$Context.Merchant = Invoke-Json -Context $Context -Method Post -Path "/api/v1/tenants" -Body @{
    name = "Smoke Merchant $($Context.Suffix)"
    type = "MERCHANT"
}
Assert-NotBlank -Value $Context.Merchant.id -Message "Merchant tenant id was blank."
Assert-Equal -Actual $Context.Merchant.type -Expected "MERCHANT" -Message "Merchant tenant type mismatch."

Write-Host "3. Creating warehouse provider tenant"
$Context.WarehouseProvider = Invoke-Json -Context $Context -Method Post -Path "/api/v1/tenants" -Body @{
    name = "Smoke Warehouse Provider $($Context.Suffix)"
    type = "WAREHOUSE_PROVIDER"
}
Assert-NotBlank -Value $Context.WarehouseProvider.id -Message "Warehouse provider tenant id was blank."
Assert-Equal -Actual $Context.WarehouseProvider.type -Expected "WAREHOUSE_PROVIDER" -Message "Warehouse provider tenant type mismatch."

Write-Host "4. Creating warehouse"
$Context.Warehouse = Invoke-Json -Context $Context -Method Post -Path "/api/v1/warehouses" -Body @{
    tenantId = $Context.WarehouseProvider.id
    name = "Smoke Cairo DC $($Context.Suffix)"
    address = "New Cairo, Cairo"
    latitude = 30.0444
    longitude = 31.2357
    capacity = 10000
}
Assert-NotBlank -Value $Context.Warehouse.id -Message "Warehouse id was blank."
Assert-Equal -Actual $Context.Warehouse.tenantId -Expected $Context.WarehouseProvider.id -Message "Warehouse tenant id mismatch."
Assert-Equal -Actual $Context.Warehouse.capacity -Expected 10000 -Message "Warehouse capacity mismatch."

Write-Host "5. Creating inventory item"
$Context.Item = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/items" -Body @{
    merchantId = $Context.Merchant.id
    sku = "SMOKE-SKU-$($Context.Suffix)"
    name = "Smoke Test Item"
    attributes = @{
        color = "black"
        size = "M"
        testRun = $Context.Suffix
    }
}
Assert-NotBlank -Value $Context.Item.id -Message "Inventory item id was blank."
Assert-Equal -Actual $Context.Item.merchantId -Expected $Context.Merchant.id -Message "Inventory item merchant id mismatch."
Assert-Equal -Actual $Context.Item.sku -Expected "SMOKE-SKU-$($Context.Suffix)" -Message "Inventory item SKU mismatch."

Write-Host "6. Adding stock"
$Context.Stock = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/stock" -Body @{
    warehouseId = $Context.Warehouse.id
    inventoryItemId = $Context.Item.id
    quantity = 50
}
Assert-Equal -Actual $Context.Stock.warehouseId -Expected $Context.Warehouse.id -Message "Stock warehouse id mismatch."
Assert-Equal -Actual $Context.Stock.inventoryItemId -Expected $Context.Item.id -Message "Stock item id mismatch."
Assert-Equal -Actual $Context.Stock.quantity -Expected 50 -Message "Stock quantity mismatch."
Assert-Equal -Actual $Context.Stock.reservedQuantity -Expected 0 -Message "Reserved quantity mismatch."
Assert-Equal -Actual $Context.Stock.availableQuantity -Expected 50 -Message "Available quantity mismatch."

Write-Host "7. Reading warehouse inventory"
$inventory = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/warehouses/$($Context.Warehouse.id)"
$Context.InventoryRows = @($inventory)
Assert-Equal -Actual $Context.InventoryRows.Count -Expected 1 -Message "Warehouse inventory row count mismatch."
Assert-Equal -Actual $Context.InventoryRows[0].sku -Expected "SMOKE-SKU-$($Context.Suffix)" -Message "Warehouse inventory SKU mismatch."
Assert-Equal -Actual $Context.InventoryRows[0].quantity -Expected 50 -Message "Warehouse inventory quantity mismatch."
Assert-Equal -Actual $Context.InventoryRows[0].availableQuantity -Expected 50 -Message "Warehouse inventory available quantity mismatch."

Write-Host "8. Reading audit logs"
$auditLogs = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/items/$($Context.Item.id)/audit-logs"
$Context.AuditRows = @($auditLogs)
Assert-Equal -Actual ($Context.AuditRows.Count -ge 1) -Expected $true -Message "Expected at least one audit log row."
Assert-Equal -Actual $Context.AuditRows[0].action -Expected "STOCK_ADDED" -Message "Latest audit action mismatch."
Assert-Equal -Actual $Context.AuditRows[0].beforeQuantity -Expected 0 -Message "Audit before quantity mismatch."
Assert-Equal -Actual $Context.AuditRows[0].afterQuantity -Expected 50 -Message "Audit after quantity mismatch."

Write-Host "8a. Removing only available stock and preserving reserved stock"
$Context.ExtraStock = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/stock" -Body @{
    warehouseId = $Context.Warehouse.id
    inventoryItemId = $Context.Item.id
    quantity = 5
}
Assert-Equal -Actual $Context.ExtraStock.quantity -Expected 55 -Message "Extra stock quantity mismatch."
$Context.RemovedStock = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/stock/remove" -Body @{
    warehouseId = $Context.Warehouse.id
    inventoryItemId = $Context.Item.id
    quantity = 5
}
Assert-Equal -Actual $Context.RemovedStock.quantity -Expected 50 -Message "Removed stock quantity mismatch."
Assert-Equal -Actual $Context.RemovedStock.reservedQuantity -Expected 0 -Message "Removed stock reserved quantity mismatch."
Assert-Equal -Actual $Context.RemovedStock.availableQuantity -Expected 50 -Message "Removed stock available quantity mismatch."
$removeAuditLogs = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/items/$($Context.Item.id)/audit-logs"
$Context.RemoveAuditRows = @($removeAuditLogs)
Assert-Equal -Actual $Context.RemoveAuditRows[0].action -Expected "STOCK_REMOVED" -Message "Latest audit action after stock removal mismatch."
Assert-Equal -Actual $Context.RemoveAuditRows[0].beforeQuantity -Expected 55 -Message "Remove audit before quantity mismatch."
Assert-Equal -Actual $Context.RemoveAuditRows[0].afterQuantity -Expected 50 -Message "Remove audit after quantity mismatch."

Write-Host "8b. Applying V10 reason-coded stock adjustment"
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/inventory/stock/adjust" -Headers $Context.AdminHeaders -ExpectedStatus 409 -Body @{
    warehouseId = $Context.Warehouse.id
    inventoryItemId = $Context.Item.id
    quantityDelta = -999
    reasonCode = "POLICY_VIOLATION"
    reasonNote = "Deliberate V10 violation: adjustment would make stock negative."
}
$Context.AdjustedStock = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/stock/adjust" -Headers $Context.AdminHeaders -Body @{
    warehouseId = $Context.Warehouse.id
    inventoryItemId = $Context.Item.id
    quantityDelta = 2
    reasonCode = "CYCLE_COUNT_GAIN"
    reasonNote = "V10 smoke cycle count gain with reason evidence."
}
Assert-Equal -Actual $Context.AdjustedStock.quantity -Expected 52 -Message "Adjusted stock quantity mismatch."
Assert-Equal -Actual $Context.AdjustedStock.availableQuantity -Expected 52 -Message "Adjusted stock available mismatch."
$Context.OperationalStockQuantity = $Context.AdjustedStock.quantity
$adjustAuditLogs = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/items/$($Context.Item.id)/audit-logs" -Headers $Context.AdminHeaders
$Context.AdjustAuditRows = @($adjustAuditLogs)
Assert-Equal -Actual $Context.AdjustAuditRows[0].action -Expected "STOCK_ADJUSTED" -Message "Latest audit action after stock adjustment mismatch."
Assert-Equal -Actual $Context.AdjustAuditRows[0].reasonCode -Expected "CYCLE_COUNT_GAIN" -Message "Adjustment audit reason code mismatch."
Assert-Equal -Actual $Context.AdjustAuditRows[0].reasonNote -Expected "V10 smoke cycle count gain with reason evidence." -Message "Adjustment audit reason note mismatch."
