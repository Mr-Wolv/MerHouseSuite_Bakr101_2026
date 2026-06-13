[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [int]$KeepLatest = 10,
    [int]$OlderThanDays = 0,
    [switch]$IncludeLogs,
    [switch]$IncludeScreenshots
)

$ErrorActionPreference = "Stop"

if ($KeepLatest -lt 0) {
    throw "-KeepLatest must be 0 or greater."
}
if ($OlderThanDays -lt 0) {
    throw "-OlderThanDays must be 0 or greater."
}

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$reportsDir = Join-Path $projectRoot "reports"

if (-not (Test-Path -LiteralPath $reportsDir)) {
    Write-Host "No reports directory found at $reportsDir"
    return
}

$candidates = New-Object System.Collections.Generic.List[System.IO.FileSystemInfo]
$timestampPattern = "^api-smoke-test-(\d{8}-\d{6})(\.summary\.md|\.json)$"
$cutoff = if ($OlderThanDays -gt 0) { (Get-Date).AddDays(-$OlderThanDays) } else { $null }

$smokeReports = @(Get-ChildItem -LiteralPath $reportsDir -File | Where-Object {
    $_.Name -match $timestampPattern
})

$reportRuns = @($smokeReports | Group-Object {
    if ($_.Name -match $timestampPattern) {
        $matches[1]
    }
} | ForEach-Object {
    [pscustomobject]@{
        RunId = $_.Name
        Files = @($_.Group)
        LastWriteTime = @($_.Group | Sort-Object LastWriteTime -Descending | Select-Object -First 1)[0].LastWriteTime
    }
} | Sort-Object LastWriteTime -Descending)

$runsToKeep = @($reportRuns | Select-Object -First $KeepLatest)
$reportsToKeep = @($runsToKeep | ForEach-Object { $_.Files })
$reportPathsToKeep = @{}
foreach ($report in $reportsToKeep) {
    $reportPathsToKeep[$report.FullName] = $true
}

foreach ($report in $smokeReports) {
    if ($reportPathsToKeep.ContainsKey($report.FullName)) {
        continue
    }
    if ($cutoff -and $report.LastWriteTime -ge $cutoff) {
        continue
    }
    $candidates.Add($report)
}

if ($IncludeLogs) {
    Get-ChildItem -LiteralPath $reportsDir -File | Where-Object {
        $_.Extension -in @(".log", ".pid")
    } | ForEach-Object {
        if (-not $cutoff -or $_.LastWriteTime -lt $cutoff) {
            $candidates.Add($_)
        }
    }
}

if ($IncludeScreenshots) {
    Get-ChildItem -LiteralPath $reportsDir -Directory | ForEach-Object {
        if (-not $cutoff -or $_.LastWriteTime -lt $cutoff) {
            $candidates.Add($_)
        }
    }
}

$uniqueCandidates = @($candidates | Sort-Object FullName -Unique)

if ($uniqueCandidates.Count -eq 0) {
    Write-Host "No report cleanup candidates found."
    Write-Host "Kept latest timestamped smoke report runs: $(@($runsToKeep).Count)"
    return
}

$totalBytes = ($uniqueCandidates | ForEach-Object {
    if ($_.PSIsContainer) {
        (Get-ChildItem -LiteralPath $_.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
    } else {
        $_.Length
    }
} | Measure-Object -Sum).Sum

Write-Host "Report cleanup candidates:"
foreach ($candidate in $uniqueCandidates) {
    $relativePath = Resolve-Path -LiteralPath $candidate.FullName -Relative
    Write-Host "- $relativePath"
}
Write-Host ""
$safeTotalBytes = if ($null -eq $totalBytes) { 0 } else { $totalBytes }
Write-Host ("Total reclaimable size: {0:N2} KB" -f ($safeTotalBytes / 1KB))

foreach ($candidate in $uniqueCandidates) {
    Remove-Item -LiteralPath $candidate.FullName -Recurse:$candidate.PSIsContainer -Force -WhatIf:$WhatIfPreference
}
