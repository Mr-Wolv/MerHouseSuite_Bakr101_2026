param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$ApiUrl = $BaseUrl,
    [string]$OutputPath = ".\reports\latest-frontend-ui-input-tour.json",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$frontendRoot = Join-Path $projectRoot "frontend"
$packageJson = Join-Path $frontendRoot "package.json"

if (-not (Test-Path $packageJson)) {
    throw "Frontend package.json was not found at $packageJson."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found on PATH. Install Node.js or add npm to PATH before running the frontend UI input tour."
}

. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

$normalizedBaseUrl = Assert-AbsoluteHttpUrl -Name "BaseUrl" -Value $BaseUrl
$normalizedApiUrl = Assert-AbsoluteHttpUrl -Name "ApiUrl" -Value $ApiUrl

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    throw "OutputPath must be a non-blank report path."
}

$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

$previousBaseUrl = $env:FRONTEND_TOUR_BASE_URL
$previousApiUrl = $env:E2E_API_URL
$previousReport = $env:FRONTEND_TOUR_REPORT
$previousAdminEmail = $env:FRONTEND_TOUR_ADMIN_EMAIL
$previousAdminPassword = $env:FRONTEND_TOUR_ADMIN_PASSWORD

Push-Location $frontendRoot
try {
    $env:FRONTEND_TOUR_BASE_URL = $normalizedBaseUrl
    $env:E2E_API_URL = $normalizedApiUrl
    $env:FRONTEND_TOUR_REPORT = $resolvedOutputPath
    $env:FRONTEND_TOUR_ADMIN_EMAIL = $AdminEmail
    $env:FRONTEND_TOUR_ADMIN_PASSWORD = $AdminPassword

    Write-Host "Frontend UI input tour app URL: $normalizedBaseUrl"
    Write-Host "Frontend UI input tour API URL: $normalizedApiUrl"
    Write-Host "Frontend UI input tour report: $resolvedOutputPath"
    Write-Host "Running frontend UI input tour against $normalizedBaseUrl"
    npm exec -- playwright test tests/e2e/full-tour.spec.ts --project=chromium --grep "public auth UI input"
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend UI input tour failed."
    }
} finally {
    $env:FRONTEND_TOUR_BASE_URL = $previousBaseUrl
    $env:E2E_API_URL = $previousApiUrl
    $env:FRONTEND_TOUR_REPORT = $previousReport
    $env:FRONTEND_TOUR_ADMIN_EMAIL = $previousAdminEmail
    $env:FRONTEND_TOUR_ADMIN_PASSWORD = $previousAdminPassword
    Pop-Location
}

Write-Host "Frontend UI input tour report: $resolvedOutputPath"
