param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "13. Cancelling allocated order"
$Context.CancelledOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/$($Context.Order.id)/cancel"
Assert-Equal -Actual $Context.CancelledOrder.id -Expected $Context.Order.id -Message "Cancelled order id mismatch."
Assert-Equal -Actual $Context.CancelledOrder.status -Expected "CANCELLED" -Message "Cancelled order status mismatch."
Assert-Equal -Actual @($Context.CancelledOrder.allocations).Count -Expected 1 -Message "Cancelled order allocation count mismatch."
Assert-Equal -Actual $Context.CancelledOrder.allocations[0].status -Expected "CANCELLED" -Message "Cancelled allocation status mismatch."

Write-Host "14. Verifying reserved stock was released"
$releasedInventory = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/warehouses/$($Context.Warehouse.id)"
$Context.ReleasedRows = @($releasedInventory | Where-Object { $_.inventoryItemId -eq $Context.Item.id })
Assert-Equal -Actual $Context.ReleasedRows.Count -Expected 1 -Message "Released inventory row count mismatch."
$expectedQuantity = $Context.OperationalStockQuantity
Assert-Equal -Actual $Context.ReleasedRows[0].quantity -Expected $expectedQuantity -Message "Released inventory quantity mismatch."
Assert-Equal -Actual $Context.ReleasedRows[0].reservedQuantity -Expected 0 -Message "Released inventory reserved quantity mismatch."
Assert-Equal -Actual $Context.ReleasedRows[0].availableQuantity -Expected $expectedQuantity -Message "Released inventory available quantity mismatch."

Write-Host "15. Verifying release audit log"
$releaseAuditLogs = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/items/$($Context.Item.id)/audit-logs"
$Context.ReleaseAuditRows = @($releaseAuditLogs)
Assert-Equal -Actual ($Context.ReleaseAuditRows.Count -ge 3) -Expected $true -Message "Expected stock add, reserve, and release audit rows."
Assert-Equal -Actual $Context.ReleaseAuditRows[0].action -Expected "STOCK_RELEASED" -Message "Latest audit action after cancellation mismatch."
Assert-Equal -Actual $Context.ReleaseAuditRows[0].beforeReservedQuantity -Expected 12 -Message "Release audit before reserved mismatch."
Assert-Equal -Actual $Context.ReleaseAuditRows[0].afterReservedQuantity -Expected 0 -Message "Release audit after reserved mismatch."
