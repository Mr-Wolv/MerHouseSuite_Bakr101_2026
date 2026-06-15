<#
.SYNOPSIS
    Orchestrates all QC checks and generates a combined report.
.DESCRIPTION
    Runs backend tests, frontend lint/build/tests, API smoke, E2E tests, and markdown
    validation in sequence. Each check is timed and the result is recorded. Writes a
    combined markdown report to the reports directory.
.PARAMETER SkipBackend
    Skip the backend Maven test check.
.PARAMETER SkipFrontend
    Skip the frontend lint, build, and Vitest check.
.PARAMETER SkipE2E
    Skip the Playwright E2E test suite.
.PARAMETER SkipAPISmoke
    Skip the API smoke test suite.
.PARAMETER SkipMarkdown
    Skip the markdown link validation.
.PARAMETER IncludeMobile
    Include the shared mobile shell metadata check.
#>
param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipE2E,
    [switch]$SkipAPISmoke,
    [switch]$SkipMarkdown,
    [switch]$IncludeMobile
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$reportsDir = Join-Path $projectRoot "reports"
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$combinedReport = Join-Path $reportsDir "full-qc-$timestamp.md"
$startTime = Get-Date
$results = @()

function Add-Result {
    param([string]$Name, [string]$Status, [string]$Detail = "")
    $script:results += [ordered]@{
        name = $Name
        status = $Status
        detail = $Detail
        duration = ""
    }
}

Write-Host "============================================"
Write-Host " MerHouse Full QC Check"
Write-Host " Started: $(Get-Date -Format 'HH:mm:ss')"
Write-Host "============================================"
Write-Host ""

# Backend
if (-not $SkipBackend) {
    Write-Host "--- Backend ---"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & (Join-Path $PSScriptRoot "backend-check.ps1")
        $sw.Stop()
        Add-Result "Backend" "PASS" "Tests passed in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
    } catch {
        $sw.Stop()
        Add-Result "Backend" "FAIL" $_.Exception.Message
        Write-Host "Backend check failed: $($_.Exception.Message)"
    }
    Write-Host ""
}

# Frontend (unit + lint + build)
if (-not $SkipFrontend) {
    Write-Host "--- Frontend ---"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & (Join-Path $PSScriptRoot "frontend-check.ps1") -SkipInstall
        $sw.Stop()
        Add-Result "Frontend" "PASS" "Lint, build, and tests passed in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
    } catch {
        $sw.Stop()
        Add-Result "Frontend" "FAIL" $_.Exception.Message
        Write-Host "Frontend check failed: $($_.Exception.Message)"
    }
    Write-Host ""
}

# API Smoke
if (-not $SkipAPISmoke) {
    Write-Host "--- API Smoke ---"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & (Join-Path $PSScriptRoot "api-smoke.ps1")
        $sw.Stop()
        Add-Result "API Smoke" "PASS" "All scenarios passed in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
    } catch {
        $sw.Stop()
        Add-Result "API Smoke" "FAIL" $_.Exception.Message
        Write-Host "API smoke failed: $($_.Exception.Message)"
    }
    Write-Host ""
}

# E2E
if (-not $SkipE2E) {
    Write-Host "--- E2E Tests ---"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & (Join-Path $PSScriptRoot "e2e-report.ps1") -SkipInstall
        $sw.Stop()
        Add-Result "E2E Tests" "PASS" "All E2E tests passed in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
    } catch {
        $sw.Stop()
        Add-Result "E2E Tests" "FAIL" $_.Exception.Message
        Write-Host "E2E tests failed: $($_.Exception.Message)"
    }
    Write-Host ""
}

# Markdown
if (-not $SkipMarkdown) {
    Write-Host "--- Markdown ---"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & (Join-Path $PSScriptRoot "markdown-check.ps1")
        $sw.Stop()
        Add-Result "Markdown" "PASS" "All links valid in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
    } catch {
        $sw.Stop()
        Add-Result "Markdown" "FAIL" $_.Exception.Message
        Write-Host "Markdown check failed: $($_.Exception.Message)"
    }
    Write-Host ""
}

# Mobile
if ($IncludeMobile) {
    Write-Host "--- Mobile ---"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & (Join-Path $PSScriptRoot "..\proof\android\mobile-shell-check.ps1")
        $sw.Stop()
        Add-Result "Mobile" "PASS" "Mobile checks passed in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
    } catch {
        $sw.Stop()
        Add-Result "Mobile" "FAIL" $_.Exception.Message
        Write-Host "Mobile check failed: $($_.Exception.Message)"
    }
    Write-Host ""
}

$totalDuration = (Get-Date) - $startTime
$passCount = @($results | Where-Object { $_.status -eq "PASS" }).Count
$failCount = @($results | Where-Object { $_.status -eq "FAIL" }).Count
$overallStatus = if ($failCount -eq 0) { "PASSED" } else { "FAILED" }

$md = @(
    "# MerHouse Full QC Report"
    ""
    "- **Status:** $overallStatus"
    "- **Generated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    "- **Duration:** $([math]::Round($totalDuration.TotalMinutes, 1)) minutes"
    "- **Passed:** $passCount | **Failed:** $failCount"
    ""
    "## Results"
    ""
    "| Check | Status | Detail |"
    "| --- | --- | --- |"
)
foreach ($r in $results) {
    $md += "| $($r.name) | $($r.status) | $($r.detail) |"
}
$md += ""
$md -join [Environment]::NewLine | Set-Content -Path $combinedReport -Encoding UTF8

Write-Host "============================================"
Write-Host " MerHouse QC: $overallStatus ($passCount/$($results.Count) passed)"
Write-Host " Duration: $([math]::Round($totalDuration.TotalMinutes, 1)) minutes"
Write-Host " Report: $combinedReport"
Write-Host "============================================"

if ($failCount -gt 0) {
    exit 1
}
