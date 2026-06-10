param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "12a. Verifying V12 platform control summary and tenant health"
$Context.V12PlatformSummary = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/control/summary" -Headers $Context.AdminHeaders
Assert-NotBlank -Value $Context.V12PlatformSummary.tenants -Message "V12 platform summary tenant count was blank."
$Context.V12TenantHealth = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/control/tenant-health" -Headers $Context.AdminHeaders
$tenantHealthRows = @($Context.V12TenantHealth | Where-Object { $_.tenant.id -eq $Context.Merchant.id })
Assert-Equal -Actual $tenantHealthRows.Count -Expected 1 -Message "V12 tenant health did not include the smoke merchant."
$Context.V12TenantHealthDetail = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/control/tenant-health/$($Context.Merchant.id)" -Headers $Context.AdminHeaders
Assert-Equal -Actual $Context.V12TenantHealthDetail.tenant.id -Expected $Context.Merchant.id -Message "V12 tenant health detail returned the wrong tenant."

Write-Host "12b. Verifying tenant suspension and activation controls"
$Context.V12GovernedTenant = Invoke-Json -Context $Context -Method Post -Path "/api/v1/tenants" -Headers $Context.AdminHeaders -Body @{
    name = "V12 Governed Merchant $($Context.Suffix)"
    type = "MERCHANT"
}
$Context.V12GovernedTenant = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/tenants/$($Context.V12GovernedTenant.id)/suspend" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke proves V12 tenant suspension audit path"
}
Assert-Equal -Actual $Context.V12GovernedTenant.active -Expected $false -Message "V12 tenant was not suspended."
$Context.V12GovernedTenant = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/tenants/$($Context.V12GovernedTenant.id)/activate" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke proves V12 tenant activation audit path"
}
Assert-Equal -Actual $Context.V12GovernedTenant.active -Expected $true -Message "V12 tenant was not reactivated."

Write-Host "12c. Verifying relationship suspend, reactivate, and end controls"
$Context.V12Relationship = Invoke-Json -Context $Context -Method Post -Path "/api/v1/merchant-warehouse/relationships" -Headers $Context.AdminHeaders -Body @{
    merchantId = $Context.OtherMerchant.id
    warehouseProviderId = $Context.WarehouseProvider.id
    serviceNotes = "V12 smoke relationship governance lane"
}
$Context.V12Relationship = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/relationships/$($Context.V12Relationship.id)/activate" -Headers $Context.AdminHeaders
Assert-Equal -Actual $Context.V12Relationship.status -Expected "ACTIVE" -Message "V12 relationship was not activated."
$Context.V12Relationship = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/relationships/$($Context.V12Relationship.id)/suspend" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke proves relationship suspension audit path"
}
Assert-Equal -Actual $Context.V12Relationship.status -Expected "SUSPENDED" -Message "V12 relationship was not suspended."
$Context.V12Relationship = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/relationships/$($Context.V12Relationship.id)/reactivate" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke proves relationship reactivation audit path"
}
Assert-Equal -Actual $Context.V12Relationship.status -Expected "ACTIVE" -Message "V12 relationship was not reactivated."
$Context.V12Relationship = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/merchant-warehouse/relationships/$($Context.V12Relationship.id)/end" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke proves relationship end audit path"
}
Assert-Equal -Actual $Context.V12Relationship.status -Expected "ENDED" -Message "V12 relationship was not ended."

Write-Host "12d. Verifying access-request conversion into onboarding work"
$Context.V12AccessRequest = Invoke-Json -Context $Context -Method Post -Path "/api/v1/access-requests" -Body @{
    organizationName = "V12 Onboarding Merchant $($Context.Suffix)"
    requesterEmail = "onboarding-$($Context.Suffix)@merhouse.local"
    requestedRole = "MERCHANT"
    notes = "V12 conversion smoke path"
}
$Context.V12AccessRequest = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/access-requests/$($Context.V12AccessRequest.id)/approve" -Headers $Context.AdminHeaders -Body @{
    reviewNote = "Approved for V12 conversion smoke"
}
$Context.V12ConvertedAccessRequest = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/access-requests/$($Context.V12AccessRequest.id)/convert" -Headers $Context.AdminHeaders -Body @{
    tenantName = "V12 Converted Merchant $($Context.Suffix)"
    temporaryPassword = "converted-local-password"
    reason = "Smoke proves approved request conversion"
}
Assert-NotBlank -Value $Context.V12ConvertedAccessRequest.convertedTenantId -Message "V12 conversion did not link a tenant."
Assert-NotBlank -Value $Context.V12ConvertedAccessRequest.convertedUserId -Message "V12 conversion did not link a user."
$Context.V12ConvertedLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.V12AccessRequest.requesterEmail
    password = "converted-local-password"
}
Assert-Equal -Actual $Context.V12ConvertedLogin.user.id -Expected $Context.V12ConvertedAccessRequest.convertedUserId -Message "V12 converted user could not log in."

