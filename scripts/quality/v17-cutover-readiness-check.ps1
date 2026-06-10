param(
    [string]$OutputDirectory = "reports"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$resolvedOutputDirectory = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
}
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null

$validManifestPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-valid-deployment-evidence.json"
$missingEvidenceManifestPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-missing-evidence.json"
$wrongAttachmentManifestPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-wrong-attachment.json"
$validOutputPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-valid-report.json"
$missingOutputPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-missing-report.json"
$wrongAttachmentOutputPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-wrong-attachment-report.json"

$artifactPaths = [ordered]@{
    androidRelease = Join-Path $resolvedOutputDirectory "v17-cutover-check-android-release.json"
    installedAndroidTour = Join-Path $resolvedOutputDirectory "v17-cutover-check-installed-android-tour.json"
    backupRestore = Join-Path $resolvedOutputDirectory "v17-cutover-check-backup-restore.json"
    rollback = Join-Path $resolvedOutputDirectory "v17-cutover-check-rollback.json"
    alertRouting = Join-Path $resolvedOutputDirectory "v17-cutover-check-alert-routing.json"
    liveStakeholderWalkthrough = Join-Path $resolvedOutputDirectory "v17-cutover-check-live-walkthrough.json"
}

@{ schema = "merhouse.v17.android-release.v1"; apiBaseUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.androidRelease -Encoding utf8
@{ schema = "merhouse.native-android-tour.report.v1"; apiUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.installedAndroidTour -Encoding utf8
@{ schema = "merhouse.v17.backup-restore-drill.v1" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.backupRestore -Encoding utf8
@{ schema = "merhouse.v17.rollback-rehearsal.v1" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.rollback -Encoding utf8
@{ schema = "merhouse.v17.alert-routing.v1"; frontendBaseUrl = "https://app.example.com"; apiBaseUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.alertRouting -Encoding utf8
@{ schema = "merhouse.v17.live-stakeholder-walkthrough.v1"; frontendBaseUrl = "https://app.example.com"; apiBaseUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.liveStakeholderWalkthrough -Encoding utf8

$attached = [ordered]@{
    androidRelease = [ordered]@{ schema = "merhouse.v17.android-release.v1"; path = $artifactPaths.androidRelease; apiBaseUrl = "https://api.example.com" }
    installedAndroidTour = [ordered]@{ schema = "merhouse.native-android-tour.report.v1"; path = $artifactPaths.installedAndroidTour; apiUrl = "https://api.example.com" }
    backupRestore = [ordered]@{ schema = "merhouse.v17.backup-restore-drill.v1"; path = $artifactPaths.backupRestore }
    rollback = [ordered]@{ schema = "merhouse.v17.rollback-rehearsal.v1"; path = $artifactPaths.rollback }
    alertRouting = [ordered]@{ schema = "merhouse.v17.alert-routing.v1"; path = $artifactPaths.alertRouting; frontendBaseUrl = "https://app.example.com"; apiBaseUrl = "https://api.example.com" }
    liveStakeholderWalkthrough = [ordered]@{ schema = "merhouse.v17.live-stakeholder-walkthrough.v1"; path = $artifactPaths.liveStakeholderWalkthrough; frontendBaseUrl = "https://app.example.com"; apiBaseUrl = "https://api.example.com" }
}

$baseManifest = [ordered]@{
    schema = "merhouse.v17.deployment-evidence.v1"
    deploymentLabel = "fixture-v17"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = "fixture"
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    providerStatus = "email-disabled-by-policy"
    includedProof = [ordered]@{
        frontendProxySmoke = $true
        directApiSmoke = $true
        monitoringSamples = $true
        performanceApiTiming = $true
        loadSmoke = $true
        browserTour = $true
    }
    outputFiles = [ordered]@{}
    attachedEvidence = $attached
    productionClaim = $false
    claimBoundary = "fixture"
    nextRequiredEvidence = @()
}
$baseManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $validManifestPath -Encoding utf8

$missingManifest = $baseManifest | ConvertTo-Json -Depth 8 | ConvertFrom-Json
$missingManifest.nextRequiredEvidence = @("manual owner, merchant, warehouse, support-admin, and auditor live browser plus installed-Android walkthrough")
$missingManifest.includedProof.browserTour = $false
$missingManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $missingEvidenceManifestPath -Encoding utf8

$wrongAttachmentManifest = $baseManifest | ConvertTo-Json -Depth 8 | ConvertFrom-Json
$wrongAttachmentManifest.attachedEvidence.androidRelease.schema = "merhouse.load-smoke.v1"
$wrongAttachmentManifest.attachedEvidence.alertRouting.apiBaseUrl = "https://wrong-api.example.com"
$wrongAttachmentManifest.attachedEvidence.rollback.path = (Join-Path $resolvedOutputDirectory "missing-rollback-proof.json")
$wrongAttachmentManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $wrongAttachmentManifestPath -Encoding utf8

& (Join-Path $PSScriptRoot "v17-cutover-readiness.ps1") -DeploymentEvidenceManifestPath $validManifestPath -OutputPath $validOutputPath

$failedAsExpected = $false
try {
    & (Join-Path $PSScriptRoot "v17-cutover-readiness.ps1") -DeploymentEvidenceManifestPath $missingEvidenceManifestPath -OutputPath $missingOutputPath
} catch {
    if ($_.Exception.Message -match "nextRequiredEvidence" -and $_.Exception.Message -match "browserTour") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Incomplete deployment evidence was accepted as cutover-ready."
}

$failedAsExpected = $false
try {
    & (Join-Path $PSScriptRoot "v17-cutover-readiness.ps1") -DeploymentEvidenceManifestPath $wrongAttachmentManifestPath -OutputPath $wrongAttachmentOutputPath
} catch {
    if ($_.Exception.Message -match "androidRelease schema" -and $_.Exception.Message -match "alertRouting.apiBaseUrl" -and $_.Exception.Message -match "rollback.path") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Wrong attachment evidence was accepted as cutover-ready."
}

Write-Host "V17 cutover readiness fixture check passed."
