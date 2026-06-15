<#
.SYNOPSIS
    Runs Playwright E2E tests and generates timestamped markdown + JSON reports.
.DESCRIPTION
    Executes the Playwright test suite against the local frontend, parses pass/fail results,
    and writes a markdown summary, JSON data, and raw log to the reports directory.
.PARAMETER Filter
    Optional Playwright test file path or grep pattern to run a subset of tests.
.PARAMETER IncludeAll
    When set, runs all tests under tests/e2e/.
.PARAMETER SkipInstall
    When set, skips npm install even if node_modules is missing.
.PARAMETER OutputDir
    Override the reports output directory. Defaults to <project>/reports.
.PARAMETER TimeoutSeconds
    Maximum seconds to allow the test run. Default: 600.
#>
param(
    [string]$Filter = "",
    [switch]$IncludeAll,
    [switch]$SkipInstall,
    [string]$OutputDir = "",
    [int]$TimeoutSeconds = 600
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$frontendRoot = Join-Path $projectRoot "frontend"
$reportsDir = if ([string]::IsNullOrWhiteSpace($OutputDir)) { Join-Path $projectRoot "reports" } else { $OutputDir }

New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $reportsDir "e2e-report-$timestamp.md"
$jsonPath = Join-Path $reportsDir "e2e-report-$timestamp.json"
$logPath = Join-Path $reportsDir "e2e-report-$timestamp.log"

Write-Host "Running E2E tests..."
Write-Host "Frontend: $frontendRoot"
Write-Host "Report: $reportPath"
Write-Host ""

Push-Location $frontendRoot
try {
    if (-not $SkipInstall -and -not (Test-Path (Join-Path $frontendRoot "node_modules"))) {
        Write-Host "Installing dependencies..."
        npm install
    }

    $testArgs = @("playwright", "test")
    if ($IncludeAll) {
        $testArgs += "tests/e2e/"
    } elseif (-not [string]::IsNullOrWhiteSpace($Filter)) {
        $testArgs += $Filter
    } else {
        $testArgs += "tests/e2e/"
    }
    $testArgs += "--reporter=list"

    Write-Host "Executing: npx $($testArgs -join ' ')"
    $output = & npx @testArgs 2>&1 | Out-String
    $exitCode = $LASTEXITCODE

    $output | Set-Content -Path $logPath -Encoding UTF8

    $passed = 0
    $failed = 0
    $skipped = 0
    $failedTests = @()

    $lines = $output -split "`n"
    foreach ($line in $lines) {
        if ($line -match "(\d+)\s+passed") {
            $passed = [int]$Matches[1]
        }
        if ($line -match "(\d+)\s+failed") {
            $failed = [int]$Matches[1]
        }
        if ($line -match "(\d+)\s+skipped") {
            $skipped = [int]$Matches[1]
        }
        if ($line -match "^\s*(?:×|✘|FAIL)\s+(.+?)\s*$") {
            $failedTests += $Matches[1].Trim()
        }
    }

    $total = $passed + $failed + $skipped
    $passRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }
    $status = if ($failed -eq 0) { "PASSED" } else { "FAILED" }

    $report = [ordered]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString("o")
        status = $status
        total = $total
        passed = $passed
        failed = $failed
        skipped = $skipped
        passRate = "$passRate%"
        filter = $Filter
        failedTestNames = $failedTests
    }
    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $jsonPath -Encoding UTF8

    $md = @(
        "# E2E Test Report"
        ""
        "- **Status:** $status"
        "- **Generated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        "- **Total:** $total | **Passed:** $passed | **Failed:** $failed | **Skipped:** $skipped"
        "- **Pass Rate:** $passRate%"
        ""
    )

    if ($failedTests.Count -gt 0) {
        $md += "## Failed Tests"
        $md += ""
        foreach ($t in $failedTests) {
            $md += "- $t"
        }
        $md += ""
    }

    $md += "## Log"
    $md += ""
    $md += "Full output saved to: ``$logPath``"
    $md += ""
    $md -join [Environment]::NewLine | Set-Content -Path $reportPath -Encoding UTF8

    Write-Host ""
    Write-Host "E2E Report: $status ($passed/$total passed, $passRate%)"
    Write-Host "Report: $reportPath"
    Write-Host "JSON: $jsonPath"

    if ($failed -gt 0) {
        Write-Host ""
        Write-Host "Failed tests:"
        foreach ($t in $failedTests) {
            Write-Host "  - $t"
        }
        exit 1
    }
} finally {
    Pop-Location
}