Write-Host "12e. Verifying user recovery and role safety controls"
$Context.V12RecoveredUser = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/admin/users/$($Context.DisabledUser.id)/enable" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke proves user re-enable recovery"
}
Assert-Equal -Actual $Context.V12RecoveredUser.enabled -Expected $true -Message "V12 user re-enable failed."
$Context.DisabledUser = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/admin/users/$($Context.DisabledUser.id)/disable" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke restores disabled-user fixture"
}
Assert-Equal -Actual $Context.DisabledUser.enabled -Expected $false -Message "V12 disabled-user fixture was not restored."
$Context.V12PasswordResetUser = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/admin/users/$($Context.MerchantUser.id)/password" -Headers $Context.AdminHeaders -Body @{
    newPassword = "merchant-password"
    reason = "Smoke proves admin-assisted password reset"
}
Assert-Equal -Actual $Context.V12PasswordResetUser.id -Expected $Context.MerchantUser.id -Message "V12 password reset returned the wrong user."
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/admin/users/$($Context.AdminLogin.user.id)/role" -Headers $Context.AdminHeaders -ExpectedStatus 409 -Body @{
    role = "ADMIN"
    reason = "Smoke self-demotion safety check"
}

Write-Host "12f. Verifying outbox diagnostics and audit explorer"
$recentOutboxEvents = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/outbox/events?limit=25" -Headers $Context.AdminHeaders
$pendingOutboxEvent = @($recentOutboxEvents | Where-Object { $_.status -ne "PROCESSED" } | Select-Object -First 1)
if (-not $pendingOutboxEvent) {
    throw "V12 outbox diagnostic smoke did not find a non-processed event."
}
Assert-NotBlank -Value $pendingOutboxEvent.id -Message "V12 outbox diagnostic smoke found a non-processed event without an id."
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/admin/outbox/events/$($pendingOutboxEvent.id)/retry" -Headers $Context.AdminHeaders -ExpectedStatus 409
$Context.V12DeadLetterEvent = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/outbox/events/$($pendingOutboxEvent.id)/dead-letter" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke moves one diagnostic event to dead letter"
}
Assert-Equal -Actual $Context.V12DeadLetterEvent.status -Expected "DEAD_LETTER" -Message "V12 outbox event was not dead-lettered."
$Context.V12AuditEvents = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/control/audit-events?limit=25" -Headers $Context.AdminHeaders
$auditRows = @($Context.V12AuditEvents | Where-Object { $_.action -in @("TENANT_SUSPENDED", "RELATIONSHIP_SUSPENDED", "ACCESS_REQUEST_CONVERTED") })
if ($auditRows.Count -lt 3) {
    throw "V12 audit explorer did not include expected privileged action rows."
}

Write-Host "12g. Verifying lower-admin and auditor governance boundaries"
$Context.V12SupportAdminUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Headers $Context.AdminHeaders -Body @{
    tenantId = $Context.WarehouseProvider.id
    email = "support-$($Context.Suffix)@merhouse.local"
    password = "support-admin-password"
    role = "SUPPORT_ADMIN"
}
$Context.V12AuditorUser = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/users" -Headers $Context.AdminHeaders -Body @{
    tenantId = $Context.WarehouseProvider.id
    email = "auditor-$($Context.Suffix)@merhouse.local"
    password = "auditor-password"
    role = "AUDITOR"
}
$Context.V12SupportAdminLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.V12SupportAdminUser.email
    password = "support-admin-password"
}
$Context.V12AuditorLogin = Invoke-Json -Context $Context -Method Post -Path "/api/v1/auth/login" -Body @{
    email = $Context.V12AuditorUser.email
    password = "auditor-password"
}
$supportHeaders = @{ Authorization = "Bearer $($Context.V12SupportAdminLogin.accessToken)" }
$auditorHeaders = @{ Authorization = "Bearer $($Context.V12AuditorLogin.accessToken)" }

$supportSummary = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/control/summary" -Headers $supportHeaders
Assert-NotBlank -Value $supportSummary.tenants -Message "Support admin could not read platform summary."
$auditorAudit = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/control/audit-events?limit=5" -Headers $auditorHeaders
Assert-Equal -Actual (@($auditorAudit).Count -ge 1) -Expected $true -Message "Auditor could not read audit events."

Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/tenants" -Headers $supportHeaders -ExpectedStatus 403 -Body @{
    name = "Blocked Support Tenant $($Context.Suffix)"
    type = "MERCHANT"
}
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/access-requests/$($Context.V12AccessRequest.id)/reject" -Headers $supportHeaders -ExpectedStatus 403 -Body @{
    reviewNote = "Support admin should not mutate access request decisions"
}
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/admin/outbox/process?limit=1" -Headers $auditorHeaders -ExpectedStatus 403
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/merchant-warehouse/relationships/$($Context.MerchantWarehouseRelationship.id)/suspend" -Headers $auditorHeaders -ExpectedStatus 403 -Body @{
    reason = "Auditor should not mutate relationship governance"
}
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/orders" -Headers $supportHeaders -ExpectedStatus 403 -Body @{
    merchantId = $Context.Merchant.id
    customerAddress = "Blocked Support Admin Customer, Cairo"
    items = @(@{ inventoryItemId = $Context.Item.id; quantity = 1 })
}
$Context.V12SupportResetUser = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/admin/users/$($Context.MerchantUser.id)/password" -Headers $supportHeaders -Body @{
    newPassword = "merchant-password"
    reason = "Support admin recovery boundary"
}
Assert-Equal -Actual $Context.V12SupportResetUser.id -Expected $Context.MerchantUser.id -Message "Support admin could not reset an ordinary user."
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/admin/users/$($Context.MerchantUser.id)/password" -Headers $auditorHeaders -ExpectedStatus 409 -Body @{
    newPassword = "merchant-password"
    reason = "Auditor should not recover users"
}
