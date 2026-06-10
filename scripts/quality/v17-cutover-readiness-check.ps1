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
    invalidAndroidRelease = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-android-release.json"
    androidReleaseArtifact = Join-Path $resolvedOutputDirectory "v17-cutover-check-app-release.aab"
    invalidAndroidReleaseArtifact = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-app-release.aab"
    installedAndroidTour = Join-Path $resolvedOutputDirectory "v17-cutover-check-installed-android-tour.json"
    backupRestore = Join-Path $resolvedOutputDirectory "v17-cutover-check-backup-restore.json"
    rollback = Join-Path $resolvedOutputDirectory "v17-cutover-check-rollback.json"
    alertRouting = Join-Path $resolvedOutputDirectory "v17-cutover-check-alert-routing.json"
    liveStakeholderWalkthrough = Join-Path $resolvedOutputDirectory "v17-cutover-check-live-walkthrough.json"
    invalidLiveStakeholderWalkthrough = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-live-walkthrough.json"
}

Set-Content -LiteralPath $artifactPaths.androidReleaseArtifact -Value "fixture signed Android artifact" -Encoding utf8
Set-Content -LiteralPath $artifactPaths.invalidAndroidReleaseArtifact -Value "changed Android artifact" -Encoding utf8
$androidArtifactHash = (Get-FileHash -LiteralPath $artifactPaths.androidReleaseArtifact -Algorithm SHA256).Hash.ToLowerInvariant()
$androidArtifactBytes = (Get-Item -LiteralPath $artifactPaths.androidReleaseArtifact).Length

@{
    schema = "merhouse.v17.android-release.v1"
    apiBaseUrl = "https://api.example.com"
    artifactKind = "aab"
    artifactPath = $artifactPaths.androidReleaseArtifact
    sha256 = $androidArtifactHash
    bytes = $androidArtifactBytes
    cleartextTraffic = "disabled-for-release"
    signing = "external-keystore-env"
} |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.androidRelease -Encoding utf8
@{ schema = "merhouse.native-android-tour.report.v1"; apiUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.installedAndroidTour -Encoding utf8
@{ schema = "merhouse.v17.backup-restore-drill.v1" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.backupRestore -Encoding utf8
@{ schema = "merhouse.v17.rollback-rehearsal.v1" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.rollback -Encoding utf8
@{
    schema = "merhouse.v17.alert-routing.v1"
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    routedSignals = @("api-health", "frontend-health", "failed-provider-delivery")
    deliveryEvidence = "operator-confirmed-alert-routing-fixture"
    secretPolicy = "No provider credentials or alert endpoints are stored in this parser proof fixture."
} |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.alertRouting -Encoding utf8
@{
    schema = "merhouse.v17.live-stakeholder-walkthrough.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    browserWalkthroughCompleted = $true
    installedAndroidWalkthroughCompleted = $true
    rolesCovered = @("owner", "merchant", "warehouse", "support-admin", "auditor")
    reviewer = "local-proof-fixture"
    secretPolicy = "No smoke credentials, screenshots, or private endpoint tokens are stored in this parser proof fixture."
} |
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
$wrongAttachmentManifest.attachedEvidence.androidRelease.path = $artifactPaths.invalidAndroidRelease
$wrongAttachmentManifest.attachedEvidence.alertRouting.apiBaseUrl = "https://wrong-api.example.com"
$wrongAttachmentManifest.attachedEvidence.rollback.path = (Join-Path $resolvedOutputDirectory "missing-rollback-proof.json")
$wrongAttachmentManifest.attachedEvidence.liveStakeholderWalkthrough.path = $artifactPaths.invalidLiveStakeholderWalkthrough
$wrongAttachmentManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $wrongAttachmentManifestPath -Encoding utf8

@{
    schema = "merhouse.v17.android-release.v1"
    apiBaseUrl = "https://api.example.com"
    artifactKind = "aab"
    artifactPath = $artifactPaths.invalidAndroidReleaseArtifact
    sha256 = $androidArtifactHash
    bytes = $androidArtifactBytes
    cleartextTraffic = "true"
    signing = "embedded-keystore"
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidAndroidRelease -Encoding utf8

@{
    schema = "merhouse.v17.live-stakeholder-walkthrough.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://wrong-api.example.com"
    browserWalkthroughCompleted = $true
    installedAndroidWalkthroughCompleted = $false
    rolesCovered = @("owner", "merchant")
    reviewer = "local-proof-fixture"
    secretPolicy = "No smoke credentials are stored."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidLiveStakeholderWalkthrough -Encoding utf8

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
    if (
        $_.Exception.Message -match "androidRelease schema" -and
        $_.Exception.Message -match "androidRelease.path artifact sha256" -and
        $_.Exception.Message -match "androidRelease.path artifact cleartextTraffic" -and
        $_.Exception.Message -match "androidRelease.path artifact signing" -and
        $_.Exception.Message -match "alertRouting.apiBaseUrl" -and
        $_.Exception.Message -match "rollback.path" -and
        $_.Exception.Message -match "liveStakeholderWalkthrough.path artifact apiBaseUrl" -and
        $_.Exception.Message -match "installedAndroidWalkthroughCompleted" -and
        $_.Exception.Message -match "rolesCovered must include warehouse"
    ) {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Wrong attachment evidence was accepted as cutover-ready."
}

Write-Host "V17 cutover readiness fixture check passed."
