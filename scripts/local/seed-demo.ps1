param(
    [string]$BaseUrl = "",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [string]$Suffix = "",
    [switch]$CreateReviewAccounts,
    [string]$ReviewMerchantEmail = "review.merchant@merhouse.local",
    [string]$ReviewWarehouseEmail = "review.operator@merhouse.local",
    [string]$ReviewSupportAdminEmail = "review.support@merhouse.local",
    [string]$ReviewAuditorEmail = "review.auditor@merhouse.local",
    [string]$ReviewPassword = "review-password",
    [switch]$SuppressCredentialOutput
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\lib\common.ps1")
. (Join-Path $PSScriptRoot "..\proof\lib\url-guard-lib.ps1")

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = Get-MerHouseDefaultBaseUrl
}

$apiBaseUrl = Assert-AbsoluteHttpUrl -Name "BaseUrl" -Value $BaseUrl

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)] [string] $Method,
        [Parameter(Mandatory = $true)] [string] $Path,
        $Body = $null,
        [string] $Token = ""
    )

    $headers = @{}
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $headers.Authorization = "Bearer $Token"
    }

    $parameters = @{
        Method = $Method
        Uri = "$apiBaseUrl$Path"
    }
    if ($headers.Count -gt 0) {
        $parameters.Headers = $headers
    }
    if ($null -ne $Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = $Body | ConvertTo-Json -Depth 12
    }

    Invoke-RestMethod @parameters
}

function New-Order {
    param(
        [Parameter(Mandatory = $true)] [string] $Label,
        [Parameter(Mandatory = $true)] [int] $Quantity
    )

    Invoke-Api -Method Post -Path "/api/v1/orders" -Token $adminToken -Body @{
        merchantId = $merchant.id
        customerAddress = "Demo $Label Customer, Cairo"
        items = @(@{
            inventoryItemId = $item.id
            quantity = $Quantity
        })
    }
}

function Allocate-Order {
    param([Parameter(Mandatory = $true)] $Order)

    Invoke-Api -Method Post -Path "/api/v1/orders/$($Order.id)/allocate" -Token $adminToken
}

function Set-AllocationStatus {
    param(
        [Parameter(Mandatory = $true)] [string] $AllocationId,
        [Parameter(Mandatory = $true)] [string] $NextStatus
    )

    Invoke-Api -Method Patch -Path "/api/v1/fulfillment-allocations/$AllocationId/status" -Token $adminToken -Body @{
        nextStatus = $NextStatus
    }
}

function Set-AllocationWorkload {
    param(
        [Parameter(Mandatory = $true)] [string] $AllocationId,
        [Parameter(Mandatory = $true)] [int] $Priority,
        [Parameter(Mandatory = $true)] [string] $ScanCode
    )

    Invoke-Api -Method Patch -Path "/api/v1/fulfillment-allocations/$AllocationId/workload" -Token $adminToken -Body @{
        priority = $Priority
        scanCode = $ScanCode
        markPickSheetPrinted = $true
    }
}

function New-Shipment {
    param(
        [Parameter(Mandatory = $true)] [string] $AllocationId,
        [Parameter(Mandatory = $true)] [string] $Label
    )

    Invoke-Api -Method Post -Path "/api/v1/shipments" -Token $adminToken -Body @{
        allocationId = $AllocationId
        carrier = "FedEx"
        trackingNumber = "DEMO-$suffix-$Label"
        packageCount = 2
        packageWeightKg = 4.5
        packageLengthCm = 40
        packageWidthCm = 30
        packageHeightCm = 20
        packingNote = "Demo shipment packed with V10 package evidence."
        metadata = @{
            seed = "demo"
            label = $Label
            suffix = $suffix
        }
    }
}

function New-FulfillmentException {
    param(
        [Parameter(Mandatory = $true)] [string] $AllocationId,
        [string] $ShipmentId = $null,
        [Parameter(Mandatory = $true)] [string] $ReasonCode,
        [Parameter(Mandatory = $true)] [string] $Description
    )

    Invoke-Api -Method Post -Path "/api/v1/fulfillment-exceptions" -Token $adminToken -Body @{
        allocationId = $AllocationId
        shipmentId = $ShipmentId
        reasonCode = $ReasonCode
        description = $Description
    }
}

function Resolve-FulfillmentException {
    param(
        [Parameter(Mandatory = $true)] [string] $ExceptionId,
        [Parameter(Mandatory = $true)] [string] $ResolutionNote
    )

    Invoke-Api -Method Patch -Path "/api/v1/fulfillment-exceptions/$ExceptionId/resolve" -Token $adminToken -Body @{
        resolutionNote = $ResolutionNote
    }
}

function Set-ShipmentStatus {
    param(
        [Parameter(Mandatory = $true)] [string] $ShipmentId,
        [Parameter(Mandatory = $true)] [string] $NextStatus
    )

    Invoke-Api -Method Patch -Path "/api/v1/shipments/$ShipmentId/status" -Token $adminToken -Body @{
        nextStatus = $NextStatus
    }
}

