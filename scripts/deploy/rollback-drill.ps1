param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".env.production",
    [string]$OutputPath = "",
    [string]$FrontendBaseUrl = "",
    [string]$ApiBaseUrl = "",
    [int]$MonitoringSamples = 3,
    [switch]$AllowLocalHttpRehearsal,
    [switch]$ConfirmRollbackDrill
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmRollbackDrill) {
    throw "Rollback rehearsal changes the selected deployment stack. Re-run with -ConfirmRollbackDrill only against staging, drill, or an explicitly selected production rollback window."
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$composePath = if ([System.IO.Path]::IsPathRooted($ComposeFile)) {
    [System.IO.Path]::GetFullPath($ComposeFile)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ComposeFile))
}
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    [System.IO.Path]::GetFullPath($EnvFile)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $EnvFile))
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\v17-rollback-rehearsal-$timestamp.json"
}
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
}

if (-not (Test-Path $composePath)) {
    throw "Compose file was not found: $composePath"
}
if (-not (Test-Path $envPath)) {
    throw "Deployment env file was not found: $envPath"
}
if ((Split-Path $envPath -Leaf) -eq "env.production.example") {
    throw "Refusing to rehearse rollback with the example env template. Use an ignored private env file."
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

$monitoringReportPath = $null
$monitoringRan = $false
$normalizedFrontendBaseUrl = ""
$normalizedApiBaseUrl = ""

Write-Host "Auditing rollback deployment env..."
$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "env-audit.ps1") -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Rollback rehearsal env audit failed."
}

Write-Host "Checking rollback Compose shape..."
$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "vps-check.ps1") -ComposeFile $composePath -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Rollback rehearsal VPS shape check failed."
}

Write-Host "Running confirmed Compose rollback/up..."
$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "rollback-compose.ps1") -ComposeFile $composePath -EnvFile $envPath -ConfirmRollback
if ($LASTEXITCODE -ne 0) {
    throw "Rollback command failed."
}

if (-not [string]::IsNullOrWhiteSpace($FrontendBaseUrl) -or -not [string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
    if ([string]::IsNullOrWhiteSpace($FrontendBaseUrl) -or [string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
        throw "Both -FrontendBaseUrl and -ApiBaseUrl are required when running post-rollback monitoring proof."
    }

    . (Join-Path $projectRoot "scripts\quality\url-guard-lib.ps1")
    $normalizedFrontendBaseUrl = Assert-AbsoluteHttpUrl -Name "FrontendBaseUrl" -Value $FrontendBaseUrl
    $normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
    if (-not $AllowLocalHttpRehearsal -and (-not $normalizedFrontendBaseUrl.StartsWith("https://") -or -not $normalizedApiBaseUrl.StartsWith("https://"))) {
        throw "Rollback rehearsal monitoring targets must be HTTPS deployment URLs."
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $monitoringReportPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot ".\reports\v17-rollback-monitoring-$timestamp.json"))
    $global:LASTEXITCODE = 0
    & (Join-Path $projectRoot "scripts\quality\deployed-monitoring-proof.ps1") `
        -FrontendBaseUrl $normalizedFrontendBaseUrl `
        -ApiBaseUrl $normalizedApiBaseUrl `
        -Samples $MonitoringSamples `
        -OutputPath $monitoringReportPath `
        -AllowLocalHttpRehearsal:$AllowLocalHttpRehearsal
    if ($LASTEXITCODE -ne 0) {
        throw "Post-rollback monitoring proof failed."
    }
    $monitoringRan = $true
}

$commitSha = (git -C $projectRoot rev-parse HEAD).Trim()
$manifest = [ordered]@{
    schema = "merhouse.v17.rollback-rehearsal.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = $commitSha
    composeFile = $composePath
    envFileName = Split-Path $envPath -Leaf
    rollbackRan = $true
    preflight = [ordered]@{
        envAudit = "passed"
        vpsShape = "passed"
    }
    postRollbackMonitoring = [ordered]@{
        ran = $monitoringRan
        frontendBaseUrl = $normalizedFrontendBaseUrl
        apiBaseUrl = $normalizedApiBaseUrl
        samples = if ($monitoringRan) { $MonitoringSamples } else { 0 }
        reportPath = $monitoringReportPath
        localHttpRehearsal = [bool]$AllowLocalHttpRehearsal
    }
    secretPolicy = "Private env values, provider credentials, deployment logs, keystores, and backup archives are excluded from this manifest."
    remainingProductionProof = @(
        "Run this rehearsal against staging or a deliberate production rollback window.",
        "Attach deployed monitoring proof, API smoke, browser proof, and live stakeholder checks before declaring rollback readiness."
    )
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8
Write-Host "Rollback rehearsal manifest: $resolvedOutputPath"
Write-Host "Rollback rehearsal proof completed."
