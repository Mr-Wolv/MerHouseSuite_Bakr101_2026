param(
    [Parameter(Mandatory = $true)] [string]$FrontendBaseUrl,
    [Parameter(Mandatory = $true)] [string]$ApiBaseUrl,
    [Parameter(Mandatory = $true)] [string]$Reviewer,
    [Parameter(Mandatory = $true)] [string]$BrowserWalkthroughEvidence,
    [Parameter(Mandatory = $true)] [string]$InstalledAndroidWalkthroughEvidence,
    [Parameter(Mandatory = $true)] [string]$StakeholderCoverageEvidence,
    [string]$OutputPath = "",
    [switch]$ConfirmManualLiveReview
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmManualLiveReview) {
    throw "Re-run with -ConfirmManualLiveReview only after the live browser and installed Android walkthroughs were completed with the reviewer."
}

. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")

function Assert-SafeEvidenceText {
    param(
        [string]$Name,
        [string]$Value,
        [int]$MinLength = 24
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name must be non-blank evidence text."
    }
    $trimmed = $Value.Trim()
    if ($trimmed.Length -lt $MinLength -or $trimmed -match '(?i)^(ok|done|passed|tested|confirmed|yes|n/a|na|proof|verified)$') {
        throw "$Name is too vague for V17 proof; use a short non-secret ticket, reviewer, route, device, or stakeholder evidence reference."
    }
    if ($trimmed.Length -gt 240) {
        throw "$Name must be a short proof reference, not copied credentials, logs, or screenshots."
    }
    if ($trimmed -match '(?i)(password|authorization|bearer|api[_ -]?key|secret|credential|token|otp|private[_ -]?url|screenshot\s*data|base64)') {
        throw "$Name must not include credentials, tokens, OTPs, private URLs, copied screenshot data, or logs."
    }
    if ($trimmed -match '(?i)(deployment[_ -]?log|browser[_ -]?log|android[_ -]?log|adb[_ -]?logcat|logcat|stack[_ -]?trace|console[_ -]?output|raw[_ -]?log|screenshot[_ -]?data|data:image|base64)') {
        throw "$Name must not include copied deployment logs, browser/Android logs, stack traces, console output, or screenshot data."
    }
    if ($trimmed -match '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b') {
        throw "$Name must not include reviewer, operator, or stakeholder email addresses."
    }
    if ($trimmed -match '(?i)\bBearer\s+[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+' -or
        $trimmed -match '(?i)[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}' -or
        $trimmed -match '(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|signing[_-]?secret)\s*[:=]\s*[''"]?[A-Za-z0-9_./+=:-]{16,}') {
        throw "$Name must not include token-shaped data."
    }
    return $trimmed
}

$normalizedFrontendBaseUrl = Assert-AbsoluteHttpUrl -Name "FrontendBaseUrl" -Value $FrontendBaseUrl
$normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
if (-not $normalizedFrontendBaseUrl.StartsWith("https://")) {
    throw "FrontendBaseUrl must be an HTTPS deployment URL for V17 live stakeholder walkthrough proof."
}
if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
    throw "ApiBaseUrl must be an HTTPS deployment URL for V17 live stakeholder walkthrough proof."
}

$reviewerText = Assert-SafeEvidenceText -Name "Reviewer" -Value $Reviewer -MinLength 2
$browserEvidenceText = Assert-SafeEvidenceText -Name "BrowserWalkthroughEvidence" -Value $BrowserWalkthroughEvidence
$installedAndroidEvidenceText = Assert-SafeEvidenceText -Name "InstalledAndroidWalkthroughEvidence" -Value $InstalledAndroidWalkthroughEvidence
$stakeholderCoverageEvidenceText = Assert-SafeEvidenceText -Name "StakeholderCoverageEvidence" -Value $StakeholderCoverageEvidence

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\v17-live-stakeholder-walkthrough-$timestamp.json"
}
$resolvedOutputPath = Resolve-MerHousePath -Path $OutputPath -ProjectRoot $projectRoot
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

$report = [ordered]@{
    schema = "merhouse.v17.live-stakeholder-walkthrough.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = $normalizedFrontendBaseUrl
    apiBaseUrl = $normalizedApiBaseUrl
    browserWalkthroughCompleted = $true
    installedAndroidWalkthroughCompleted = $true
    proofMode = "manual-live-review"
    rolesCovered = @("owner", "merchant", "warehouse", "support-admin", "auditor")
    reviewer = $reviewerText
    manualEvidence = [ordered]@{
        browserWalkthrough = $browserEvidenceText
        installedAndroidWalkthrough = $installedAndroidEvidenceText
        stakeholderCoverage = $stakeholderCoverageEvidenceText
    }
    secretPolicy = "No smoke credentials, reset tokens, OTPs, private URLs, screenshots, screenshot data, deployment logs, keystores, or provider credentials are stored in this proof artifact."
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

Write-Host "V17 live stakeholder walkthrough proof manifest: $resolvedOutputPath"
Write-Host "Proof mode: manual-live-review"
Write-Host "V17 live stakeholder walkthrough proof completed."
