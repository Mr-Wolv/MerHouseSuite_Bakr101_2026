param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "9. Creating V5 merchant and warehouse operator users"
$Context.MerchantUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.Merchant.id
    email = "merchant-$($Context.Suffix)@merhouse.local"
    password = "merchant-password"
    role = "MERCHANT"
}
Assert-Equal -Actual $Context.MerchantUser.role -Expected "MERCHANT" -Message "Merchant user role mismatch."

$Context.OperatorUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.WarehouseProvider.id
    email = "operator-$($Context.Suffix)@merhouse.local"
    password = "operator-password"
    role = "WAREHOUSE_OPERATOR"
}
Assert-Equal -Actual $Context.OperatorUser.role -Expected "WAREHOUSE_OPERATOR" -Message "Operator user role mismatch."
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/admin/users" -Headers $Context.AdminHeaders -ExpectedStatus 409 -Body @{
    tenantId = $Context.Merchant.id
    email = "bad-operator-$($Context.Suffix)@merhouse.local"
    password = "bad-operator-password"
    role = "WAREHOUSE_OPERATOR"
}
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/admin/users" -Headers $Context.AdminHeaders -ExpectedStatus 409 -Body @{
    tenantId = $Context.WarehouseProvider.id
    email = "bad-merchant-$($Context.Suffix)@merhouse.local"
    password = "bad-merchant-password"
    role = "MERCHANT"
}

Write-Host "10. Verifying login and current-user endpoint"
$Context.MerchantLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.MerchantUser.email
    password = "merchant-password"
}
$Context.OperatorLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.OperatorUser.email
    password = "operator-password"
}
$Context.MerchantHeaders = @{ Authorization = "Bearer $($Context.MerchantLogin.accessToken)" }
$Context.OperatorHeaders = @{ Authorization = "Bearer $($Context.OperatorLogin.accessToken)" }

$merchantMe = Invoke-Json -Context $Context -Method Get -Path "/api/v1/auth/me" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $merchantMe.user.id -Expected $Context.MerchantUser.id -Message "Merchant /me user mismatch."

Write-Host "11. Verifying anonymous and wrong-role requests are blocked"
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/tenants" -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/orders" -Headers $Context.OperatorHeaders -ExpectedStatus 403 -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "Blocked Operator, Cairo"
    items = @(@{ inventoryItemId = $Context.Item.id; quantity = 1 })
}

Write-Host "12. Verifying merchant tenant ownership"
$Context.OtherMerchant = Invoke-Json -Context $Context -Method Post -Path "/api/v1/tenants" -Body @{
    name = "Blocked Merchant $($Context.Suffix)"
    type = "MERCHANT"
}
$Context.OtherMerchantItem = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/items" -Body @{
    merchantId = $Context.OtherMerchant.id
    sku = "OTHER-MERCHANT-SKU-$($Context.Suffix)"
    name = "Other Merchant Item"
    attributes = @{ testRun = $Context.Suffix; phase = "v5" }
}
$Context.V5MerchantItem = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/items" -Headers $Context.MerchantHeaders -Body @{
    merchantId = $Context.Merchant.id
    sku = "V5-MERCHANT-SKU-$($Context.Suffix)"
    name = "V5 Merchant-Owned Item"
    attributes = @{ testRun = $Context.Suffix; phase = "v5" }
}
Assert-Equal -Actual $Context.V5MerchantItem.merchantId -Expected $Context.Merchant.id -Message "Merchant-owned item tenant mismatch."

Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/inventory/items" -Headers $Context.MerchantHeaders -ExpectedStatus 403 -Body @{
    merchantId = $Context.WarehouseProvider.id
    sku = "V5-BLOCKED-SKU-$($Context.Suffix)"
    name = "Blocked Cross-Tenant Item"
    attributes = @{ testRun = $Context.Suffix; phase = "v5" }
}
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/inventory/items?merchantId=$($Context.OtherMerchant.id)" -Headers $Context.MerchantHeaders -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/orders?merchantId=$($Context.OtherMerchant.id)" -Headers $Context.MerchantHeaders -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/orders" -Headers $Context.MerchantHeaders -ExpectedStatus 403 -Body @{
    merchantId = $Context.OtherMerchant.id
    customerAddress = "Blocked Other Merchant, Cairo"
    items = @(@{ inventoryItemId = $Context.OtherMerchantItem.id; quantity = 1 })
}
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/orders" -Headers $Context.MerchantHeaders -ExpectedStatus 409 -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "Blocked Other Merchant Item, Cairo"
    items = @(@{ inventoryItemId = $Context.OtherMerchantItem.id; quantity = 1 })
}