function Set-BackorderStatus {
    param(
        [Parameter(Mandatory = $true)] [string] $OrderId,
        [Parameter(Mandatory = $true)] [string] $BackorderId,
        [Parameter(Mandatory = $true)] [string] $NextStatus
    )

    Invoke-Api -Method Patch -Path "/api/v1/orders/$OrderId/backorders/$BackorderId/status" -Token $adminToken -Body @{
        nextStatus = $NextStatus
    }
}

$existingUsersCache = $null
function Get-ExistingUser {
    param([Parameter(Mandatory = $true)] [string] $Email)

    if ($null -eq $script:existingUsersCache) {
        $script:existingUsersCache = @()
        Invoke-Api -Method Get -Path "/api/v1/admin/users" -Token $adminToken | ForEach-Object {
            $script:existingUsersCache += $_
        }
    }

    @($script:existingUsersCache) | Where-Object { $_.email -eq $Email } | Select-Object -First 1
}

function Ensure-ReviewUser {
    param(
        [Parameter(Mandatory = $true)] [string] $TenantId,
        [Parameter(Mandatory = $true)] [string] $Email,
        [Parameter(Mandatory = $true)] [string] $Role
    )

    $existing = Get-ExistingUser -Email $Email
    if ($existing) {
        return $existing
    }

    $created = Invoke-Api -Method Post -Path "/api/v1/admin/users" -Token $adminToken -Body @{
        tenantId = $TenantId
        email = $Email
        password = $ReviewPassword
        role = $Role
    }
    $script:existingUsersCache = $null
    return $created
}

function Get-FirebaseEmulatorSignUpUri {
    <#
    .SYNOPSIS
        Returns the Firebase Auth emulator signUp REST endpoint URI, or $null
        when VITE_FIREBASE_EMULATOR_HOST is not set (Firebase disabled).
    #>
    $emulatorHost = (Get-MerHouseEnvValue -Name 'VITE_FIREBASE_EMULATOR_HOST')
    if ([string]::IsNullOrWhiteSpace($emulatorHost)) {
        return $null
    }
    $emulatorHost = $emulatorHost.TrimEnd('/')
    $firebaseApiKey = Get-MerHouseEnvValue -Name 'VITE_FIREBASE_API_KEY'
    if ([string]::IsNullOrWhiteSpace($firebaseApiKey)) {
        return $null
    }
    return "${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}"
}

function Create-FirebaseAuthUser {
    <#
    .SYNOPSIS
        Creates a user in the Firebase Auth emulator. This is required so that
        the frontend's signInWithEmailAndPassword can authenticate the user.
        Silently succeeds if the user already exists (EMAIL_EXISTS).
    .PARAMETER Email
        The user's email address.
    .PARAMETER Password
        The user's password.
    #>
    param(
        [Parameter(Mandatory = $true)] [string] $Email,
        [Parameter(Mandatory = $true)] [string] $Password
    )

    $signUpUri = Get-FirebaseEmulatorSignUpUri
    if ($null -eq $signUpUri) {
        return
    }

    try {
        $body = @{
            email = $Email
            password = $Password
            returnSecureToken = $true
        } | ConvertTo-Json
        Invoke-RestMethod -Method Post -Uri $signUpUri -ContentType "application/json" -Body $body | Out-Null
    } catch {
        # EMAIL_EXISTS is expected when the user was already created (e.g. by DevAdminSeeder).
        # Any other error is silently ignored — the DB user is the primary concern.
    }
}

function First-AllocationId {
    param([Parameter(Mandatory = $true)] $Order)

    $allocations = @($Order.allocations)
    if ($allocations.Count -eq 0) {
        throw "Order $($Order.id) did not include any allocations."
    }
    return $allocations[0].id
}

$suffix = if ([string]::IsNullOrWhiteSpace($Suffix)) {
    [Guid]::NewGuid().ToString("N").Substring(0, 8)
} else {
    $Suffix
}

Write-Host "Creating demo seed data against $apiBaseUrl"
Write-Host "Demo suffix: $suffix"

$login = Invoke-Api -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $AdminEmail
    password = $AdminPassword
}
$adminToken = $login.accessToken
if ([string]::IsNullOrWhiteSpace($adminToken)) {
    throw "Admin login did not return an access token."
}

$merchant = Invoke-Api -Method Post -Path "/api/v1/tenants" -Token $adminToken -Body @{
    name = "Demo Merchant $suffix"
    type = "MERCHANT"
}
$warehouseProvider = Invoke-Api -Method Post -Path "/api/v1/tenants" -Token $adminToken -Body @{
    name = "Demo Warehouse Provider $suffix"
    type = "WAREHOUSE_PROVIDER"
}
$secondaryMerchant = Invoke-Api -Method Post -Path "/api/v1/tenants" -Token $adminToken -Body @{
    name = "Demo Secondary Merchant $suffix"
    type = "MERCHANT"
}

