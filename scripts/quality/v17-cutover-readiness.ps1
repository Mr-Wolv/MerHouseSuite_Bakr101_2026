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
$expectedAttachmentSchemas = @{
    androidRelease = "merhouse.v17.android-release.v1"
    installedAndroidTour = "merhouse.native-android-tour.report.v1"
    backupRestore = "merhouse.v17.backup-restore-drill.v1"
    rollback = "merhouse.v17.rollback-rehearsal.v1"
    alertRouting = "merhouse.v17.alert-routing.v1"
    liveStakeholderWalkthrough = "merhouse.v17.live-stakeholder-walkthrough.v1"
}

function Resolve-ProofPath {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $projectRoot $Path))
}

foreach ($attachmentName in $expectedAttachmentSchemas.Keys) {
    if ($null -eq $attached.$attachmentName) {
        $failures += "Deployment evidence manifest attachedEvidence.$attachmentName must be present for cutover readiness."
        continue
    }
    if ($attached.$attachmentName.schema -ne $expectedAttachmentSchemas[$attachmentName]) {
        $failures += "Deployment evidence manifest attachedEvidence.$attachmentName schema must be $($expectedAttachmentSchemas[$attachmentName])."
    }
    $proofPath = Resolve-ProofPath -Path $attached.$attachmentName.path
    if ([string]::IsNullOrWhiteSpace($proofPath) -or -not (Test-Path -LiteralPath $proofPath)) {
        $failures += "Deployment evidence manifest attachedEvidence.$attachmentName.path must point to an existing proof artifact."
        continue
    }
    try {
        $proofArtifact = Get-Content -Raw -LiteralPath $proofPath | ConvertFrom-Json
        $proofSchema = $proofArtifact.schema
        if ([string]::IsNullOrWhiteSpace($proofSchema) -and $attachmentName -eq "installedAndroidTour") {
            $hasNativeTourProvenance =
                -not [string]::IsNullOrWhiteSpace($proofArtifact.apkSha256) -and
                -not [string]::IsNullOrWhiteSpace($proofArtifact.apiUrl) -and
                $null -ne $proofArtifact.checkedRoutes -and
                @($proofArtifact.deviceSerials).Count -gt 0
            if ($hasNativeTourProvenance) {
                $proofSchema = "merhouse.native-android-tour.report.v1"
            }
        }
        if ($proofSchema -ne $expectedAttachmentSchemas[$attachmentName]) {
            $failures += "Deployment evidence manifest attachedEvidence.$attachmentName.path artifact schema must be $($expectedAttachmentSchemas[$attachmentName])."
        }
        if ($attachmentName -eq "androidRelease" -and $proofArtifact.apiBaseUrl -ne $manifest.apiBaseUrl) {
            $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact apiBaseUrl must match apiBaseUrl."
        }
        if ($attachmentName -eq "androidRelease") {
            if ($proofArtifact.artifactKind -notin @("apk", "aab")) {
                $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact artifactKind must be apk or aab."
            }
            $androidArtifactPath = Resolve-ProofPath -Path $proofArtifact.artifactPath
            if ([string]::IsNullOrWhiteSpace($androidArtifactPath) -or -not (Test-Path -LiteralPath $androidArtifactPath)) {
                $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact artifactPath must point to an existing APK/AAB."
            } else {
                if ($proofArtifact.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
                    $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact sha256 must be a 64-character hex digest."
                } else {
                    $androidArtifactHash = (Get-FileHash -LiteralPath $androidArtifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
                    if ($androidArtifactHash -ne $proofArtifact.sha256.ToLowerInvariant()) {
                        $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact sha256 must match artifactPath content."
                    }
                }
                $androidArtifactBytes = (Get-Item -LiteralPath $androidArtifactPath).Length
                if ([long]$proofArtifact.bytes -ne $androidArtifactBytes -or $androidArtifactBytes -le 0) {
                    $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact bytes must match a non-empty APK/AAB."
                }
            }
            if ($proofArtifact.cleartextTraffic -ne "disabled-for-release") {
                $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact cleartextTraffic must be disabled-for-release."
            }
            if ($proofArtifact.signing -ne "external-keystore-env") {
                $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact signing must be external-keystore-env."
            }
        }
        if ($attachmentName -eq "installedAndroidTour" -and $proofArtifact.apiUrl -ne $manifest.apiBaseUrl) {
            $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.path artifact apiUrl must match apiBaseUrl."
        }
        if ($attachmentName -eq "alertRouting") {
            if ($proofArtifact.apiBaseUrl -ne $manifest.apiBaseUrl) {
                $failures += "Deployment evidence manifest attachedEvidence.alertRouting.path artifact apiBaseUrl must match apiBaseUrl."
            }
            if ($proofArtifact.frontendBaseUrl -ne $manifest.frontendBaseUrl) {
                $failures += "Deployment evidence manifest attachedEvidence.alertRouting.path artifact frontendBaseUrl must match frontendBaseUrl."
            }
            if (@($proofArtifact.routedSignals).Count -lt 1) {
                $failures += "Deployment evidence manifest attachedEvidence.alertRouting.path artifact routedSignals must include at least one signal."
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.deliveryEvidence)) {
                $failures += "Deployment evidence manifest attachedEvidence.alertRouting.path artifact deliveryEvidence must be non-blank."
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.secretPolicy)) {
                $failures += "Deployment evidence manifest attachedEvidence.alertRouting.path artifact secretPolicy must be non-blank."
            }
        }
        if ($attachmentName -eq "liveStakeholderWalkthrough") {
            if ($proofArtifact.apiBaseUrl -ne $manifest.apiBaseUrl) {
                $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact apiBaseUrl must match apiBaseUrl."
            }
            if ($proofArtifact.frontendBaseUrl -ne $manifest.frontendBaseUrl) {
                $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact frontendBaseUrl must match frontendBaseUrl."
            }
            if (-not [bool]$proofArtifact.browserWalkthroughCompleted) {
                $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact browserWalkthroughCompleted must be true."
            }
            if (-not [bool]$proofArtifact.installedAndroidWalkthroughCompleted) {
                $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact installedAndroidWalkthroughCompleted must be true."
            }
            foreach ($role in @("owner", "merchant", "warehouse", "support-admin", "auditor")) {
                if (@($proofArtifact.rolesCovered) -notcontains $role) {
                    $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact rolesCovered must include $role."
                }
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.reviewer)) {
                $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact reviewer must be non-blank."
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.completedAt)) {
                $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact completedAt must be non-blank."
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.secretPolicy)) {
                $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact secretPolicy must be non-blank."
            }
        }
    } catch {
        $failures += "Deployment evidence manifest attachedEvidence.$attachmentName.path must be readable JSON proof."
    }
}
if ($null -ne $attached.androidRelease -and $attached.androidRelease.apiBaseUrl -ne $manifest.apiBaseUrl) {
    $failures += "Deployment evidence manifest attachedEvidence.androidRelease.apiBaseUrl must match apiBaseUrl."
}
if ($null -ne $attached.installedAndroidTour -and $attached.installedAndroidTour.apiUrl -ne $manifest.apiBaseUrl) {
    $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.apiUrl must match apiBaseUrl."
}
if ($null -ne $attached.alertRouting -and $attached.alertRouting.apiBaseUrl -ne $manifest.apiBaseUrl) {
    $failures += "Deployment evidence manifest attachedEvidence.alertRouting.apiBaseUrl must match apiBaseUrl."
}
if ($null -ne $attached.alertRouting -and $attached.alertRouting.frontendBaseUrl -ne $manifest.frontendBaseUrl) {
    $failures += "Deployment evidence manifest attachedEvidence.alertRouting.frontendBaseUrl must match frontendBaseUrl."
}
if ($null -ne $attached.liveStakeholderWalkthrough -and $attached.liveStakeholderWalkthrough.apiBaseUrl -ne $manifest.apiBaseUrl) {
    $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.apiBaseUrl must match apiBaseUrl."
}
if ($null -ne $attached.liveStakeholderWalkthrough -and $attached.liveStakeholderWalkthrough.frontendBaseUrl -ne $manifest.frontendBaseUrl) {
    $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.frontendBaseUrl must match frontendBaseUrl."
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
