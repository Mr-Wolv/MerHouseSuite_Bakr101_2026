param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "19. Advancing one allocation to PICKING"
$operatorAllocations = Invoke-Json -Context $Context -Method Get -Path "/api/v1/fulfillment-allocations?warehouseId=$($Context.Warehouse.id)" -Headers $Context.OperatorHeaders
$Context.OperatorAllocationRows = @($operatorAllocations)
Assert-Equal -Actual ($Context.OperatorAllocationRows.Count -gt 0) -Expected $true -Message "Operator allocation queue was empty."
$Context.ShipmentCandidate = $Context.OperatorAllocationRows | Where-Object { $_.status -eq "PENDING" -and $_.merchantId -eq $Context.Merchant.id } | Select-Object -First 1
Assert-NotBlank -Value $Context.ShipmentCandidate.id -Message "Operator allocation queue did not include a pending shipment candidate."
Write-Host "19a. Updating V10 workload priority, scan code, and pick-sheet evidence"
$Context.WorkloadAllocation = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/fulfillment-allocations/$($Context.ShipmentCandidate.id)/workload" -Headers $Context.OperatorHeaders -Body @{
    priority = 1
    scanCode = "SCAN-$($Context.Suffix)"
    markPickSheetPrinted = $true
}
Assert-Equal -Actual $Context.WorkloadAllocation.priority -Expected 1 -Message "Workload priority mismatch."
Assert-Equal -Actual $Context.WorkloadAllocation.scanCode -Expected "SCAN-$($Context.Suffix)" -Message "Workload scan code mismatch."
Assert-NotBlank -Value $Context.WorkloadAllocation.pickSheetPrintedAt -Message "Workload pick sheet timestamp was blank."
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/fulfillment-allocations/$($Context.ShipmentCandidate.id)/status" -Headers $Context.OperatorHeaders -ExpectedStatus 409 -Body @{
    nextStatus = "PACKED"
}
$Context.PickingAllocation = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/fulfillment-allocations/$($Context.ShipmentCandidate.id)/status" -Headers $Context.OperatorHeaders -Body @{
    nextStatus = "PICKING"
}
Assert-Equal -Actual $Context.PickingAllocation.id -Expected $Context.ShipmentCandidate.id -Message "Picking allocation id mismatch."
Assert-Equal -Actual $Context.PickingAllocation.status -Expected "PICKING" -Message "Picking allocation status mismatch."

Write-Host "20. Advancing allocation to PACKED"
$Context.PackedAllocation = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/fulfillment-allocations/$($Context.ShipmentCandidate.id)/status" -Headers $Context.OperatorHeaders -Body @{
    nextStatus = "PACKED"
}
Assert-Equal -Actual $Context.PackedAllocation.id -Expected $Context.ShipmentCandidate.id -Message "Packed allocation id mismatch."
Assert-Equal -Actual $Context.PackedAllocation.status -Expected "PACKED" -Message "Packed allocation status mismatch."

Write-Host "21. Creating shipment from packed allocation"
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/shipments" -Headers $Context.OperatorHeaders -ExpectedStatus 409 -Body @{
    allocationId = $Context.ShipmentCandidate.id
    carrier = "Unsupported Carrier"
    trackingNumber = "BAD-$($Context.Suffix)"
    packageCount = 1
    packageWeightKg = 1.0
    packageLengthCm = 20
    packageWidthCm = 15
    packageHeightCm = 10
    packingNote = "This deliberately violates the V10 supported-carrier policy."
    metadata = @{ testRun = $Context.Suffix }
}
$Context.Shipment = Invoke-Json -Context $Context -Method Post -Path "/api/v1/shipments" -Headers $Context.OperatorHeaders -Body @{
    allocationId = $Context.ShipmentCandidate.id
    carrier = "FedEx"
    trackingNumber = "TRACK-$($Context.Suffix)"
    packageCount = 2
    packageWeightKg = 4.5
    packageLengthCm = 40
    packageWidthCm = 30
    packageHeightCm = 20
    packingNote = "Smoke shipment packed with V10 package evidence."
    metadata = @{
        service = "express"
        testRun = $Context.Suffix
    }
}
Assert-NotBlank -Value $Context.Shipment.id -Message "Shipment id was blank."
Assert-Equal -Actual $Context.Shipment.allocationId -Expected $Context.ShipmentCandidate.id -Message "Shipment allocation id mismatch."
Assert-Equal -Actual $Context.Shipment.status -Expected "IN_TRANSIT" -Message "Shipment status mismatch."
Assert-Equal -Actual $Context.Shipment.packageCount -Expected 2 -Message "Shipment package count mismatch."
Assert-Equal -Actual $Context.Shipment.packageLengthCm -Expected 40 -Message "Shipment package length mismatch."
Assert-Equal -Actual @($Context.Shipment.packages).Count -Expected 2 -Message "Shipment package records count mismatch."
$Context.ShipmentPackages = Invoke-Json -Context $Context -Method Get -Path "/api/v1/shipments/$($Context.Shipment.id)/packages" -Headers $Context.OperatorHeaders
Assert-Equal -Actual @($Context.ShipmentPackages).Count -Expected 2 -Message "Shipment package history endpoint count mismatch."
Assert-Equal -Actual $Context.ShipmentPackages[0].labelCode -Expected "TRACK-$($Context.Suffix)-PKG-1" -Message "Shipment package label mismatch."
Assert-Equal -Actual @($Context.ShipmentPackages[0].events).Count -Expected 2 -Message "Shipment package event count mismatch."