$warehouse = Invoke-Api -Method Post -Path "/api/v1/warehouses" -Token $adminToken -Body @{
    tenantId = $warehouseProvider.id
    name = "Demo Cairo Fulfillment Hub $suffix"
    address = "Nasr City, Cairo"
    latitude = 30.0444
    longitude = 31.2357
    capacity = 25000
}

$overflowWarehouse = Invoke-Api -Method Post -Path "/api/v1/warehouses" -Token $adminToken -Body @{
    tenantId = $warehouseProvider.id
    name = "Demo Giza Overflow Hub $suffix"
    address = "6th of October, Giza"
    latitude = 29.9285
    longitude = 30.9188
    capacity = 9000
}

$item = Invoke-Api -Method Post -Path "/api/v1/inventory/items" -Token $adminToken -Body @{
    merchantId = $merchant.id
    sku = "DEMO-SKU-$suffix"
    name = "Demo Stateful Item"
    attributes = @{
        category = "demo"
        temperatureControlled = $false
        fragile = $true
    }
}

$secondaryItem = Invoke-Api -Method Post -Path "/api/v1/inventory/items" -Token $adminToken -Body @{
    merchantId = $secondaryMerchant.id
    sku = "DEMO-SECONDARY-SKU-$suffix"
    name = "Demo Secondary Merchant Item"
    attributes = @{
        category = "demo"
        owner = "secondary"
    }
}

$archivedItem = Invoke-Api -Method Post -Path "/api/v1/inventory/items" -Token $adminToken -Body @{
    merchantId = $merchant.id
    sku = "DEMO-ARCHIVED-$suffix"
    name = "Demo Archived Item"
    attributes = @{
        category = "demo"
        status = "archived-review"
    }
}
$archivedItem = Invoke-Api -Method Patch -Path "/api/v1/inventory/items/$($archivedItem.id)" -Token $adminToken -Body @{
    sku = $archivedItem.sku
    name = $archivedItem.name
    attributes = $archivedItem.attributes
    archived = $true
}

$relationship = Invoke-Api -Method Post -Path "/api/v1/merchant-warehouse/relationships" -Token $adminToken -Body @{
    merchantId = $merchant.id
    warehouseProviderId = $warehouseProvider.id
    serviceNotes = "Demo active merchant-provider service lane $suffix"
}
$relationship = Invoke-Api -Method Patch -Path "/api/v1/merchant-warehouse/relationships/$($relationship.id)/activate" -Token $adminToken

$pendingInboundItem = Invoke-Api -Method Post -Path "/api/v1/inventory/items" -Token $adminToken -Body @{
    merchantId = $merchant.id
    sku = "DEMO-INBOUND-PENDING-$suffix"
    name = "Demo Pending Inbound Item"
    attributes = @{
        category = "demo"
        inboundState = "pending"
    }
}
$pendingInbound = Invoke-Api -Method Post -Path "/api/v1/merchant-warehouse/inbound-stock-requests" -Token $adminToken -Body @{
    relationshipId = $relationship.id
    warehouseId = $warehouse.id
    inventoryItemId = $pendingInboundItem.id
    requestedQuantity = 30
    merchantReference = "DEMO-ASN-PENDING-$suffix"
    merchantNote = "Pending inbound work for warehouse receiving review."
}

$draftInboundItem = Invoke-Api -Method Post -Path "/api/v1/inventory/items" -Token $adminToken -Body @{
    merchantId = $merchant.id
    sku = "DEMO-INBOUND-DRAFT-$suffix"
    name = "Demo Draft Inbound Item"
    attributes = @{
        category = "demo"
        inboundState = "draft-cancelled"
    }
}
$draftInbound = Invoke-Api -Method Post -Path "/api/v1/merchant-warehouse/inbound-stock-requests/drafts" -Token $adminToken -Body @{
    relationshipId = $relationship.id
    warehouseId = $warehouse.id
    inventoryItemId = $draftInboundItem.id
    requestedQuantity = 12
    merchantReference = "DEMO-ASN-DRAFT-$suffix"
    merchantNote = "Draft inbound created for manual review before cancellation."
}
$draftInbound = Invoke-Api -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($draftInbound.id)/cancel" -Token $adminToken

