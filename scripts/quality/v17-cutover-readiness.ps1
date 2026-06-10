param(
    [Parameter(Mandatory = $true)] [string]$DeploymentEvidenceManifestPath,
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$manifestPath = if ([System.IO.Path]::IsPathRooted($DeploymentEvidenceManifestPath)) {
    [System.IO.Path]::GetFullPath($DeploymentEvidenceManifestPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $DeploymentEvidenceManifestPath))
}
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Deployment evidence manifest was not found: $manifestPath"
}

try {
    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
} catch {
    throw "Deployment evidence manifest must be valid JSON."
}

$failures = @()
if ($manifest.schema -ne "merhouse.v17.deployment-evidence.v1") {
    $failures += "Deployment evidence manifest schema must be merhouse.v17.deployment-evidence.v1."
}
if ([bool]$manifest.productionClaim) {
    $failures += "Deployment evidence manifest must keep productionClaim=false until a separate human cutover record is made."
}
if (@($manifest.nextRequiredEvidence).Count -gt 0) {
    $failures += "Deployment evidence manifest still has nextRequiredEvidence: $(@($manifest.nextRequiredEvidence) -join '; ')"
}
foreach ($proofName in @("frontendProxySmoke", "directApiSmoke", "monitoringSamples", "performanceApiTiming", "loadSmoke", "browserTour")) {
    if (-not [bool]$manifest.includedProof.$proofName) {
        $failures += "Deployment evidence manifest includedProof.$proofName must be true for cutover readiness."
    }
}

$attached = $manifest.attachedEvidence
foreach ($attachmentName in @("androidRelease", "installedAndroidTour", "backupRestore", "rollback", "alertRouting", "liveStakeholderWalkthrough")) {
    if ($null -eq $attached.$attachmentName) {
        $failures += "Deployment evidence manifest attachedEvidence.$attachmentName must be present for cutover readiness."
    }
}

$providerStatus = if ($null -eq $manifest.providerStatus) { "" } else { $manifest.providerStatus.Trim().ToLowerInvariant() }
if ($providerStatus -notin @("smtp-staging-proven", "smtp-production-proven", "email-provider-proven", "email-disabled-by-policy")) {
    $failures += "Deployment evidence manifest providerStatus must be proven or explicitly disabled for cutover readiness."
}

$ready = $failures.Count -eq 0
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\v17-cutover-readiness-$timestamp.json"
}
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

$report = [ordered]@{
    schema = "merhouse.v17.cutover-readiness.v1"
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    deploymentEvidenceManifestPath = $manifestPath
    deploymentLabel = $manifest.deploymentLabel
    commitSha = $manifest.commitSha
    frontendBaseUrl = $manifest.frontendBaseUrl
    apiBaseUrl = $manifest.apiBaseUrl
    readyForHumanCutoverDecision = $ready
    productionClaim = $false
    failures = $failures
}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

Write-Host "V17 cutover readiness report: $resolvedOutputPath"
if (-not $ready) {
    throw "V17 cutover readiness failed: $($failures -join ' ')"
}

Write-Host "V17 cutover readiness passed. Review the report before any separate production cutover decision."
