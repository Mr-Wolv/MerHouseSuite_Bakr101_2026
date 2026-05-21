param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "9. Creating order"
$Context.Order = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "Smoke Customer Address, Cairo"
    items = @(@{ inventoryItemId = $Context.Item.id; quantity = 12 })
}
Assert-NotBlank -Value $Context.Order.id -Message "Order id was blank."
Assert-Equal -Actual $Context.Order.merchantId -Expected $Context.Merchant.id -Message "Order merchant id mismatch."
Assert-Equal -Actual $Context.Order.status -Expected "CREATED" -Message "New order status mismatch."
Assert-Equal -Actual @($Context.Order.items).Count -Expected 1 -Message "Order item count mismatch."
Assert-Equal -Actual $Context.Order.items[0].quantity -Expected 12 -Message "Order item quantity mismatch."

Write-Host "10. Allocating order"
$Context.AllocatedOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/$($Context.Order.id)/allocate"
Assert-Equal -Actual $Context.AllocatedOrder.id -Expected $Context.Order.id -Message "Allocated order id mismatch."
Assert-Equal -Actual $Context.AllocatedOrder.status -Expected "ALLOCATED" -Message "Allocated order status mismatch."
Assert-Equal -Actual @($Context.AllocatedOrder.allocations).Count -Expected 1 -Message "Allocation count mismatch."
Assert-Equal -Actual $Context.AllocatedOrder.allocations[0].warehouseId -Expected $Context.Warehouse.id -Message "Allocated warehouse mismatch."
Assert-Equal -Actual $Context.AllocatedOrder.allocations[0].status -Expected "PENDING" -Message "Allocation status mismatch."

Write-Host "11. Reading reserved warehouse inventory"
$reservedInventory = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/warehouses/$($Context.Warehouse.id)"
$Context.ReservedRows = @($reservedInventory | Where-Object { $_.inventoryItemId -eq $Context.Item.id })
Assert-Equal -Actual $Context.ReservedRows.Count -Expected 1 -Message "Reserved warehouse inventory row count mismatch."
$expectedQuantity = $Context.OperationalStockQuantity
Assert-Equal -Actual $Context.ReservedRows[0].quantity -Expected $expectedQuantity -Message "Reserved inventory quantity mismatch."
Assert-Equal -Actual $Context.ReservedRows[0].reservedQuantity -Expected 12 -Message "Reserved inventory reserved quantity mismatch."
Assert-Equal -Actual $Context.ReservedRows[0].availableQuantity -Expected ($expectedQuantity - 12) -Message "Reserved inventory available quantity mismatch."

Write-Host "12. Reading reservation audit logs"
$reservationAuditLogs = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/items/$($Context.Item.id)/audit-logs"
$Context.ReservationAuditRows = @($reservationAuditLogs)
Assert-Equal -Actual ($Context.ReservationAuditRows.Count -ge 2) -Expected $true -Message "Expected stock add and stock reserve audit rows."
Assert-Equal -Actual $Context.ReservationAuditRows[0].action -Expected "STOCK_RESERVED" -Message "Latest audit action after allocation mismatch."
Assert-Equal -Actual $Context.ReservationAuditRows[0].beforeReservedQuantity -Expected 0 -Message "Reservation audit before reserved mismatch."
Assert-Equal -Actual $Context.ReservationAuditRows[0].afterReservedQuantity -Expected 12 -Message "Reservation audit after reserved mismatch."