$receivedInboundItem = Invoke-Api -Method Post -Path "/api/v1/inventory/items" -Token $adminToken -Body @{
    merchantId = $merchant.id
    sku = "DEMO-INBOUND-RECEIVED-$suffix"
    name = "Demo Received Inbound Item"
    attributes = @{
        category = "demo"
        inboundState = "received"
    }
}
$receivedInbound = Invoke-Api -Method Post -Path "/api/v1/merchant-warehouse/inbound-stock-requests" -Token $adminToken -Body @{
    relationshipId = $relationship.id
    warehouseId = $warehouse.id
    inventoryItemId = $receivedInboundItem.id
    requestedQuantity = 24
    merchantReference = "DEMO-ASN-RECEIVED-$suffix"
    merchantNote = "Received inbound proof for merchant-visible stock."
}
$receivedInbound = Invoke-Api -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($receivedInbound.id)/approve" -Token $adminToken
$receivedInbound = Invoke-Api -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($receivedInbound.id)/receiving" -Token $adminToken
$receivedInbound = Invoke-Api -Method Patch -Path "/api/v1/merchant-warehouse/inbound-stock-requests/$($receivedInbound.id)/receive" -Token $adminToken -Body @{
    receivedQuantity = 22
    damagedQuantity = 1
    receivingNote = "Demo received with one damaged unit and one short unit."
}

$effectiveDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$renewalDate = (Get-Date).AddMonths(1).ToString("yyyy-MM-dd")
$serviceAgreement = Invoke-Api -Method Post -Path "/api/v1/service-accountability/agreements" -Token $adminToken -Body @{
    relationshipId = $relationship.id
    title = "Demo service terms $suffix"
    effectiveDate = $effectiveDate
    renewalReviewDate = $renewalDate
    cancellationWindowDays = 14
    serviceScopes = @("INBOUND_RECEIVING", "STORAGE", "PICK_PACK", "SHIPMENT_HANDOFF")
    serviceNotes = "Internal demo service-accountability record only."
    rateCard = @{
        inboundReceivingFeePerUnit = 2.50
        storageFeePerUnitPerDay = 0.10
        freeStorageDays = 5
        minimumMonthlyServiceCharge = 0
        pickFeePerOrder = 1.25
        pickFeePerLine = 0.75
        packFeePerOrder = 1.00
        packagingFeePerPackage = 0.50
        shipmentHandlingFee = 1.50
        returnRestockFee = 1.00
        exceptionHandlingFee = 3.00
        coordinationFeePercent = 5.00
        fixedCoordinationFee = 1.00
        carrierPassThroughNote = "Carrier cost is a note only; MerHouse does not collect payment."
    }
    slaPolicy = @{
        receivingSlaHours = 48
        pickPackSlaHours = 24
        shipmentHandoffSlaHours = 12
        exceptionResponseSlaHours = 8
        pauseRuleNotes = "Agreement hold pauses SLA clocks."
    }
}
$serviceAgreement = Invoke-Api -Method Patch -Path "/api/v1/service-accountability/agreements/$($serviceAgreement.id)/propose" -Token $adminToken
$serviceAgreement = Invoke-Api -Method Patch -Path "/api/v1/service-accountability/agreements/$($serviceAgreement.id)/accept" -Token $adminToken
$periodStart = (Get-Date).ToString("yyyy-MM-dd")
$periodEnd = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
$dueDate = (Get-Date).AddDays(14).ToString("yyyy-MM-dd")
$serviceStatement = Invoke-Api -Method Post -Path "/api/v1/service-accountability/agreements/$($serviceAgreement.id)/statements/generate" -Token $adminToken -Body @{
    periodStart = $periodStart
    periodEnd = $periodEnd
    dueDate = $dueDate
    idempotencyKey = "demo-statement-$suffix"
    note = "Demo statement reconciles to received inbound stock."
    inboundStockRequestIds = @($receivedInbound.id)
    fulfillmentAllocationIds = @()
    shipmentIds = @()
}
$serviceDispute = $null
if (@($serviceStatement.lines).Count -gt 0) {
    $serviceDispute = Invoke-Api -Method Post -Path "/api/v1/service-accountability/statements/$($serviceStatement.id)/disputes" -Token $adminToken -Body @{
        statementLineId = $serviceStatement.lines[0].id
        reason = "Demo receiving line review"
        evidenceNote = "Demo dispute evidence for service-accountability tour."
    }
}
$serviceClaim = Invoke-Api -Method Post -Path "/api/v1/service-accountability/agreements/$($serviceAgreement.id)/claims" -Token $adminToken -Body @{
    sourceType = "INBOUND_STOCK_REQUEST"
    sourceId = $receivedInbound.id
    claimType = "DAMAGED_STOCK"
    reason = "Demo damaged-stock claim needs provider review"
    evidenceNote = "Demo claim evidence note."
}
$serviceReview = Invoke-Api -Method Post -Path "/api/v1/service-accountability/agreements/$($serviceAgreement.id)/reviews" -Token $adminToken -Body @{
    reviewType = "MANUAL_ADJUSTMENT"
    reason = "Demo service review needs provider approval"
    evidenceNote = "Demo review evidence note."
}

