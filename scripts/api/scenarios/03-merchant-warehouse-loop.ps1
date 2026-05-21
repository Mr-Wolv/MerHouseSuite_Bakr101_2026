param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "8b. Creating merchant-warehouse relationship"
$Context.MerchantWarehouseRelationship = Invoke-Json -Context $Context -Method Post -Path "/api/v1/merchant-warehouse/relationships" -Body @{
    merchantId = $Context.Merchant.id
    warehouseProviderId = $Context.WarehouseProvider.id
    serviceNotes = "Smoke V8 service relationship"
}
Assert-NotBlank -Value $Context.MerchantWarehouseRelationship.id -Message "Merchant-warehouse relationship id was blank."
Assert-Equal -Actual $Context.MerchantWarehouseRelationship.status -Expected "REQUESTED" -Message "Relationship initial status mismatch."

Write-Host "8c. Activating merchant-warehouse relationship"
$Context.MerchantWarehouseRelationship = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/relationships/$($Context.MerchantWarehouseRelationship.id)/activate"
Assert-Equal -Actual $Context.MerchantWarehouseRelationship.status -Expected "ACTIVE" -Message "Relationship active status mismatch."

Write-Host "8d. Verifying relationship list visibility"
$relationships = Invoke-Json -Context $Context -Method Get -Path "/api/v1/merchant-warehouse/relationships"
$Context.RelationshipRows = @($relationships)
Assert-Equal -Actual ($Context.RelationshipRows.Count -ge 1) -Expected $true -Message "Expected at least one relationship row."
Assert-Equal -Actual $Context.RelationshipRows[0].status -Expected "ACTIVE" -Message "Relationship list status mismatch."

Write-Host "8e. Creating item for inbound receiving proof"
$Context.InboundItem = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/items" -Body @{
    merchantId = $Context.Merchant.id
    sku = "SMOKE-INBOUND-$($Context.Suffix)"
    name = "Smoke Inbound Item"
    attributes = @{
        testRun = $Context.Suffix
        stockProfile = "inbound"
    }
}
Assert-NotBlank -Value $Context.InboundItem.id -Message "Inbound item id was blank."

Write-Host "8f. Submitting inbound stock request"
$Context.InboundStockRequest = Invoke-Json -Context $Context -Method Post -Path "/api/v1/merchant-warehouse/inbound-stock-requests" -Body @{
    relationshipId = $Context.MerchantWarehouseRelationship.id
    warehouseId = $Context.Warehouse.id
    inventoryItemId = $Context.InboundItem.id
    requestedQuantity = 6
    merchantReference = "SMOKE-ASN-$($Context.Suffix)"
    merchantNote = "Smoke inbound arrives today"
}
Assert-Equal -Actual $Context.InboundStockRequest.status -Expected "SUBMITTED" -Message "Inbound submitted status mismatch."
Assert-Equal -Actual $Context.InboundStockRequest.requestedQuantity -Expected 6 -Message "Inbound requested quantity mismatch."

Write-Host "8g. Proving inbound stock requires warehouse approval before receiving"
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($Context.InboundStockRequest.id)/receiving" -Headers $Context.OperatorHeaders -ExpectedStatus 409
$Context.InboundDraft = Invoke-Json -Context $Context -Method Post -Path "/api/v1/merchant-warehouse/inbound-stock-requests/drafts" -Headers $Context.MerchantHeaders -Body @{
    relationshipId = $Context.MerchantWarehouseRelationship.id
    warehouseId = $Context.Warehouse.id
    inventoryItemId = $Context.InboundItem.id
    requestedQuantity = 3
    merchantReference = "SMOKE-DRAFT-ASN-$($Context.Suffix)"
    merchantNote = "Draft prepared before warehouse approval"
}
Assert-Equal -Actual $Context.InboundDraft.status -Expected "DRAFT" -Message "Inbound draft status mismatch."
$draftAuthorizedStock = Invoke-Json -Context $Context -Method Get -Path "/api/v1/merchant-warehouse/authorized-stock" -Headers $Context.MerchantHeaders
$Context.DraftAuthorizedRows = @($draftAuthorizedStock | Where-Object { $_.inventoryItemId -eq $Context.InboundItem.id })
Assert-Equal -Actual $Context.DraftAuthorizedRows.Count -Expected 1 -Message "Submitted inbound stock should remain visible while draft exists."
Assert-Equal -Actual $Context.DraftAuthorizedRows[0].inboundQuantity -Expected 6 -Message "Draft inbound must not increase authorized inbound stock."
$Context.InboundDraft = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($Context.InboundDraft.id)/submit" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.InboundDraft.status -Expected "SUBMITTED" -Message "Submitted draft status mismatch."
$Context.InboundDraft = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($Context.InboundDraft.id)/cancel" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.InboundDraft.status -Expected "CANCELLED" -Message "Cancelled draft status mismatch."

