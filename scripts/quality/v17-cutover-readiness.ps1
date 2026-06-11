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
$outputFiles = $manifest.outputFiles

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

function Test-OutputFile {
    param(
        [string]$ProofName,
        [string]$ExpectedSchema = "",
        [switch]$RequirePassedStatus,
        [string]$ExpectedBaseUrl = "",
        [string]$ExpectedFrontendBaseUrl = "",
        [string]$ExpectedApiBaseUrl = "",
        [switch]$RequireApiSmokeReport,
        [switch]$RequireApiSmokeTiming,
        [switch]$RequireBrowserTourProvenance,
        [switch]$RequireLoadSmokePassed
    )

    $proofPath = Resolve-ProofPath -Path $outputFiles.$ProofName
    if ([string]::IsNullOrWhiteSpace($proofPath) -or -not (Test-Path -LiteralPath $proofPath)) {
        $script:failures += "Deployment evidence manifest outputFiles.$ProofName must point to an existing proof report."
        return
    }
    try {
        $proofReport = Get-Content -Raw -LiteralPath $proofPath | ConvertFrom-Json
        if (-not [string]::IsNullOrWhiteSpace($ExpectedSchema) -and $proofReport.schema -ne $ExpectedSchema) {
            $script:failures += "Deployment evidence manifest outputFiles.$ProofName schema must be $ExpectedSchema."
        }
        if ($RequirePassedStatus -and $proofReport.status -ne "PASSED") {
            $script:failures += "Deployment evidence manifest outputFiles.$ProofName status must be PASSED."
        }
        if (-not [string]::IsNullOrWhiteSpace($ExpectedBaseUrl) -and $proofReport.baseUrl -ne $ExpectedBaseUrl) {
            $script:failures += "Deployment evidence manifest outputFiles.$ProofName baseUrl must match $ExpectedBaseUrl."
        }
        if ($RequireApiSmokeReport) {
            if ($proofReport.status -ne "PASSED") {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName status must be PASSED."
            }
            if ([string]::IsNullOrWhiteSpace($proofReport.generatedAt)) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName generatedAt must be present."
            }
            if ([string]::IsNullOrWhiteSpace($proofReport.testRun)) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName testRun must be present."
            }
            if ($null -eq $proofReport.apiResponses -or $null -eq $proofReport.apiResponses.adminLogin -or $null -eq $proofReport.apiResponses.boundaryAccessRequest) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName apiResponses must include adminLogin and boundaryAccessRequest smoke evidence."
            }
            if ($null -eq $proofReport.tableStateAfterTransactions) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName tableStateAfterTransactions must be present."
            }
        }
        if (-not [string]::IsNullOrWhiteSpace($ExpectedFrontendBaseUrl) -and $proofReport.frontendBaseUrl -ne $ExpectedFrontendBaseUrl) {
            $script:failures += "Deployment evidence manifest outputFiles.$ProofName frontendBaseUrl must match frontendBaseUrl."
        }
        if (-not [string]::IsNullOrWhiteSpace($ExpectedApiBaseUrl) -and $proofReport.apiBaseUrl -ne $ExpectedApiBaseUrl) {
            $script:failures += "Deployment evidence manifest outputFiles.$ProofName apiBaseUrl must match apiBaseUrl."
        }
        if ($RequireApiSmokeTiming -and $null -eq $proofReport.apiSmokeSeconds) {
            $script:failures += "Deployment evidence manifest outputFiles.$ProofName apiSmokeSeconds must be present."
        }
        if ($RequireLoadSmokePassed) {
            if (-not [bool]$proofReport.result.passed) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName result.passed must be true."
            }
            if ([int]$proofReport.concurrentUsers -lt 25) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName concurrentUsers must be at least 25 for V17 small-pilot proof."
            }
            if ([int]$proofReport.requestsPerUser -lt 8) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName requestsPerUser must be at least 8 for V17 small-pilot proof."
            }
            if ([int]$proofReport.totalRequests -lt 1) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName totalRequests must be at least 1."
            }
            if ([int]$proofReport.totalRequests -lt 200) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName totalRequests must be at least 200 for V17 small-pilot proof."
            }
        }
        if ($RequireBrowserTourProvenance) {
            if ($proofReport.appUrl -ne $manifest.frontendBaseUrl) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName appUrl must match frontendBaseUrl."
            }
            if ($proofReport.apiUrl -ne $manifest.apiBaseUrl) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName apiUrl must match apiBaseUrl."
            }
            if ([string]::IsNullOrWhiteSpace($proofReport.checkedAt)) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName checkedAt must be present."
            }
            if (@($proofReport.checkedRoutes).Count -lt 1) {
                $script:failures += "Deployment evidence manifest outputFiles.$ProofName checkedRoutes must include at least one route."
            }
        }
    } catch {
        $script:failures += "Deployment evidence manifest outputFiles.$ProofName must be readable JSON proof."
    }
}