$blockedProvider = Invoke-Api -Method Post -Path "/api/v1/tenants" -Token $adminToken -Body @{
    name = "Demo Unauthorized Provider $suffix"
    type = "WAREHOUSE_PROVIDER"
}
$blockedWarehouse = Invoke-Api -Method Post -Path "/api/v1/warehouses" -Token $adminToken -Body @{
    tenantId = $blockedProvider.id
    name = "Demo Unauthorized Warehouse $suffix"
    address = "Unauthorized Demo Warehouse, Cairo"
    latitude = $null
    longitude = $null
    capacity = 1000
}
$blockedItem = Invoke-Api -Method Post -Path "/api/v1/inventory/items" -Token $adminToken -Body @{
    merchantId = $merchant.id
    sku = "DEMO-POLICY-BLOCK-$suffix"
    name = "Demo Policy Block Item"
    attributes = @{
        category = "demo"
        policyExpectation = "unauthorized-stock-backorders"
    }
}
Invoke-Api -Method Post -Path "/api/v1/inventory/stock" -Token $adminToken -Body @{
    warehouseId = $blockedWarehouse.id
    inventoryItemId = $blockedItem.id
    quantity = 10
} | Out-Null
$blockedOrder = Invoke-Api -Method Post -Path "/api/v1/orders" -Token $adminToken -Body @{
    merchantId = $merchant.id
    customerAddress = "Demo Unauthorized Stock Customer, Cairo"
    items = @(@{
        inventoryItemId = $blockedItem.id
        quantity = 2
    })
}
$blockedOrder = Invoke-Api -Method Post -Path "/api/v1/orders/$($blockedOrder.id)/allocate" -Token $adminToken
if ($blockedOrder.status -ne "BACKORDERED" -or @($blockedOrder.allocations).Count -ne 0 -or @($blockedOrder.backorders).Count -ne 1) {
    throw "Policy seed failed: unauthorized warehouse stock was not blocked as expected."
}

Invoke-Api -Method Post -Path "/api/v1/inventory/stock" -Token $adminToken -Body @{
    warehouseId = $warehouse.id
    inventoryItemId = $item.id
    quantity = 500
} | Out-Null

Invoke-Api -Method Post -Path "/api/v1/inventory/stock/remove" -Token $adminToken -Body @{
    warehouseId = $warehouse.id
    inventoryItemId = $item.id
    quantity = 5
} | Out-Null

Invoke-Api -Method Post -Path "/api/v1/inventory/stock" -Token $adminToken -Body @{
    warehouseId = $overflowWarehouse.id
    inventoryItemId = $secondaryItem.id
    quantity = 25
} | Out-Null

$merchantUser = Invoke-Api -Method Post -Path "/api/v1/admin/users" -Token $adminToken -Body @{
    tenantId = $merchant.id
    email = "demo.merchant.$suffix@merhouse.local"
    password = "demo-password"
    role = "MERCHANT"
}
Create-FirebaseAuthUser -Email $merchantUser.email -Password "demo-password"
$operatorUser = Invoke-Api -Method Post -Path "/api/v1/admin/users" -Token $adminToken -Body @{
    tenantId = $warehouseProvider.id
    email = "demo.operator.$suffix@merhouse.local"
    password = "demo-password"
    role = "WAREHOUSE_OPERATOR"
}
Create-FirebaseAuthUser -Email $operatorUser.email -Password "demo-password"
$disabledUser = Invoke-Api -Method Post -Path "/api/v1/admin/users" -Token $adminToken -Body @{
    tenantId = $merchant.id
    email = "demo.disabled.$suffix@merhouse.local"
    password = "demo-password"
    role = "MERCHANT"
}
Create-FirebaseAuthUser -Email $disabledUser.email -Password "demo-password"
Invoke-Api -Method Patch -Path "/api/v1/admin/users/$($disabledUser.id)/disable" -Token $adminToken -Body @{
    reason = "Demo disabled account for admin recovery review."
} | Out-Null

$reviewMerchantUser = $null
$reviewWarehouseUser = $null
$reviewSupportAdminUser = $null
$reviewAuditorUser = $null
if ($CreateReviewAccounts) {
    $reviewMerchantUser = Ensure-ReviewUser -TenantId $merchant.id -Email $ReviewMerchantEmail -Role "MERCHANT"
    Create-FirebaseAuthUser -Email $ReviewMerchantEmail -Password $ReviewPassword
    $reviewWarehouseUser = Ensure-ReviewUser -TenantId $warehouseProvider.id -Email $ReviewWarehouseEmail -Role "WAREHOUSE_OPERATOR"
    Create-FirebaseAuthUser -Email $ReviewWarehouseEmail -Password $ReviewPassword
    $reviewSupportAdminUser = Ensure-ReviewUser -TenantId $merchant.id -Email $ReviewSupportAdminEmail -Role "SUPPORT_ADMIN"
    Create-FirebaseAuthUser -Email $ReviewSupportAdminEmail -Password $ReviewPassword
    $reviewAuditorUser = Ensure-ReviewUser -TenantId $merchant.id -Email $ReviewAuditorEmail -Role "AUDITOR"
    Create-FirebaseAuthUser -Email $ReviewAuditorEmail -Password $ReviewPassword
}

