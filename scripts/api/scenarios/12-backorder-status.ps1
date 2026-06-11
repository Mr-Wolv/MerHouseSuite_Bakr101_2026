param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "30. Creating an unstocked item for explicit backorder status checks"
$Context.BackorderOnlyItem = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/items" -Body @{
    merchantId = $Context.Merchant.id
    sku = "SMOKE-BACKORDER-$($Context.Suffix)"
    name = "Smoke Backorder Only Item"
    attributes = @{
        testRun = $Context.Suffix
        stockProfile = "unstocked"
    }
}
Assert-NotBlank -Value $Context.BackorderOnlyItem.id -Message "Backorder-only item id was blank."

Write-Host "31. Fulfilling an open backorder"
$fulfillableOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "Fulfilled Backorder Smoke Customer, Cairo"
    items = @(@{ inventoryItemId = $Context.BackorderOnlyItem.id; quantity = 6 })
}
$fulfillableOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/$($fulfillableOrder.id)/allocate"
Assert-Equal -Actual $fulfillableOrder.status -Expected "BACKORDERED" -Message "Fulfillable backorder order status mismatch."
Assert-Equal -Actual @($fulfillableOrder.backorders).Count -Expected 1 -Message "Fulfillable backorder count mismatch."
$fulfilledBackorderId = $fulfillableOrder.backorders[0].id
$Context.FulfilledBackorderOrder = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/orders/$($fulfillableOrder.id)/backorders/$fulfilledBackorderId/status" -Body @{
    nextStatus = "FULFILLED"
}
Assert-Equal -Actual $Context.FulfilledBackorderOrder.backorders[0].status -Expected "FULFILLED" -Message "Fulfilled backorder status mismatch."
Assert-Equal -Actual $Context.FulfilledBackorderOrder.status -Expected "BACKORDERED" -Message "Fulfilled all-backorder order status mismatch."

Write-Host "32. Cancelling an open backorder"
$cancellableOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "Cancelled Backorder Smoke Customer, Cairo"
    items = @(@{ inventoryItemId = $Context.BackorderOnlyItem.id; quantity = 7 })
}
$cancellableOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/$($cancellableOrder.id)/allocate"
Assert-Equal -Actual $cancellableOrder.status -Expected "BACKORDERED" -Message "Cancellable backorder order status mismatch."
$cancelledBackorderId = $cancellableOrder.backorders[0].id
$Context.CancelledBackorderOrder = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/orders/$($cancellableOrder.id)/backorders/$cancelledBackorderId/status" -Body @{
    nextStatus = "CANCELLED"
}
Assert-Equal -Actual $Context.CancelledBackorderOrder.backorders[0].status -Expected "CANCELLED" -Message "Cancelled backorder status mismatch."
Assert-Equal -Actual $Context.CancelledBackorderOrder.status -Expected "BACKORDERED" -Message "Cancelled backorder order status mismatch."