Write-Host "8h. Approving inbound stock for receiving"
$Context.InboundStockRequest = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($Context.InboundStockRequest.id)/approve"
Assert-Equal -Actual $Context.InboundStockRequest.status -Expected "APPROVED" -Message "Inbound approved status mismatch."

Write-Host "8i. Marking inbound stock as receiving"
$Context.InboundStockRequest = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($Context.InboundStockRequest.id)/receiving"
Assert-Equal -Actual $Context.InboundStockRequest.status -Expected "RECEIVING" -Message "Inbound receiving status mismatch."

Write-Host "8j. Confirming received inbound stock"
$Context.InboundStockRequest = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($Context.InboundStockRequest.id)/receive" -Body @{
    receivedQuantity = 4
    damagedQuantity = 1
    receivingNote = "Four good units and one damaged unit"
}
Assert-Equal -Actual $Context.InboundStockRequest.status -Expected "RECEIVED" -Message "Inbound received status mismatch."
Assert-Equal -Actual $Context.InboundStockRequest.receivedQuantity -Expected 4 -Message "Inbound received quantity mismatch."
Assert-Equal -Actual $Context.InboundStockRequest.damagedQuantity -Expected 1 -Message "Inbound damaged quantity mismatch."
Assert-Equal -Actual $Context.InboundStockRequest.shortageQuantity -Expected 1 -Message "Inbound shortage quantity mismatch."

Write-Host "8k. Verifying confirmed inbound stock became warehouse inventory"
$inboundInventory = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/warehouses/$($Context.Warehouse.id)"
$Context.InboundInventoryRows = @($inboundInventory | Where-Object { $_.inventoryItemId -eq $Context.InboundItem.id })
Assert-Equal -Actual $Context.InboundInventoryRows.Count -Expected 1 -Message "Inbound inventory row count mismatch."
Assert-Equal -Actual $Context.InboundInventoryRows[0].quantity -Expected 4 -Message "Inbound inventory quantity mismatch."

Write-Host "8l. Verifying inbound receiving audit log"
$inboundAuditLogs = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/items/$($Context.InboundItem.id)/audit-logs"
$Context.InboundAuditRows = @($inboundAuditLogs)
Assert-Equal -Actual $Context.InboundAuditRows[0].action -Expected "STOCK_RECEIVED" -Message "Inbound audit action mismatch."

Write-Host "8m. Verifying merchant authorized stock visibility"
$authorizedStock = Invoke-Json -Context $Context -Method Get -Path "/api/v1/merchant-warehouse/authorized-stock" -Headers $Context.MerchantHeaders
$Context.AuthorizedStockRows = @($authorizedStock | Where-Object { $_.inventoryItemId -eq $Context.InboundItem.id })
Assert-Equal -Actual $Context.AuthorizedStockRows.Count -Expected 1 -Message "Authorized stock row count mismatch."
Assert-Equal -Actual $Context.AuthorizedStockRows[0].warehouseId -Expected $Context.Warehouse.id -Message "Authorized stock warehouse mismatch."
Assert-Equal -Actual $Context.AuthorizedStockRows[0].availableQuantity -Expected 4 -Message "Authorized stock available quantity mismatch."
Assert-Equal -Actual $Context.AuthorizedStockRows[0].inboundQuantity -Expected 0 -Message "Received inbound should not remain open inbound stock."

Write-Host "8n. Verifying V8 negative role and tenant boundaries"
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($Context.InboundStockRequest.id)/receive" -Headers $Context.MerchantHeaders -ExpectedStatus 403 -Body @{
    receivedQuantity = 1
    damagedQuantity = 0
    receivingNote = "Merchant cannot receive warehouse stock"
}
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/merchant-warehouse/authorized-stock?merchantId=$($Context.Merchant.id)" -Headers $Context.OperatorHeaders -ExpectedStatus 403

