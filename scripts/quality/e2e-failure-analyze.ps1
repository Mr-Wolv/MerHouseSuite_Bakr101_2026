<#
.SYNOPSIS
    Parses E2E test log output and categorizes failures by root cause.
.DESCRIPTION
    Reads an E2E report log file, matches error lines against known patterns
    (selector, timeout, API, auth, state, UI), and writes a categorized markdown analysis.
    Defaults to the most recent e2e-report-*.log in the reports directory.
.PARAMETER LogPath
    Path to the E2E test log file. When empty, uses the most recent log.
#>
param(
    [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$reportsDir = Join-Path $projectRoot "reports"

if ([string]::IsNullOrWhiteSpace($LogPath)) {
    $latestReport = Get-ChildItem -Path $reportsDir -Filter "e2e-report-*.log" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($null -eq $latestReport) {
        throw "No E2E report logs found in $reportsDir. Run e2e-report.ps1 first."
    }
    $LogPath = $latestReport.FullName
}

if (-not (Test-Path -LiteralPath $LogPath)) {
    throw "Log file not found: $LogPath"
}

Write-Host "Analyzing: $LogPath"
Write-Host ""

$content = Get-Content -LiteralPath $LogPath -Raw
$lines = $content -split "`n"

$categories = @{
    "auth" = @()
    "selector" = @()
    "timeout" = @()
    "api" = @()
    "state" = @()
    "ui" = @()
    "unknown" = @()
}

$currentTest = ""
foreach ($line in $lines) {
    if ($line -match "^\s*(?:×|✘|FAIL)\s+(.+?)\s*$") {
        $currentTest = $Matches[1].Trim()
    }
    if ($line -match "Error:" -and -not [string]::IsNullOrWhiteSpace($currentTest)) {
        $errorText = $line.Trim()
        $entry = @{ test = $currentTest; error = $errorText }

        if ($errorText -match "selector|locator|getByRole|getByText|strict mode|visible") {
            $categories["selector"] += $entry
        } elseif ($errorText -match "timeout|timed out|waitForTimeout") {
            $categories["timeout"] += $entry
        } elseif ($errorText -match "HTTP|status|401|403|404|500|api") {
            $categories["api"] += $entry
        } elseif ($errorText -match "token|login|auth|localStorage|session") {
            $categories["auth"] += $entry
        } elseif ($errorText -match "status|state|PENDING|ALLOCATED|CANCELLED") {
            $categories["state"] += $entry
        } elseif ($errorText -match "render|display|UI|component") {
            $categories["ui"] += $entry
        } else {
            $categories["unknown"] += $entry
        }
    }
}

$report = @(
    "# E2E Failure Analysis"
    ""
    "- **Log:** ``$LogPath``"
    "- **Analyzed:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    ""
)

$hasAny = $false
foreach ($cat in @("selector", "timeout", "api", "auth", "state", "ui", "unknown")) {
    $entries = $categories[$cat]
    if ($entries.Count -gt 0) {
        $hasAny = $true
        $report += "## $($cat.ToUpper()) ($($entries.Count))"
        $report += ""
        foreach ($e in $entries) {
            $report += "- **$($e.test)**"
            $report += "  ``$($e.error)``"
        }
        $report += ""
    }
}

if (-not $hasAny) {
    $report += "No categorizable failures found. Check the log manually."
    $report += ""
}

$analysisPath = Join-Path $reportsDir "e2e-analysis-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"
$report -join [Environment]::NewLine | Set-Content -Path $analysisPath -Encoding UTF8

Write-Host $report -join [Environment]::NewLine
Write-Host ""
Write-Host "Analysis saved: $analysisPath"
