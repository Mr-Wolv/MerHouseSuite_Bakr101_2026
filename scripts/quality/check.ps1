param(
    [switch]$IncludeE2E,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipCompose
)

$ErrorActionPreference = "Stop"

if (-not $SkipBackend) {
    & (Join-Path $PSScriptRoot "backend-check.ps1")
}

if (-not $SkipFrontend) {
    & (Join-Path $PSScriptRoot "frontend-check.ps1") -SkipInstall -IncludeE2E:$IncludeE2E
}

& (Join-Path $PSScriptRoot "pwa-check.ps1")
& (Join-Path $PSScriptRoot "markdown-check.ps1")
& (Join-Path $PSScriptRoot "public-readiness.ps1") -SkipCompose:$SkipCompose

Write-Host ""
Write-Host "MerHouse local quality check passed."