Write-Host "13. Verifying operator fulfillment access"
$operatorInventory = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/warehouses/$($Context.Warehouse.id)" -Headers $Context.OperatorHeaders
Assert-Equal -Actual @($operatorInventory).Count -Expected 1 -Message "Operator warehouse inventory visibility mismatch."

Write-Host "14. Verifying merchant console operations"
$Context.MerchantConsoleItem = Invoke-Json -Context $Context -Method Post -Path "/api/v1/inventory/items" -Headers $Context.MerchantHeaders -Body @{
    merchantId = $Context.Merchant.id
    sku = "V7-MERCHANT-SKU-$($Context.Suffix)"
    name = "V7 Merchant Console Item"
    attributes = @{ testRun = $Context.Suffix; phase = "v7.3" }
}
Assert-Equal -Actual $Context.MerchantConsoleItem.merchantId -Expected $Context.Merchant.id -Message "Merchant console item tenant mismatch."

$Context.MerchantConsoleOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders" -Headers $Context.MerchantHeaders -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "V7 Merchant Customer, Cairo"
    items = @(@{ inventoryItemId = $Context.MerchantConsoleItem.id; quantity = 2 })
}
Assert-Equal -Actual $Context.MerchantConsoleOrder.status -Expected "CREATED" -Message "Merchant console order was not created."

$Context.MerchantConsoleOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/$($Context.MerchantConsoleOrder.id)/allocate" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.MerchantConsoleOrder.status -Expected "BACKORDERED" -Message "Merchant no-stock allocation should backorder."
Assert-Equal -Actual @($Context.MerchantConsoleOrder.backorders).Count -Expected 1 -Message "Merchant no-stock allocation did not create one backorder."

$Context.MerchantConsoleOrder = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/$($Context.MerchantConsoleOrder.id)/cancel" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.MerchantConsoleOrder.status -Expected "CANCELLED" -Message "Merchant console order was not cancelled."

Write-Host "15. Verifying admin user disable"
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/admin/users/$($Context.AdminLogin.user.id)/disable" -Headers $Context.AdminHeaders -ExpectedStatus 409 -Body @{
    reason = "Smoke self-disable safety check"
}
$Context.SecondaryAdminUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.WarehouseProvider.id
    email = "secondary-admin-$($Context.Suffix)@merhouse.local"
    password = "secondary-admin-password"
    role = "ADMIN"
}
$Context.SecondaryAdminLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.SecondaryAdminUser.email
    password = "secondary-admin-password"
}
$Context.SecondaryAdminHeaders = @{ Authorization = "Bearer $($Context.SecondaryAdminLogin.accessToken)" }
$Context.SecondaryAdminUser = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/admin/users/$($Context.SecondaryAdminUser.id)/disable" -Body @{
    reason = "Smoke disables secondary admin after owner safety proof"
}
Assert-Equal -Actual $Context.SecondaryAdminUser.enabled -Expected $false -Message "Secondary admin remained enabled."
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/admin/users/$($Context.AdminLogin.user.id)/disable" -Headers $Context.SecondaryAdminHeaders -ExpectedStatus 403 -Body @{
    reason = "Smoke lower-admin owner safety check"
}
$Context.DisabledUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.Merchant.id
    email = "disabled-$($Context.Suffix)@merhouse.local"
    password = "disabled-password"
    role = "MERCHANT"
}
$Context.DisabledUser = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/admin/users/$($Context.DisabledUser.id)/disable" -Body @{
    reason = "Smoke disables merchant user for login rejection proof"
}
Assert-Equal -Actual $Context.DisabledUser.enabled -Expected $false -Message "Disabled user remained enabled."
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/auth/login" -ExpectedStatus 401 -Body @{
    email = $Context.DisabledUser.email
    password = "disabled-password"
}
