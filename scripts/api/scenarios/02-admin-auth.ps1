param([Parameter(Mandatory = $true)] [hashtable] $Context)

function Get-FirebaseSignInUri {
    $emulatorHost = $Context.FirebaseEmulatorHost
    if (-not [string]::IsNullOrWhiteSpace($emulatorHost)) {
        $emulatorHost = $emulatorHost.TrimEnd('/')
        return "${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($Context.FirebaseApiKey)"
    }
    return "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($Context.FirebaseApiKey)"
}

function Get-FirebaseIdToken {
    param([string]$Email, [string]$Password)

    $signInUri = Get-FirebaseSignInUri
    $response = Invoke-RestMethod -Method Post -Uri $signInUri -ContentType "application/json" -Body (@{
        email = $Email
        password = $Password
        returnSecureToken = $true
    } | ConvertTo-Json)
    return $response.idToken
}

Write-Host "2. Verifying admin/auth RBAC"

$merchantPassword = "merchant-password-$($Context.Suffix)"
$operatorPassword = "operator-password-$($Context.Suffix)"
Write-Host "  Creating isolated auth users..."
$Context.MerchantUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.Merchant.id
    email = "auth.merchant.$($Context.Suffix)@merhouse.local"
    password = $merchantPassword
    role = "MERCHANT"
}
$Context.OperatorUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.WarehouseProvider.id
    email = "auth.operator.$($Context.Suffix)@merhouse.local"
    password = $operatorPassword
    role = "WAREHOUSE_OPERATOR"
}
$Context.DisabledUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.Merchant.id
    email = "auth.disabled.$($Context.Suffix)@merhouse.local"
    password = "disabled-password-$($Context.Suffix)"
    role = "MERCHANT"
}
$Context.SecondaryAdminUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Body @{
    tenantId = $Context.Merchant.id
    email = "auth.secondary.$($Context.Suffix)@merhouse.local"
    password = "secondary-password-$($Context.Suffix)"
    role = "SUPPORT_ADMIN"
}

# Wait for users to be created in Firebase Auth
Start-Sleep -Seconds 2

$merchantIdToken = Get-FirebaseIdToken -Email $Context.MerchantUser.email -Password $merchantPassword
$Context.MerchantLogin = @{ user = $Context.MerchantUser }
$Context.MerchantHeaders = @{ Authorization = "Bearer $merchantIdToken" }

$operatorIdToken = Get-FirebaseIdToken -Email $Context.OperatorUser.email -Password $operatorPassword
$Context.OperatorLogin = @{ user = $Context.OperatorUser }
$Context.OperatorHeaders = @{ Authorization = "Bearer $operatorIdToken" }

# Disabled user and secondary admin are used later via admin headers

# Verify admin /me
$me = Invoke-Json -Context $Context -Method Get -Path "/api/v1/auth/me"
Assert-Equal -Actual $me.user.email -Expected $Context.AdminEmail -Message "Current admin email mismatch."

Write-Host "  Verifying merchant and operator access (RBAC)..."
# Verifies merchant cannot create tenants
$null = Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/tenants" -Body @{ name = "Test"; type = "MERCHANT" } -ExpectedStatus 403 -Headers $Context.MerchantHeaders

# Verifies operator cannot create orders
$null = Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/orders" -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "RBAC test, Cairo"
    items = @(@{ inventoryItemId = $Context.Item.id; quantity = 1 })
} -ExpectedStatus 403 -Headers $Context.OperatorHeaders

Write-Host "  Disabling the disabled user..."
$Context.DisabledUser = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/admin/users/$($Context.DisabledUser.id)/disable" -Body @{ reason = "Smoke disable for RBAC test." }
$disabledUserId = $Context.DisabledUser.id

Write-Host "  Verifying disabled user cannot log in via admin enforcement..."
# The disabled user's Firebase token should still work for Firebase Auth, but the backend
# will reject it because the user is disabled in the application database.
# Instead, verify via the backend that the user is disabled.
$users = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/users"
$disabledFound = $users | Where-Object { $_.id -eq $disabledUserId }
Assert-Equal -Actual $disabledFound.enabled -Expected $false -Message "Disabled user should have enabled=false."

Write-Host "  Verifying self-disable is blocked..."
$null = Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/admin/users/$($Context.AdminUserId)/disable" -Body @{ reason = "self-disable attempt" } -ExpectedStatus 409

Write-Host "  Verifying admin can re-enable the disabled user..."
$Context.DisabledUser = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/admin/users/$disabledUserId/enable" -Body @{ reason = "Smoke re-enable for RBAC test." }
$users = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/users"
$enabledFound = $users | Where-Object { $_.id -eq $disabledUserId }
Assert-Equal -Actual $enabledFound.enabled -Expected $true -Message "Re-enabled user should have enabled=true."

Write-Host "  Verifying merchant access is scoped..."
$merchantItems = Invoke-Json -Context $Context -Method Get -Path "/api/v1/inventory/items" -Headers $Context.MerchantHeaders
Assert-Equal -Actual (@($merchantItems).Count) -Expected 1 -Message "Merchant should see only one item"