$primaryContact = Invoke-Api -Method Post -Path "/api/v1/orders/customer-contacts" -Token $adminToken -Body @{
    merchantId = $merchant.id
    label = "Demo Cairo Receiver"
    contactName = "Cairo Receiving Desk"
    phone = "+20-100-$suffix"
    address = "Demo Cairo Dock 4, Cairo"
}
$secondaryContact = Invoke-Api -Method Post -Path "/api/v1/orders/customer-contacts" -Token $adminToken -Body @{
    merchantId = $merchant.id
    label = "Demo Alexandria Receiver"
    contactName = "Alexandria Retail Counter"
    phone = "+20-200-$suffix"
    address = "Demo Alexandria Store, Alexandria"
}

$createdOrder = New-Order -Label "Created" -Quantity 1

$pendingOrder = Allocate-Order -Order (New-Order -Label "Pending" -Quantity 10)

$pickingOrder = Allocate-Order -Order (New-Order -Label "Picking" -Quantity 11)
$pickingAllocationId = First-AllocationId -Order $pickingOrder
Set-AllocationWorkload -AllocationId $pickingAllocationId -Priority 1 -ScanCode "DEMO-SCAN-PICK-$suffix" | Out-Null
Set-AllocationStatus -AllocationId $pickingAllocationId -NextStatus "PICKING" | Out-Null
$pickingOrder = Invoke-Api -Method Get -Path "/api/v1/orders/$($pickingOrder.id)" -Token $adminToken

$packedOrder = Allocate-Order -Order (New-Order -Label "Packed" -Quantity 12)
$packedAllocationId = First-AllocationId -Order $packedOrder
Set-AllocationWorkload -AllocationId $packedAllocationId -Priority 2 -ScanCode "DEMO-SCAN-PACK-$suffix" | Out-Null
Set-AllocationStatus -AllocationId $packedAllocationId -NextStatus "PICKING" | Out-Null
Set-AllocationStatus -AllocationId $packedAllocationId -NextStatus "PACKED" | Out-Null
$packedOrder = Invoke-Api -Method Get -Path "/api/v1/orders/$($packedOrder.id)" -Token $adminToken

$inTransitOrder = Allocate-Order -Order (New-Order -Label "InTransit" -Quantity 13)
$inTransitAllocationId = First-AllocationId -Order $inTransitOrder
Set-AllocationWorkload -AllocationId $inTransitAllocationId -Priority 3 -ScanCode "DEMO-SCAN-SHIP-$suffix" | Out-Null
Set-AllocationStatus -AllocationId $inTransitAllocationId -NextStatus "PICKING" | Out-Null
Set-AllocationStatus -AllocationId $inTransitAllocationId -NextStatus "PACKED" | Out-Null
$inTransitShipment = New-Shipment -AllocationId $inTransitAllocationId -Label "IN-TRANSIT"
$inTransitPackages = Invoke-Api -Method Get -Path "/api/v1/shipments/$($inTransitShipment.id)/packages" -Token $adminToken
$inTransitOrder = Invoke-Api -Method Get -Path "/api/v1/orders/$($inTransitOrder.id)" -Token $adminToken

$deliveredOrder = Allocate-Order -Order (New-Order -Label "Delivered" -Quantity 14)
$deliveredAllocationId = First-AllocationId -Order $deliveredOrder
Set-AllocationStatus -AllocationId $deliveredAllocationId -NextStatus "PICKING" | Out-Null
Set-AllocationStatus -AllocationId $deliveredAllocationId -NextStatus "PACKED" | Out-Null
$deliveredShipment = New-Shipment -AllocationId $deliveredAllocationId -Label "DELIVERED"
$deliveredShipment = Invoke-Api -Method Patch -Path "/api/v1/shipments/$($deliveredShipment.id)/delivered" -Token $adminToken
$deliveredOrder = Invoke-Api -Method Get -Path "/api/v1/orders/$($deliveredOrder.id)" -Token $adminToken

$failedOrder = Allocate-Order -Order (New-Order -Label "FailedShipment" -Quantity 15)
$failedAllocationId = First-AllocationId -Order $failedOrder
Set-AllocationStatus -AllocationId $failedAllocationId -NextStatus "PICKING" | Out-Null
Set-AllocationStatus -AllocationId $failedAllocationId -NextStatus "PACKED" | Out-Null
$failedShipment = New-Shipment -AllocationId $failedAllocationId -Label "FAILED"
$failedShipment = Set-ShipmentStatus -ShipmentId $failedShipment.id -NextStatus "FAILED"
$openException = New-FulfillmentException -AllocationId $failedAllocationId -ShipmentId $failedShipment.id -ReasonCode "FAILED_DELIVERY" -Description "Demo open exception: failed delivery requires merchant follow-up."
$failedOrder = Invoke-Api -Method Get -Path "/api/v1/orders/$($failedOrder.id)" -Token $adminToken