$Context.OtherMerchantUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.OtherMerchant.id
    email = "other-merchant-$($Context.Suffix)@merhouse.local"
    password = "other-merchant-password"
    role = "MERCHANT"
}
$otherMerchantLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.OtherMerchantUser.email
    password = "other-merchant-password"
}
$Context.OtherMerchantHeaders = @{ Authorization = "Bearer $($otherMerchantLogin.accessToken)" }
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/merchant-warehouse/authorized-stock?merchantId=$($Context.Merchant.id)" -Headers $Context.OtherMerchantHeaders -ExpectedStatus 403
$otherMerchantInbound = Invoke-Json -Context $Context -Method Get -Path "/api/v1/merchant-warehouse/inbound-stock-requests" -Headers $Context.OtherMerchantHeaders
$Context.OtherMerchantInboundRows = @($otherMerchantInbound | Where-Object { $_.id -eq $Context.InboundStockRequest.id })
Assert-Equal -Actual $Context.OtherMerchantInboundRows.Count -Expected 0 -Message "Wrong merchant could inspect another merchant inbound request."

$Context.WrongWarehouseProvider = Invoke-Json -Context $Context -Method Post -Path "/api/v1/tenants" -Body @{
    name = "Wrong Warehouse Provider $($Context.Suffix)"
    type = "WAREHOUSE_PROVIDER"
}
$Context.WrongWarehouse = Invoke-Json -Context $Context -Method Post -Path "/api/v1/warehouses" -Body @{
    tenantId = $Context.WrongWarehouseProvider.id
    name = "Wrong Provider DC $($Context.Suffix)"
    address = "Sixth of October, Giza"
    latitude = 29.9692
    longitude = 30.9268
    capacity = 2500
}
$Context.WrongOperatorUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.WrongWarehouseProvider.id
    email = "wrong-operator-$($Context.Suffix)@merhouse.local"
    password = "wrong-operator-password"
    role = "WAREHOUSE_OPERATOR"
}
$wrongOperatorLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.WrongOperatorUser.email
    password = "wrong-operator-password"
}
$Context.WrongOperatorHeaders = @{ Authorization = "Bearer $($wrongOperatorLogin.accessToken)" }

Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($Context.InboundStockRequest.id)/receive" -Headers $Context.WrongOperatorHeaders -ExpectedStatus 403 -Body @{
    receivedQuantity = 1
    damagedQuantity = 0
    receivingNote = "Wrong provider cannot receive this inbound request"
}
$wrongProviderInbound = Invoke-Json -Context $Context -Method Get -Path "/api/v1/merchant-warehouse/inbound-stock-requests" -Headers $Context.WrongOperatorHeaders
$Context.WrongProviderInboundRows = @($wrongProviderInbound | Where-Object { $_.id -eq $Context.InboundStockRequest.id })
Assert-Equal -Actual $Context.WrongProviderInboundRows.Count -Expected 0 -Message "Wrong provider could inspect another provider inbound request."

Write-Host "8o. Verifying unauthorized warehouse stock cannot allocate merchant demand"
$Context.UnauthorizedStockItem = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/items" -Body @{
    merchantId = $Context.Merchant.id
    sku = "UNAUTHORIZED-STOCK-$($Context.Suffix)"
    name = "Unauthorized Warehouse Stock Item"
    attributes = @{
        testRun = $Context.Suffix
        policyExpectation = "backorder-without-relationship"
    }
}
$Context.UnauthorizedStock = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/stock" -Body @{
    warehouseId = $Context.WrongWarehouse.id
    inventoryItemId = $Context.UnauthorizedStockItem.id
    quantity = 12
}
$Context.UnauthorizedStockOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Headers $Context.MerchantHeaders -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "Unauthorized Stock Smoke Customer, Cairo"
    items = @(@{ inventoryItemId = $Context.UnauthorizedStockItem.id; quantity = 2 })
}
$Context.UnauthorizedStockOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/$($Context.UnauthorizedStockOrder.id)/allocate" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.UnauthorizedStockOrder.status -Expected "BACKORDERED" -Message "Unauthorized warehouse stock should not allocate."
Assert-Equal -Actual @($Context.UnauthorizedStockOrder.allocations).Count -Expected 0 -Message "Unauthorized warehouse stock created an allocation."
Assert-Equal -Actual @($Context.UnauthorizedStockOrder.backorders).Count -Expected 1 -Message "Unauthorized warehouse stock did not create a backorder."
