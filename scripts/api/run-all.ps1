param(
    [string]$BaseUrl = "",
    [string]$OutputPath = "",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [switch]$ExpectRecoveryToken,
    [switch]$ExpectOpenApiDocs = $true,
    [string]$FirebaseEmulatorHost = "",
    [string]$FirebaseApiKey = ""
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$apiRoot = $PSScriptRoot
$projectRoot = Get-MerHouseProjectRoot
$reportsDir = Join-Path $projectRoot "reports"

. (Join-Path $projectRoot "scripts\proof\lib\url-guard-lib.ps1")

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = Get-MerHouseDefaultBaseUrl
}

$normalizedBaseUrl = Assert-AbsoluteHttpUrl -Name "BaseUrl" -Value $BaseUrl

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = Join-Path $reportsDir "api-smoke-test-$timestamp.json"
}
$summaryPath = [System.IO.Path]::ChangeExtension($OutputPath, ".summary.md")

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null

. (Join-Path $apiRoot "lib\assertions.ps1")
. (Join-Path $apiRoot "lib\http.ps1")
. (Join-Path $apiRoot "lib\postgres.ps1")
. (Join-Path $apiRoot "lib\report.ps1")

if ([string]::IsNullOrWhiteSpace($FirebaseEmulatorHost)) {
    $FirebaseEmulatorHost = Get-MerHouseEnvValue -Name 'VITE_FIREBASE_EMULATOR_HOST'
}
if ([string]::IsNullOrWhiteSpace($FirebaseApiKey)) {
    $FirebaseApiKey = Get-MerHouseEnvValue -Name 'VITE_FIREBASE_API_KEY'
}
if ([string]::IsNullOrWhiteSpace($FirebaseApiKey)) {
    $FirebaseApiKey = "emulator-api-key"
}

$context = @{
    BaseUrl = $normalizedBaseUrl
    OutputPath = $OutputPath
    Suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
    AdminEmail = $AdminEmail
    AdminPassword = $AdminPassword
    ExpectRecoveryToken = [bool]$ExpectRecoveryToken
    ExpectOpenApiDocs = [bool]$ExpectOpenApiDocs
    FirebaseEmulatorHost = $FirebaseEmulatorHost
    FirebaseApiKey = $FirebaseApiKey
}

Write-Host "Running MerHouse API smoke test against $normalizedBaseUrl"
if ($FirebaseEmulatorHost) {
    Write-Host "Firebase Auth emulator: $FirebaseEmulatorHost"
} else {
    Write-Host "Firebase Auth: production (identitytoolkit.googleapis.com)"
}

. (Join-Path $apiRoot "scenarios\00-auth-admin.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\01-inventory.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\02-admin-auth.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\03-merchant-warehouse-loop.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\04-service-accountability.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\05-admin-control-plane.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\06-order-allocation.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\07-cancellation.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\08-concurrency.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\09-shipment-lifecycle.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\10-operational-details.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\11-reliability.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\12-backorder-status.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\13-outbox-processing.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\14-auth-recovery-access.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\15-api-boundary-assurance.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\16-assistant-operations.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\17-login-rate-limit.ps1") -Context $context
. (Join-Path $apiRoot "scenarios\18-health-endpoint.ps1") -Context $context

$report = New-SmokeReport -Context $context
$report | ConvertTo-Json -Depth 12 | Set-Content -Path $OutputPath -Encoding UTF8
$summary = New-SmokeSummary -Context $context -Report $report
$summary | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host ""
Write-Host "API smoke test passed."
Write-Host "Tenant:    $($context.Merchant.id)"
Write-Host "Warehouse: $($context.Warehouse.id)"
Write-Host "Item:      $($context.Item.id)"
Write-Host "Order:     $($context.Order.id)"
Write-Host "Summary:   $summaryPath"
Write-Host "Full JSON: $OutputPath"