Test-OutputFile -ProofName "frontendProxySmoke" -ExpectedBaseUrl $manifest.frontendBaseUrl -RequireApiSmokeReport
Test-OutputFile -ProofName "directApiSmoke" -ExpectedBaseUrl $manifest.apiBaseUrl -RequireApiSmokeReport
Test-OutputFile -ProofName "monitoring" -ExpectedSchema "merhouse.v17.deployed-monitoring.v1" -ExpectedFrontendBaseUrl $manifest.frontendBaseUrl -ExpectedApiBaseUrl $manifest.apiBaseUrl
Test-OutputFile -ProofName "performance" -RequirePassedStatus -RequireApiSmokeTiming
Test-OutputFile -ProofName "loadSmoke" -ExpectedSchema "merhouse.load-smoke.v1" -ExpectedBaseUrl $manifest.apiBaseUrl -RequireLoadSmokePassed
Test-OutputFile -ProofName "browserTour" -RequireBrowserTourProvenance

$expectedAttachmentSchemas = @{
    androidRelease = "merhouse.v17.android-release.v1"
    installedAndroidTour = "merhouse.native-android-tour.report.v1"
    backupRestore = "merhouse.v17.backup-restore-drill.v1"
    rollback = "merhouse.v17.rollback-rehearsal.v1"
    alertRouting = "merhouse.v17.alert-routing.v1"
    liveStakeholderWalkthrough = "merhouse.v17.live-stakeholder-walkthrough.v1"
}

