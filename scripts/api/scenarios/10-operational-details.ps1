param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "27. Verifying V9 order detail timeline"
$Context.V9OrderDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/orders/$($Context.DeliveredOrder.id)" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.V9OrderDetail.order.id -Expected $Context.DeliveredOrder.id -Message "V9 merchant order detail id mismatch."
Assert-Equal -Actual ($Context.V9OrderDetail.timeline.Count -gt 0) -Expected $true -Message "V9 order timeline was empty."
$operatorOrderDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/orders/$($Context.DeliveredOrder.id)" -Headers $Context.OperatorHeaders
Assert-Equal -Actual $operatorOrderDetail.order.id -Expected $Context.DeliveredOrder.id -Message "V9 operator order detail id mismatch."
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/operational-details/orders/$($Context.DeliveredOrder.id)" -Headers $Context.OtherMerchantHeaders -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/operational-details/orders/$($Context.DeliveredOrder.id)" -Headers $Context.WrongOperatorHeaders -ExpectedStatus 403

Write-Host "28. Verifying V9 inbound detail timeline"
$Context.V9InboundDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/inbound-stock-requests/$($Context.InboundStockRequest.id)" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.V9InboundDetail.inboundStockRequest.id -Expected $Context.InboundStockRequest.id -Message "V9 inbound detail id mismatch."
Assert-Equal -Actual $Context.V9InboundDetail.inboundStockRequest.shortageQuantity -Expected 1 -Message "V9 inbound detail shortage mismatch."
Assert-Equal -Actual ($Context.V9InboundDetail.timeline.Count -gt 0) -Expected $true -Message "V9 inbound timeline was empty."
$operatorInboundDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/inbound-stock-requests/$($Context.InboundStockRequest.id)" -Headers $Context.OperatorHeaders
Assert-Equal -Actual $operatorInboundDetail.inboundStockRequest.id -Expected $Context.InboundStockRequest.id -Message "V9 operator inbound detail id mismatch."
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/operational-details/inbound-stock-requests/$($Context.InboundStockRequest.id)" -Headers $Context.OtherMerchantHeaders -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/operational-details/inbound-stock-requests/$($Context.InboundStockRequest.id)" -Headers $Context.WrongOperatorHeaders -ExpectedStatus 403

Write-Host "29. Verifying V9 shipment and allocation details"
$Context.V9ShipmentDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/shipments/$($Context.DeliveredShipment.id)" -Headers $Context.OperatorHeaders
Assert-Equal -Actual $Context.V9ShipmentDetail.shipment.id -Expected $Context.DeliveredShipment.id -Message "V9 shipment detail id mismatch."
Assert-Equal -Actual $Context.V9ShipmentDetail.order.id -Expected $Context.DeliveredOrder.id -Message "V9 shipment order link mismatch."
Assert-Equal -Actual ($Context.V9ShipmentDetail.timeline.Count -gt 0) -Expected $true -Message "V9 shipment timeline was empty."
$merchantShipmentDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/shipments/$($Context.DeliveredShipment.id)" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $merchantShipmentDetail.shipment.id -Expected $Context.DeliveredShipment.id -Message "V9 merchant shipment detail id mismatch."
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/operational-details/shipments/$($Context.DeliveredShipment.id)" -Headers $Context.WrongOperatorHeaders -ExpectedStatus 403

$Context.V9AllocationDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/fulfillment-allocations/$($Context.ShipmentCandidate.id)" -Headers $Context.OperatorHeaders
Assert-Equal -Actual $Context.V9AllocationDetail.allocation.id -Expected $Context.ShipmentCandidate.id -Message "V9 allocation detail id mismatch."
Assert-Equal -Actual $Context.V9AllocationDetail.order.id -Expected $Context.DeliveredOrder.id -Message "V9 allocation order link mismatch."
Assert-Equal -Actual ($Context.V9AllocationDetail.timeline.Count -gt 0) -Expected $true -Message "V9 allocation timeline was empty."

Write-Host "30. Verifying V9 relationship and inventory item details"
$Context.V9RelationshipDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/relationships/$($Context.MerchantWarehouseRelationship.id)" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.V9RelationshipDetail.relationship.id -Expected $Context.MerchantWarehouseRelationship.id -Message "V9 relationship detail id mismatch."
Assert-Equal -Actual ($Context.V9RelationshipDetail.inboundStockRequests.Count -ge 1) -Expected $true -Message "V9 relationship inbound rows were missing."
Assert-Equal -Actual ($Context.V9RelationshipDetail.timeline.Count -gt 0) -Expected $true -Message "V9 relationship timeline was empty."
$operatorRelationshipDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/relationships/$($Context.MerchantWarehouseRelationship.id)" -Headers $Context.OperatorHeaders
Assert-Equal -Actual $operatorRelationshipDetail.relationship.id -Expected $Context.MerchantWarehouseRelationship.id -Message "V9 operator relationship detail id mismatch."
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/operational-details/relationships/$($Context.MerchantWarehouseRelationship.id)" -Headers $Context.OtherMerchantHeaders -ExpectedStatus 403

$Context.V9InventoryDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/operational-details/inventory-items/$($Context.InboundItem.id)" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.V9InventoryDetail.item.id -Expected $Context.InboundItem.id -Message "V9 inventory detail id mismatch."
Assert-Equal -Actual ($Context.V9InventoryDetail.auditLogs.Count -ge 1) -Expected $true -Message "V9 inventory audit rows were missing."
Assert-Equal -Actual ($Context.V9InventoryDetail.timeline.Count -gt 0) -Expected $true -Message "V9 inventory timeline was empty."
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/operational-details/inventory-items/$($Context.InboundItem.id)" -Headers $Context.OtherMerchantHeaders -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/operational-details/inventory-items/$($Context.InboundItem.id)" -Headers $Context.OperatorHeaders -ExpectedStatus 403
