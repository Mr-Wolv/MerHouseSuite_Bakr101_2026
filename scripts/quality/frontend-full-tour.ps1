param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$ApiUrl = $BaseUrl,
    [string]$OutputPath = ".\reports\latest-frontend-full-tour.json",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [string]$MerchantEmail = "review.merchant@merhouse.local",
    [string]$MerchantPassword = "review-password",
    [string]$WarehouseEmail = "review.operator@merhouse.local",
    [string]$WarehousePassword = "review-password",
    [string]$SupportAdminEmail = "review.support@merhouse.local",
    [string]$SupportAdminPassword = "review-password",
    [string]$AuditorEmail = "review.auditor@merhouse.local",
    [string]$AuditorPassword = "review-password"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$frontendRoot = Join-Path $projectRoot "frontend"
$packageJson = Join-Path $frontendRoot "package.json"

if (-not (Test-Path $packageJson)) {
    throw "Frontend package.json was not found at $packageJson."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found on PATH. Install Node.js or add npm to PATH before running the frontend tour."
}

$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
} else {
    Join-Path $projectRoot $OutputPath
}

$previousBaseUrl = $env:FRONTEND_TOUR_BASE_URL
$previousApiUrl = $env:E2E_API_URL
$previousReport = $env:FRONTEND_TOUR_REPORT
$previousAdminEmail = $env:FRONTEND_TOUR_ADMIN_EMAIL
$previousAdminPassword = $env:FRONTEND_TOUR_ADMIN_PASSWORD
$previousMerchantEmail = $env:FRONTEND_TOUR_MERCHANT_EMAIL
$previousMerchantPassword = $env:FRONTEND_TOUR_MERCHANT_PASSWORD
$previousWarehouseEmail = $env:FRONTEND_TOUR_WAREHOUSE_EMAIL
$previousWarehousePassword = $env:FRONTEND_TOUR_WAREHOUSE_PASSWORD
$previousSupportAdminEmail = $env:FRONTEND_TOUR_SUPPORT_ADMIN_EMAIL
$previousSupportAdminPassword = $env:FRONTEND_TOUR_SUPPORT_ADMIN_PASSWORD
$previousAuditorEmail = $env:FRONTEND_TOUR_AUDITOR_EMAIL
$previousAuditorPassword = $env:FRONTEND_TOUR_AUDITOR_PASSWORD

Push-Location $frontendRoot
try {
    $env:FRONTEND_TOUR_BASE_URL = $BaseUrl.TrimEnd("/")
    $env:E2E_API_URL = $ApiUrl.TrimEnd("/")
    $env:FRONTEND_TOUR_REPORT = $resolvedOutputPath
    $env:FRONTEND_TOUR_ADMIN_EMAIL = $AdminEmail
    $env:FRONTEND_TOUR_ADMIN_PASSWORD = $AdminPassword
    $env:FRONTEND_TOUR_MERCHANT_EMAIL = $MerchantEmail
    $env:FRONTEND_TOUR_MERCHANT_PASSWORD = $MerchantPassword
    $env:FRONTEND_TOUR_WAREHOUSE_EMAIL = $WarehouseEmail
    $env:FRONTEND_TOUR_WAREHOUSE_PASSWORD = $WarehousePassword
    $env:FRONTEND_TOUR_SUPPORT_ADMIN_EMAIL = $SupportAdminEmail
    $env:FRONTEND_TOUR_SUPPORT_ADMIN_PASSWORD = $SupportAdminPassword
    $env:FRONTEND_TOUR_AUDITOR_EMAIL = $AuditorEmail
    $env:FRONTEND_TOUR_AUDITOR_PASSWORD = $AuditorPassword

    Write-Host "Running full frontend route tour against $BaseUrl"
    npm exec -- playwright test tests/e2e/full-tour.spec.ts --project=chromium
    if ($LASTEXITCODE -ne 0) {
        throw "Full frontend route tour failed."
    }
} finally {
    $env:FRONTEND_TOUR_BASE_URL = $previousBaseUrl
    $env:E2E_API_URL = $previousApiUrl
    $env:FRONTEND_TOUR_REPORT = $previousReport
    $env:FRONTEND_TOUR_ADMIN_EMAIL = $previousAdminEmail
    $env:FRONTEND_TOUR_ADMIN_PASSWORD = $previousAdminPassword
    $env:FRONTEND_TOUR_MERCHANT_EMAIL = $previousMerchantEmail
    $env:FRONTEND_TOUR_MERCHANT_PASSWORD = $previousMerchantPassword
    $env:FRONTEND_TOUR_WAREHOUSE_EMAIL = $previousWarehouseEmail
    $env:FRONTEND_TOUR_WAREHOUSE_PASSWORD = $previousWarehousePassword
    $env:FRONTEND_TOUR_SUPPORT_ADMIN_EMAIL = $previousSupportAdminEmail
    $env:FRONTEND_TOUR_SUPPORT_ADMIN_PASSWORD = $previousSupportAdminPassword
    $env:FRONTEND_TOUR_AUDITOR_EMAIL = $previousAuditorEmail
    $env:FRONTEND_TOUR_AUDITOR_PASSWORD = $previousAuditorPassword
    Pop-Location
}

Write-Host "Frontend tour report: $resolvedOutputPath"