$providerStatus = if ($null -eq $manifest.providerStatus) { "" } else { $manifest.providerStatus.Trim().ToLowerInvariant() }
if ($providerStatus -in @("smtp-staging-proven", "smtp-production-proven", "email-provider-proven")) {
    $expectedAttachmentSchemas.emailProvider = "merhouse.v17.email-provider-proof.v1"
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
            if ($null -eq $proofArtifact.versionCode -or $proofArtifact.versionCode.ToString() -notmatch '^[1-9][0-9]*$') {
                $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact versionCode must be a positive integer."
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.versionName)) {
                $failures += "Deployment evidence manifest attachedEvidence.androidRelease.path artifact versionName must be non-blank."
            }
            if ($null -ne $attached.androidRelease.versionCode -and $attached.androidRelease.versionCode.ToString() -ne $proofArtifact.versionCode.ToString()) {
                $failures += "Deployment evidence manifest attachedEvidence.androidRelease.versionCode must match androidRelease artifact versionCode."
            }
            if ($null -ne $attached.androidRelease.versionName -and $attached.androidRelease.versionName -ne $proofArtifact.versionName) {
                $failures += "Deployment evidence manifest attachedEvidence.androidRelease.versionName must match androidRelease artifact versionName."
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
        if ($attachmentName -eq "installedAndroidTour") {
            if ([string]::IsNullOrWhiteSpace($proofArtifact.checkedAt)) {
                $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.path artifact checkedAt must be non-blank."
            }
            if ($proofArtifact.apkSha256 -notmatch '^[a-fA-F0-9]{64}$') {
                $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.path artifact apkSha256 must be a 64-character hex digest."
            }
            if ([long]$proofArtifact.apkBytes -le 0) {
                $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.path artifact apkBytes must be greater than zero."
            }
            if (@($proofArtifact.deviceSerials).Count -lt 1) {
                $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.path artifact deviceSerials must include at least one connected device."
            }
            if ([int]$proofArtifact.checkedRoutes -lt 1) {
                $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.path artifact checkedRoutes must be greater than zero."
            }
            if (@($proofArtifact.records).Count -lt 1) {
                $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.path artifact records must include at least one installed-app route record."
            }
            if (@($proofArtifact.badRecords).Count -gt 0) {
                $failures += "Deployment evidence manifest attachedEvidence.installedAndroidTour.path artifact badRecords must be empty."
            }
        }
        if ($attachmentName -eq "backupRestore") {
            if (-not [bool]$proofArtifact.restored) {
                $failures += "Deployment evidence manifest attachedEvidence.backupRestore.path artifact restored must be true."
            }
            if ($proofArtifact.preflight.envAudit -ne "passed") {
                $failures += "Deployment evidence manifest attachedEvidence.backupRestore.path artifact preflight.envAudit must be passed."
            }
            if ($proofArtifact.preflight.vpsShape -ne "passed") {
                $failures += "Deployment evidence manifest attachedEvidence.backupRestore.path artifact preflight.vpsShape must be passed."
            }
            $backupPath = Resolve-ProofPath -Path $proofArtifact.backupPath
            if ([string]::IsNullOrWhiteSpace($backupPath) -or -not (Test-Path -LiteralPath $backupPath)) {
                $failures += "Deployment evidence manifest attachedEvidence.backupRestore.path artifact backupPath must point to an existing backup file."
            } else {
                if ($proofArtifact.backupSha256 -notmatch '^[a-fA-F0-9]{64}$') {
                    $failures += "Deployment evidence manifest attachedEvidence.backupRestore.path artifact backupSha256 must be a 64-character hex digest."
                } else {
                    $backupHash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
                    if ($backupHash -ne $proofArtifact.backupSha256.ToLowerInvariant()) {
                        $failures += "Deployment evidence manifest attachedEvidence.backupRestore.path artifact backupSha256 must match backupPath content."
                    }
                }
                $backupBytes = (Get-Item -LiteralPath $backupPath).Length
                if ([long]$proofArtifact.backupBytes -ne $backupBytes -or $backupBytes -le 0) {
                    $failures += "Deployment evidence manifest attachedEvidence.backupRestore.path artifact backupBytes must match a non-empty backup file."
                }
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.secretPolicy)) {
                $failures += "Deployment evidence manifest attachedEvidence.backupRestore.path artifact secretPolicy must be non-blank."
            }
        }
        if ($attachmentName -eq "rollback") {
            if (-not [bool]$proofArtifact.rollbackRan) {
                $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact rollbackRan must be true."
            }
            if ($proofArtifact.preflight.envAudit -ne "passed") {
                $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact preflight.envAudit must be passed."
            }
            if ($proofArtifact.preflight.vpsShape -ne "passed") {
                $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact preflight.vpsShape must be passed."
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.secretPolicy)) {
                $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact secretPolicy must be non-blank."
            }
            if ($null -eq $proofArtifact.postRollbackMonitoring -or -not [bool]$proofArtifact.postRollbackMonitoring.ran) {
                $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact postRollbackMonitoring.ran must be true."
            } else {
                if ($proofArtifact.postRollbackMonitoring.apiBaseUrl -ne $manifest.apiBaseUrl) {
                    $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact postRollbackMonitoring.apiBaseUrl must match apiBaseUrl."
                }
                if ($proofArtifact.postRollbackMonitoring.frontendBaseUrl -ne $manifest.frontendBaseUrl) {
                    $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact postRollbackMonitoring.frontendBaseUrl must match frontendBaseUrl."
                }
                $rollbackMonitoringPath = Resolve-ProofPath -Path $proofArtifact.postRollbackMonitoring.reportPath
                if ([string]::IsNullOrWhiteSpace($rollbackMonitoringPath) -or -not (Test-Path -LiteralPath $rollbackMonitoringPath)) {
                    $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact postRollbackMonitoring.reportPath must point to an existing report when monitoring ran."
                } else {
                    try {
                        $rollbackMonitoringReport = Get-Content -Raw -LiteralPath $rollbackMonitoringPath | ConvertFrom-Json
                        if ($rollbackMonitoringReport.schema -ne "merhouse.v17.deployed-monitoring.v1") {
                            $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact postRollbackMonitoring.reportPath schema must be merhouse.v17.deployed-monitoring.v1."
                        }
                    } catch {
                        $failures += "Deployment evidence manifest attachedEvidence.rollback.path artifact postRollbackMonitoring.reportPath must be readable JSON proof."
                    }
                }
            }
        }
        if ($attachmentName -eq "emailProvider") {
            if ($proofArtifact.apiBaseUrl -ne $manifest.apiBaseUrl) {
                $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact apiBaseUrl must match apiBaseUrl."
            }
            if ($proofArtifact.frontendBaseUrl -ne $manifest.frontendBaseUrl) {
                $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact frontendBaseUrl must match frontendBaseUrl."
            }
            $proofProviderStatus = if ($null -eq $proofArtifact.providerStatus) { "" } else { $proofArtifact.providerStatus.Trim().ToLowerInvariant() }
            if ($proofProviderStatus -ne $providerStatus) {
                $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact providerStatus must match providerStatus."
            }
            foreach ($workflow in @("password-recovery", "access-request", "notification-email")) {
                if (@($proofArtifact.workflowsProven) -notcontains $workflow) {
                    $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact workflowsProven must include $workflow."
                }
                if ($null -eq $proofArtifact.workflowEvidence -or [string]::IsNullOrWhiteSpace($proofArtifact.workflowEvidence.$workflow)) {
                    $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact workflowEvidence.$workflow must be non-blank."
                }
                if ($null -eq $proofArtifact.workflowProviderStatuses -or $proofArtifact.workflowProviderStatuses.$workflow -ne "SENT") {
                    $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact workflowProviderStatuses.$workflow must be SENT."
                }
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.deliveryEvidence)) {
                $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact deliveryEvidence must be non-blank."
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.completedAt)) {
                $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact completedAt must be non-blank."
            }
            if ([string]::IsNullOrWhiteSpace($proofArtifact.secretPolicy)) {
                $failures += "Deployment evidence manifest attachedEvidence.emailProvider.path artifact secretPolicy must be non-blank."
            }
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
            foreach ($signal in @("api-health", "frontend-health", "failed-provider-delivery")) {
                if (@($proofArtifact.routedSignals) -notcontains $signal) {
                    $failures += "Deployment evidence manifest attachedEvidence.alertRouting.path artifact routedSignals must include $signal."
                }
                if ($null -eq $proofArtifact.signalEvidence -or [string]::IsNullOrWhiteSpace($proofArtifact.signalEvidence.$signal)) {
                    $failures += "Deployment evidence manifest attachedEvidence.alertRouting.path artifact signalEvidence.$signal must be non-blank."
                }
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
            if ($proofArtifact.proofMode -ne "manual-live-review") {
                $failures += "Deployment evidence manifest attachedEvidence.liveStakeholderWalkthrough.path artifact proofMode must be manual-live-review."
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
if ($null -ne $attached.emailProvider -and $attached.emailProvider.apiBaseUrl -ne $manifest.apiBaseUrl) {
    $failures += "Deployment evidence manifest attachedEvidence.emailProvider.apiBaseUrl must match apiBaseUrl."
}
if ($null -ne $attached.emailProvider -and $attached.emailProvider.frontendBaseUrl -ne $manifest.frontendBaseUrl) {
    $failures += "Deployment evidence manifest attachedEvidence.emailProvider.frontendBaseUrl must match frontendBaseUrl."
}
if ($null -ne $attached.emailProvider -and $attached.emailProvider.providerStatus.ToString().ToLowerInvariant() -ne $providerStatus) {
    $failures += "Deployment evidence manifest attachedEvidence.emailProvider.providerStatus must match providerStatus."
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
