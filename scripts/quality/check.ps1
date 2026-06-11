param(
    [switch]$IncludeE2E,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipMobile,
    [switch]$SkipCompose,
    [string]$NativeApiBaseUrl = "http://10.0.2.2:8080"
)

$ErrorActionPreference = "Stop"

if (-not $SkipBackend) {
    & (Join-Path $PSScriptRoot "backend-check.ps1")
}

if (-not $SkipFrontend) {
    & (Join-Path $PSScriptRoot "frontend-check.ps1") -SkipInstall -IncludeE2E:$IncludeE2E
}

if (-not $SkipMobile) {
    & (Join-Path $PSScriptRoot "..\proof\android\mobile-shell-check.ps1")
    & (Join-Path $PSScriptRoot "..\proof\android\native-mobile-check.ps1") -Sync -ApiBaseUrl $NativeApiBaseUrl
}
& (Join-Path $PSScriptRoot "markdown-check.ps1")
& (Join-Path $PSScriptRoot "public-readiness.ps1") -SkipCompose:$SkipCompose

Write-Host ""
Write-Host "MerHouse local quality check passed."