Write-Host "22. Verifying order moved to SHIPPED"
$Context.ShippedOrder = Invoke-Json -Context $Context -Method Get -Path "/api/v1/orders/$($Context.ShipmentCandidate.orderId)"
Assert-Equal -Actual $Context.ShippedOrder.status -Expected "SHIPPED" -Message "Shipped order status mismatch."
Assert-Equal -Actual $Context.ShippedOrder.allocations[0].status -Expected "SHIPPED" -Message "Shipped allocation status mismatch."

Write-Host "23. Marking shipment delivered"
$Context.DeliveredShipment = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/shipments/$($Context.Shipment.id)/delivered" -Headers $Context.OperatorHeaders
Assert-Equal -Actual $Context.DeliveredShipment.id -Expected $Context.Shipment.id -Message "Delivered shipment id mismatch."
Assert-Equal -Actual $Context.DeliveredShipment.status -Expected "DELIVERED" -Message "Delivered shipment status mismatch."

Write-Host "24. Verifying order moved to DELIVERED"
$Context.DeliveredOrder = Invoke-Json -Context $Context -Method Get -Path "/api/v1/orders/$($Context.ShipmentCandidate.orderId)"
Assert-Equal -Actual $Context.DeliveredOrder.status -Expected "DELIVERED" -Message "Delivered order status mismatch."
Assert-Equal -Actual $Context.DeliveredOrder.allocations[0].status -Expected "SHIPPED" -Message "Delivered order allocation status mismatch."

Write-Host "25. Marking another shipment failed"
$failedAllocation = $Context.OperatorAllocationRows |
    Where-Object { $_.status -eq "PENDING" -and $_.merchantId -eq $Context.Merchant.id -and $_.id -ne $Context.ShipmentCandidate.id } |
    Select-Object -First 1
Assert-NotBlank -Value $failedAllocation.id -Message "Operator allocation queue did not include a failed-shipment candidate."
$failedAllocationId = $failedAllocation.id
Invoke-Json -Context $Context -Method Patch -Path "/api/v1/fulfillment-allocations/$failedAllocationId/status" -Headers $Context.OperatorHeaders -Body @{
    nextStatus = "PICKING"
} | Out-Null
Invoke-Json -Context $Context -Method Patch -Path "/api/v1/fulfillment-allocations/$failedAllocationId/status" -Headers $Context.OperatorHeaders -Body @{
    nextStatus = "PACKED"
} | Out-Null
$Context.FailedShipment = Invoke-Json -Context $Context -Method Post -Path "/api/v1/shipments" -Headers $Context.OperatorHeaders -Body @{
    allocationId = $failedAllocationId
    carrier = "DHL"
    trackingNumber = "FAIL-$($Context.Suffix)"
    packageCount = 1
    packageWeightKg = 2.25
    packageLengthCm = 35
    packageWidthCm = 25
    packageHeightCm = 15
    packingNote = "Failed shipment packed with V10 package evidence."
    metadata = @{ service = "standard"; testRun = $Context.Suffix }
}
$Context.FailedShipment = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/shipments/$($Context.FailedShipment.id)/status" -Headers $Context.OperatorHeaders -Body @{
    nextStatus = "FAILED"
}
Assert-Equal -Actual $Context.FailedShipment.status -Expected "FAILED" -Message "Failed shipment status mismatch."
$Context.FailedShipmentOrder = Invoke-Json -Context $Context -Method Get -Path "/api/v1/orders/$($failedAllocation.orderId)"
Assert-Equal -Actual $Context.FailedShipmentOrder.status -Expected "SHIPPED" -Message "Failed shipment order should remain shipped."