$returnedOrder = Allocate-Order -Order (New-Order -Label "ReturnedShipment" -Quantity 16)
$returnedAllocationId = First-AllocationId -Order $returnedOrder
Set-AllocationStatus -AllocationId $returnedAllocationId -NextStatus "PICKING" | Out-Null
Set-AllocationStatus -AllocationId $returnedAllocationId -NextStatus "PACKED" | Out-Null
$returnedShipment = New-Shipment -AllocationId $returnedAllocationId -Label "RETURNED"
$returnedShipment = Set-ShipmentStatus -ShipmentId $returnedShipment.id -NextStatus "RETURNED"
$resolvedException = New-FulfillmentException -AllocationId $returnedAllocationId -ShipmentId $returnedShipment.id -ReasonCode "RETURNED_ITEM" -Description "Demo resolved exception: returned shipment accepted by merchant operations."
$resolvedException = Resolve-FulfillmentException -ExceptionId $resolvedException.id -ResolutionNote "Demo merchant accepted return resolution and customer notification is ready."
$returnedOrder = Invoke-Api -Method Get -Path "/api/v1/orders/$($returnedOrder.id)" -Token $adminToken

$cancelledCreatedOrder = Invoke-Api -Method Post -Path "/api/v1/orders/$((New-Order -Label "CancelCreated" -Quantity 1).id)/cancel" -Token $adminToken

$cancelledAllocatedOrder = Allocate-Order -Order (New-Order -Label "CancelAllocated" -Quantity 2)
$cancelledAllocatedOrder = Invoke-Api -Method Post -Path "/api/v1/orders/$($cancelledAllocatedOrder.id)/cancel" -Token $adminToken

$backorderedOrder = Allocate-Order -Order (New-Order -Label "Backordered" -Quantity 10000)
$cancelledBackorder = @($backorderedOrder.backorders) | Select-Object -First 1
if ($cancelledBackorder) {
    $backorderedOrder = Set-BackorderStatus -OrderId $backorderedOrder.id -BackorderId $cancelledBackorder.id -NextStatus "CANCELLED"
}

$partialOrder = Allocate-Order -Order (New-Order -Label "Partial" -Quantity 600)
$fulfilledBackorderOrder = Allocate-Order -Order (New-Order -Label "FulfilledBackorder" -Quantity 700)
$fulfilledBackorder = @($fulfilledBackorderOrder.backorders) | Select-Object -First 1
if ($fulfilledBackorder) {
    $fulfilledBackorderOrder = Set-BackorderStatus -OrderId $fulfilledBackorderOrder.id -BackorderId $fulfilledBackorder.id -NextStatus "FULFILLED"
}

$bulkOrderA = Invoke-Api -Method Post -Path "/api/v1/orders" -Token $adminToken -Body @{
    merchantId = $merchant.id
    customerAddress = $primaryContact.address
    items = @(
        @{ inventoryItemId = $item.id; quantity = 3 },
        @{ inventoryItemId = $receivedInboundItem.id; quantity = 2 }
    )
}
$bulkOrderB = Invoke-Api -Method Post -Path "/api/v1/orders" -Token $adminToken -Body @{
    merchantId = $merchant.id
    customerAddress = $secondaryContact.address
    items = @(@{ inventoryItemId = $item.id; quantity = 4 })
}

$orderImport = Invoke-Api -Method Post -Path "/api/v1/orders/imports" -Token $adminToken -Body @{
    merchantId = $merchant.id
    mode = "PARTIAL_ACCEPT"
    sourceLabel = "Demo audited import $suffix"
    rows = @(
        @{
            merchantOrderReference = "DEMO-IMPORT-$suffix-1"
            sku = $item.sku
            quantity = 1
            customerAddress = "Demo import customer, Cairo"
            customerName = "Demo Import Customer"
            customerPhone = "+20-300-$suffix"
        },
        @{
            merchantOrderReference = "DEMO-IMPORT-$suffix-1"
            sku = $item.sku
            quantity = 1
            customerAddress = "Demo duplicate import customer, Cairo"
            customerName = "Duplicate Import Customer"
        },
        @{
            merchantOrderReference = "DEMO-IMPORT-$suffix-2"
            sku = "DEMO-UNKNOWN-$suffix"
            quantity = 1
            customerAddress = "Demo unknown SKU customer, Cairo"
        }
    )
}

$merchantDashboard = Invoke-Api -Method Get -Path "/api/v1/dashboard/merchant?merchantId=$($merchant.id)" -Token $adminToken
$warehouseDashboard = Invoke-Api -Method Get -Path "/api/v1/dashboard/warehouse?warehouseProviderId=$($warehouseProvider.id)" -Token $adminToken

