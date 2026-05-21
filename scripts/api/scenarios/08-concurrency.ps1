param([Parameter(Mandatory = $true)] [hashtable] $Context)

$expectedQuantity = $Context.OperationalStockQuantity
$concurrentOrderQuantity = 10
$expectedAllocatedOrders = [Math]::Ceiling($expectedQuantity / $concurrentOrderQuantity)
$expectedReservedQuantity = $expectedQuantity
$expectedAvailableQuantity = 0
$expectedBackorderedOnlyOrders = 10 - $expectedAllocatedOrders

Write-Host "16. Creating 10 concurrent allocation orders"
$Context.ConcurrentOrders = for ($i = 1; $i -le 10; $i++) {
    Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Body @{
        merchantId = $Context.Merchant.id
        customerAddress = "Concurrent Customer $i, Cairo"
        items = @(@{ inventoryItemId = $Context.Item.id; quantity = $concurrentOrderQuantity })
    }
}
Assert-Equal -Actual @($Context.ConcurrentOrders).Count -Expected 10 -Message "Concurrent order creation count mismatch."

Write-Host "17. Allocating 10 orders concurrently against $expectedQuantity available units"
$jobs = foreach ($concurrentOrder in $Context.ConcurrentOrders) {
    Start-Job -ScriptBlock {
        param($JobBaseUrl, $OrderId, $Authorization)

        try {
            $response = Invoke-RestMethod `
                -Method Post `
                -Uri "$JobBaseUrl/api/v1/orders/$OrderId/allocate" `
                -Headers @{ Authorization = $Authorization }
            $allocations = @($response.allocations)
            $backorders = @($response.backorders)
            [pscustomobject]@{
                success = $true
                allocated = $allocations.Count -gt 0
                backordered = $backorders.Count -gt 0
                statusCode = 200
                orderId = $OrderId
                orderStatus = $response.status
                allocationId = if ($allocations.Count -gt 0) { $allocations[0].id } else { "" }
                allocationStatus = if ($allocations.Count -gt 0) { $allocations[0].status } else { "" }
                backorderQuantity = if ($backorders.Count -gt 0) { $backorders[0].quantity } else { 0 }
                message = ""
            }
        } catch {
            $statusCode = 0
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }

            [pscustomobject]@{
                success = $false
                allocated = $false
                backordered = $false
                statusCode = $statusCode
                orderId = $OrderId
                orderStatus = ""
                allocationId = ""
                allocationStatus = ""
                backorderQuantity = 0
                message = $_.Exception.Message
            }
        }
    } -ArgumentList $Context.BaseUrl, $concurrentOrder.id, $Context.DefaultHeaders.Authorization
}

$Context.ConcurrencyResults = @($jobs | Wait-Job | Receive-Job)
$jobs | Remove-Job
$Context.SuccessfulAllocations = @($Context.ConcurrencyResults | Where-Object { $_.allocated })
$Context.BackorderedAllocations = @($Context.ConcurrencyResults | Where-Object { $_.backordered -and -not $_.allocated })
$Context.FailedAllocations = @($Context.ConcurrencyResults | Where-Object { -not $_.success })
Assert-Equal -Actual $Context.ConcurrencyResults.Count -Expected 10 -Message "Concurrent allocation response count mismatch."
Assert-Equal -Actual $Context.SuccessfulAllocations.Count -Expected $expectedAllocatedOrders -Message "Concurrent allocated order count mismatch."
Assert-Equal -Actual $Context.BackorderedAllocations.Count -Expected $expectedBackorderedOnlyOrders -Message "Concurrent backordered order count mismatch."
Assert-Equal -Actual $Context.FailedAllocations.Count -Expected 0 -Message "Concurrent HTTP failure count mismatch."

Write-Host "18. Verifying concurrent inventory invariant"
$concurrentInventory = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/warehouses/$($Context.Warehouse.id)"
$Context.ConcurrentRows = @($concurrentInventory | Where-Object { $_.inventoryItemId -eq $Context.Item.id })
Assert-Equal -Actual $Context.ConcurrentRows.Count -Expected 1 -Message "Concurrent inventory row count mismatch."
Assert-Equal -Actual $Context.ConcurrentRows[0].quantity -Expected $expectedQuantity -Message "Concurrent inventory quantity mismatch."
Assert-Equal -Actual $Context.ConcurrentRows[0].reservedQuantity -Expected $expectedReservedQuantity -Message "Concurrent inventory reserved quantity mismatch."
Assert-Equal -Actual $Context.ConcurrentRows[0].availableQuantity -Expected $expectedAvailableQuantity -Message "Concurrent inventory available quantity mismatch."