Write-Host "25a. Reporting and resolving a merchant-visible fulfillment exception"
$Context.FulfillmentException = Invoke-Json -Context $Context -Method Post -Path "/api/v1/fulfillment-exceptions" -Headers $Context.OperatorHeaders -Body @{
    allocationId = $failedAllocationId
    shipmentId = $Context.FailedShipment.id
    reasonCode = "FAILED_DELIVERY"
    description = "Smoke exception: failed delivery requires merchant-visible resolution."
}
Assert-Equal -Actual $Context.FulfillmentException.status -Expected "OPEN" -Message "Fulfillment exception initial status mismatch."
Assert-Equal -Actual $Context.FulfillmentException.reasonCode -Expected "FAILED_DELIVERY" -Message "Fulfillment exception reason mismatch."
$merchantExceptions = Invoke-Json -Context $Context -Method Get -Path "/api/v1/fulfillment-exceptions" -Headers $Context.MerchantHeaders
Assert-Equal -Actual (@($merchantExceptions).Count -gt 0) -Expected $true -Message "Merchant could not see warehouse-reported exception."
$Context.FulfillmentException = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/fulfillment-exceptions/$($Context.FulfillmentException.id)/resolve" -Headers $Context.MerchantHeaders -Body @{
    resolutionNote = "Merchant accepted resolution and customer notification is ready."
}
Assert-Equal -Actual $Context.FulfillmentException.status -Expected "RESOLVED" -Message "Fulfillment exception resolution status mismatch."
Assert-NotBlank -Value $Context.FulfillmentException.resolvedAt -Message "Fulfillment exception resolution timestamp was blank."

Write-Host "26. Marking another shipment returned"
$returnedAllocation = $Context.OperatorAllocationRows |
    Where-Object { $_.status -eq "PENDING" -and $_.merchantId -eq $Context.Merchant.id -and $_.id -ne $Context.ShipmentCandidate.id -and $_.id -ne $failedAllocationId } |
    Select-Object -First 1
Assert-NotBlank -Value $returnedAllocation.id -Message "Operator allocation queue did not include a returned-shipment candidate."
$returnedAllocationId = $returnedAllocation.id
Invoke-Json -Context $Context -Method Patch -Path "/api/v1/fulfillment-allocations/$returnedAllocationId/status" -Headers $Context.OperatorHeaders -Body @{
    nextStatus = "PICKING"
} | Out-Null
Invoke-Json -Context $Context -Method Patch -Path "/api/v1/fulfillment-allocations/$returnedAllocationId/status" -Headers $Context.OperatorHeaders -Body @{
    nextStatus = "PACKED"
} | Out-Null
$Context.ReturnedShipment = Invoke-Json -Context $Context -Method Post -Path "/api/v1/shipments" -Headers $Context.OperatorHeaders -Body @{
    allocationId = $returnedAllocationId
    carrier = "UPS"
    trackingNumber = "RETURN-$($Context.Suffix)"
    packageCount = 1
    packageWeightKg = 2.25
    packageLengthCm = 35
    packageWidthCm = 25
    packageHeightCm = 15
    packingNote = "Returned shipment packed with V10 package evidence."
    metadata = @{ service = "standard"; testRun = $Context.Suffix }
}
$Context.ReturnedShipment = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/shipments/$($Context.ReturnedShipment.id)/status" -Headers $Context.OperatorHeaders -Body @{
    nextStatus = "RETURNED"
}
Assert-Equal -Actual $Context.ReturnedShipment.status -Expected "RETURNED" -Message "Returned shipment status mismatch."
$Context.ReturnedShipmentOrder = Invoke-Json -Context $Context -Method Get -Path "/api/v1/orders/$($returnedAllocation.orderId)"
Assert-Equal -Actual $Context.ReturnedShipmentOrder.status -Expected "SHIPPED" -Message "Returned shipment order should remain shipped."

Write-Host "27. Verifying V10 dashboard summaries"
$Context.MerchantDashboard = Invoke-Json -Context $Context -Method Get -Path "/api/v1/dashboard/merchant" -Headers $Context.MerchantHeaders
$Context.WarehouseDashboard = Invoke-Json -Context $Context -Method Get -Path "/api/v1/dashboard/warehouse" -Headers $Context.OperatorHeaders
Assert-Equal -Actual ($Context.MerchantDashboard.orders -ge 1) -Expected $true -Message "Merchant dashboard did not include orders."
Assert-Equal -Actual ($Context.WarehouseDashboard.openExceptions -ge 0) -Expected $true -Message "Warehouse dashboard open exception count was invalid."