$summary = [ordered]@{
    suffix = $suffix
    tenants = @($merchant.name, $warehouseProvider.name, $secondaryMerchant.name, $blockedProvider.name)
    warehouses = @($warehouse.name, $overflowWarehouse.name, $blockedWarehouse.name)
    users = @($merchantUser.email, $operatorUser.email, $disabledUser.email)
    contacts = @($primaryContact.label, $secondaryContact.label)
    merchantWarehouse = [ordered]@{
        relationship = $relationship.id
        relationshipStatus = $relationship.status
        draftInbound = $draftInbound.id
        draftInboundStatus = $draftInbound.status
        pendingInbound = $pendingInbound.id
        pendingInboundStatus = $pendingInbound.status
        receivedInbound = $receivedInbound.id
        receivedInboundStatus = $receivedInbound.status
        policyBlockedOrder = $blockedOrder.id
        policyBlockedOrderStatus = $blockedOrder.status
    }
    orders = [ordered]@{
        created = $createdOrder.id
        allocatedPending = $pendingOrder.id
        allocatedPicking = $pickingOrder.id
        allocatedPacked = $packedOrder.id
        shippedInTransit = $inTransitOrder.id
        delivered = $deliveredOrder.id
        failedShipment = $failedOrder.id
        returnedShipment = $returnedOrder.id
        bulkMultiLine = $bulkOrderA.id
        bulkSingleLine = $bulkOrderB.id
        cancelledCreated = $cancelledCreatedOrder.id
        cancelledAllocated = $cancelledAllocatedOrder.id
        backorderedWithCancelledBackorder = $backorderedOrder.id
        partiallyAllocated = $partialOrder.id
        fulfilledBackorder = $fulfilledBackorderOrder.id
    }
    shipments = [ordered]@{
        inTransit = $inTransitShipment.id
        inTransitPackages = @($inTransitPackages).Count
        delivered = $deliveredShipment.id
        failed = $failedShipment.id
        returned = $returnedShipment.id
    }
    v10 = [ordered]@{
        archivedItem = $archivedItem.id
        openException = $openException.id
        openExceptionStatus = $openException.status
        resolvedException = $resolvedException.id
        resolvedExceptionStatus = $resolvedException.status
        pickingScanCode = "DEMO-SCAN-PICK-$suffix"
        packedScanCode = "DEMO-SCAN-PACK-$suffix"
        merchantDashboardOrders = $merchantDashboard.orders
        warehouseDashboardOpenExceptions = $warehouseDashboard.openExceptions
    }
    v11 = [ordered]@{
        serviceAgreement = $serviceAgreement.id
        serviceAgreementStatus = $serviceAgreement.status
        serviceStatement = $serviceStatement.id
        serviceStatementStatus = $serviceStatement.status
        serviceDispute = if ($serviceDispute) { $serviceDispute.id } else { $null }
        serviceClaim = $serviceClaim.id
        serviceReview = $serviceReview.id
        orderImport = $orderImport.id
        orderImportStatus = $orderImport.status
        orderImportCreatedRows = $orderImport.createdRows
        orderImportRejectedRows = $orderImport.rejectedRows
    }
    reviewAccounts = [ordered]@{
        enabled = [bool]$CreateReviewAccounts
        merchant = if ($reviewMerchantUser) { $reviewMerchantUser.email } else { $null }
        warehouse = if ($reviewWarehouseUser) { $reviewWarehouseUser.email } else { $null }
        supportAdmin = if ($reviewSupportAdminUser) { $reviewSupportAdminUser.email } else { $null }
        auditor = if ($reviewAuditorUser) { $reviewAuditorUser.email } else { $null }
        password = if ($CreateReviewAccounts -and -not $SuppressCredentialOutput) { $ReviewPassword } else { $null }
    }
}

Write-Host ""
Write-Host "Demo seed complete."
Write-Host "Suffix: $suffix"
if ($SuppressCredentialOutput) {
    Write-Host "Merchant user: $($merchantUser.email)"
    Write-Host "Warehouse operator: $($operatorUser.email)"
    Write-Host "Disabled user: $($disabledUser.email)"
} else {
    Write-Host "Merchant user: $($merchantUser.email) / demo-password"
    Write-Host "Warehouse operator: $($operatorUser.email) / demo-password"
    Write-Host "Disabled user: $($disabledUser.email) / demo-password"
}
if ($CreateReviewAccounts) {
    if ($SuppressCredentialOutput) {
        Write-Host "Review merchant: $($reviewMerchantUser.email)"
        Write-Host "Review warehouse: $($reviewWarehouseUser.email)"
        Write-Host "Review support admin: $($reviewSupportAdminUser.email)"
        Write-Host "Review auditor: $($reviewAuditorUser.email)"
    } else {
        Write-Host "Review merchant: $($reviewMerchantUser.email) / $ReviewPassword"
        Write-Host "Review warehouse: $($reviewWarehouseUser.email) / $ReviewPassword"
        Write-Host "Review support admin: $($reviewSupportAdminUser.email) / $ReviewPassword"
        Write-Host "Review auditor: $($reviewAuditorUser.email) / $ReviewPassword"
    }
}
Write-Host ""
$summary | ConvertTo-Json -Depth 8
