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
$wrongRollbackMonitoringManifestPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-wrong-rollback-monitoring.json"
$validOutputPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-valid-report.json"
$missingOutputPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-missing-report.json"
$wrongAttachmentOutputPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-wrong-attachment-report.json"
$wrongRollbackMonitoringOutputPath = Join-Path $resolvedOutputDirectory "v17-cutover-check-wrong-rollback-monitoring-report.json"

$artifactPaths = [ordered]@{
    frontendProxySmoke = Join-Path $resolvedOutputDirectory "v17-cutover-check-frontend-proxy-smoke.json"
    invalidFrontendProxySmoke = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-frontend-proxy-smoke.json"
    directApiSmoke = Join-Path $resolvedOutputDirectory "v17-cutover-check-direct-api-smoke.json"
    monitoring = Join-Path $resolvedOutputDirectory "v17-cutover-check-monitoring.json"
    invalidMonitoring = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-monitoring.json"
    rollbackMonitoring = Join-Path $resolvedOutputDirectory "v17-cutover-check-rollback-monitoring.json"
    invalidRollbackMonitoring = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-rollback-monitoring.json"
    performance = Join-Path $resolvedOutputDirectory "v17-cutover-check-performance.json"
    invalidPerformance = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-performance.json"
    loadSmoke = Join-Path $resolvedOutputDirectory "v17-cutover-check-load-smoke.json"
    invalidLoadSmoke = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-load-smoke.json"
    browserTour = Join-Path $resolvedOutputDirectory "v17-cutover-check-browser-tour.json"
    invalidBrowserTour = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-browser-tour.json"
    androidRelease = Join-Path $resolvedOutputDirectory "v17-cutover-check-android-release.json"
    invalidAndroidRelease = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-android-release.json"
    androidReleaseArtifact = Join-Path $resolvedOutputDirectory "v17-cutover-check-app-release.aab"
    invalidAndroidReleaseArtifact = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-app-release.aab"
    installedAndroidTour = Join-Path $resolvedOutputDirectory "v17-cutover-check-installed-android-tour.json"
    invalidInstalledAndroidTour = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-installed-android-tour.json"
    backupRestore = Join-Path $resolvedOutputDirectory "v17-cutover-check-backup-restore.json"
    invalidBackupRestore = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-backup-restore.json"
    backupRestoreDump = Join-Path $resolvedOutputDirectory "v17-cutover-check-backup-restore.dump"
    rollback = Join-Path $resolvedOutputDirectory "v17-cutover-check-rollback.json"
    invalidRollback = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-rollback.json"
    rollbackWrongMonitoring = Join-Path $resolvedOutputDirectory "v17-cutover-check-rollback-wrong-monitoring.json"
    emailProvider = Join-Path $resolvedOutputDirectory "v17-cutover-check-email-provider.json"
    invalidEmailProvider = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-email-provider.json"
    alertRouting = Join-Path $resolvedOutputDirectory "v17-cutover-check-alert-routing.json"
    invalidAlertRouting = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-alert-routing.json"
    liveStakeholderWalkthrough = Join-Path $resolvedOutputDirectory "v17-cutover-check-live-walkthrough.json"
    invalidLiveStakeholderWalkthrough = Join-Path $resolvedOutputDirectory "v17-cutover-check-invalid-live-walkthrough.json"
}

$smokeEvidence = @{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    status = "PASSED"
    testRun = "fixture"
    apiResponses = @{
        adminLogin = @{ user = @{ email = "owner@example.com" }; accessToken = "[redacted]" }
        boundaryAccessRequest = @{ id = "fixture-boundary-access-request"; status = "PENDING" }
    }
    tableStateAfterTransactions = @{ tenants = @(@{ id = "fixture-tenant" }) }
}
($smokeEvidence + @{ baseUrl = "https://app.example.com" }) |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.frontendProxySmoke -Encoding utf8
($smokeEvidence + @{ baseUrl = "https://api.example.com" }) |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.directApiSmoke -Encoding utf8
@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    status = "PASSED"
    testRun = "fixture"
    baseUrl = "https://app.example.com"
    apiResponses = @{
        adminLogin = @{ user = @{ email = "owner@example.com" }; accessToken = "eyJhbGciOiJIUzI1NiJ9.fixture.signature" }
        boundaryAccessRequest = @{ id = "fixture-boundary-access-request"; status = "PENDING" }
    }
    tableStateAfterTransactions = @{ tenants = @(@{ id = "fixture-tenant" }) }
} |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidFrontendProxySmoke -Encoding utf8
@{ schema = "merhouse.v17.deployed-monitoring.v1"; checkedAt = (Get-Date).ToUniversalTime().ToString("o"); frontendBaseUrl = "https://app.example.com"; apiBaseUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.monitoring -Encoding utf8
@{ schema = "merhouse.v17.deployed-monitoring.v1"; checkedAt = (Get-Date).ToUniversalTime().ToString("o"); frontendBaseUrl = "https://app.example.com"; apiBaseUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.rollbackMonitoring -Encoding utf8
@{ schema = "merhouse.v17.deployed-monitoring.v1"; checkedAt = (Get-Date).ToUniversalTime().ToString("o"); frontendBaseUrl = "https://wrong-app.example.com"; apiBaseUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidRollbackMonitoring -Encoding utf8
@{ status = "PASSED"; generatedAt = (Get-Date).ToUniversalTime().ToString("o"); apiSmokeSeconds = 12.34 } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.performance -Encoding utf8
$loadSmokeRecords = @(1..200 | ForEach-Object { @{ ok = $true; ms = 25 } })
@{ schema = "merhouse.load-smoke.v1"; checkedAt = (Get-Date).ToUniversalTime().ToString("o"); baseUrl = "https://api.example.com"; concurrentUsers = 25; requestsPerUser = 8; totalRequests = 200; result = @{ passed = $true; failures = 0; averageMs = 25; maxMs = 80 }; records = $loadSmokeRecords } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.loadSmoke -Encoding utf8
@{ appUrl = "https://app.example.com"; apiUrl = "https://api.example.com"; checkedAt = (Get-Date).ToUniversalTime().ToString("o"); checkedRoutes = @("/admin", "/assistant") } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.browserTour -Encoding utf8
@{ schema = "merhouse.load-smoke.v1"; checkedAt = (Get-Date).ToUniversalTime().ToString("o"); baseUrl = "https://wrong-api.example.com"; concurrentUsers = 1; requestsPerUser = 1; totalRequests = 200; result = @{ passed = $false; failures = 1; averageMs = 900; maxMs = 900 }; records = @(@{ ok = $true; ms = 25 }) } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidLoadSmoke -Encoding utf8
@{ appUrl = "https://wrong-app.example.com"; apiUrl = "https://wrong-api.example.com"; checkedAt = ""; checkedRoutes = @() } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidBrowserTour -Encoding utf8
@{ schema = "merhouse.v17.deployed-monitoring.v1"; checkedAt = ""; frontendBaseUrl = "https://app.example.com"; apiBaseUrl = "https://api.example.com" } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidMonitoring -Encoding utf8
@{ status = "PASSED"; generatedAt = "after timing"; apiSmokeSeconds = 12.34 } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidPerformance -Encoding utf8

Set-Content -LiteralPath $artifactPaths.androidReleaseArtifact -Value "fixture signed Android artifact" -Encoding utf8
Set-Content -LiteralPath $artifactPaths.invalidAndroidReleaseArtifact -Value "changed Android artifact" -Encoding utf8
Set-Content -LiteralPath $artifactPaths.backupRestoreDump -Value "fixture postgres custom-format backup" -Encoding utf8
$androidArtifactHash = (Get-FileHash -LiteralPath $artifactPaths.androidReleaseArtifact -Algorithm SHA256).Hash.ToLowerInvariant()
$androidArtifactBytes = (Get-Item -LiteralPath $artifactPaths.androidReleaseArtifact).Length
$backupHash = (Get-FileHash -LiteralPath $artifactPaths.backupRestoreDump -Algorithm SHA256).Hash.ToLowerInvariant()
$backupBytes = (Get-Item -LiteralPath $artifactPaths.backupRestoreDump).Length

@{
    schema = "merhouse.v17.android-release.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = "fixture"
    apiBaseUrl = "https://api.example.com"
    artifactKind = "apk"
    artifactPath = $artifactPaths.androidReleaseArtifact
    sha256 = $androidArtifactHash
    bytes = $androidArtifactBytes
    versionCode = 17
    versionName = "17.0.0-internal"
    cleartextTraffic = "disabled-for-release"
    signing = "external-keystore-env"
} |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.androidRelease -Encoding utf8
@{
    schema = "merhouse.native-android-tour.report.v1"
    apiUrl = "https://api.example.com"
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    apkSha256 = $androidArtifactHash
    apkBytes = $androidArtifactBytes
    deviceSerials = @("emulator-fixture")
    checkedRoutes = 2
    records = @(
        @{ role = "OWNER"; route = "/admin"; screenshot = "fixture-owner-admin.png" },
        @{ role = "MERCHANT_ACTIVE"; route = "/merchant"; screenshot = "fixture-merchant.png" }
    )
    badRecords = @()
} |
    ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $artifactPaths.installedAndroidTour -Encoding utf8
@{
    schema = "merhouse.v17.backup-restore-drill.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = "fixture"
    backupPath = $artifactPaths.backupRestoreDump
    preflight = @{
        envAudit = "passed"
        vpsShape = "passed"
    }
    backupSha256 = $backupHash
    backupBytes = $backupBytes
    restored = $true
    secretPolicy = "manifest omits database credentials and env values"
} |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.backupRestore -Encoding utf8
@{
    schema = "merhouse.v17.rollback-rehearsal.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = "fixture"
    rollbackRan = $true
    preflight = @{
        envAudit = "passed"
        vpsShape = "passed"
    }
    postRollbackMonitoring = @{
        ran = $true
        frontendBaseUrl = "https://app.example.com"
        apiBaseUrl = "https://api.example.com"
        reportPath = $artifactPaths.rollbackMonitoring
    }
    secretPolicy = "Private env values, provider credentials, deployment logs, keystores, and backup archives are excluded from this manifest."
} |
    ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $artifactPaths.rollback -Encoding utf8
@{
    schema = "merhouse.v17.rollback-rehearsal.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = "fixture"
    rollbackRan = $true
    preflight = @{
        envAudit = "passed"
        vpsShape = "passed"
    }
    postRollbackMonitoring = @{
        ran = $true
        frontendBaseUrl = "https://app.example.com"
        apiBaseUrl = "https://api.example.com"
        reportPath = $artifactPaths.invalidRollbackMonitoring
    }
    secretPolicy = "Private env values, provider credentials, deployment logs, keystores, and backup archives are excluded from this manifest."
} |
    ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $artifactPaths.rollbackWrongMonitoring -Encoding utf8
@{
    schema = "merhouse.v17.email-provider-proof.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    providerStatus = "smtp-staging-proven"
    workflowsProven = @("password-recovery", "access-request", "notification-email")
    workflowEvidence = @{
        "password-recovery" = "reset-link provider message accepted for staged recipient"
        "access-request" = "account-ready provider message accepted for approved requester"
        "notification-email" = "notification provider message accepted for opted-in recipient"
    }
    workflowProviderStatuses = @{
        "password-recovery" = "SENT"
        "access-request" = "SENT"
        "notification-email" = "SENT"
    }
    deliveryEvidence = "operator-confirmed-smtp-staging-fixture"
    secretPolicy = "No SMTP credentials, reset tokens, invitation passwords, or message bodies are stored in this parser proof fixture."
} |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.emailProvider -Encoding utf8
@{
    schema = "merhouse.v17.alert-routing.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    routedSignals = @("api-health", "frontend-health", "failed-provider-delivery")
    signalEvidence = @{
        "api-health" = "API health alert reached the staging recipient"
        "frontend-health" = "frontend shell alert reached the staging recipient"
        "failed-provider-delivery" = "failed provider-delivery alert reached the staging recipient"
    }
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
    proofMode = "manual-live-review"
    rolesCovered = @("owner", "merchant", "warehouse", "support-admin", "auditor")
    reviewer = "local-proof-fixture"
    secretPolicy = "No smoke credentials, screenshots, or private endpoint tokens are stored in this parser proof fixture."
} |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.liveStakeholderWalkthrough -Encoding utf8

$attached = [ordered]@{
    androidRelease = [ordered]@{ schema = "merhouse.v17.android-release.v1"; path = $artifactPaths.androidRelease; apiBaseUrl = "https://api.example.com"; commitSha = "fixture"; artifactKind = "apk"; sha256 = $androidArtifactHash; bytes = $androidArtifactBytes; versionCode = 17; versionName = "17.0.0-internal" }
    installedAndroidTour = [ordered]@{ schema = "merhouse.native-android-tour.report.v1"; path = $artifactPaths.installedAndroidTour; apiUrl = "https://api.example.com"; apkSha256 = $androidArtifactHash; apkBytes = $androidArtifactBytes }
    backupRestore = [ordered]@{ schema = "merhouse.v17.backup-restore-drill.v1"; path = $artifactPaths.backupRestore; commitSha = "fixture" }
    rollback = [ordered]@{ schema = "merhouse.v17.rollback-rehearsal.v1"; path = $artifactPaths.rollback; commitSha = "fixture" }
    emailProvider = [ordered]@{ schema = "merhouse.v17.email-provider-proof.v1"; path = $artifactPaths.emailProvider; frontendBaseUrl = "https://app.example.com"; apiBaseUrl = "https://api.example.com"; providerStatus = "smtp-staging-proven" }
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
    providerStatus = "smtp-staging-proven"
    includedProof = [ordered]@{
        frontendProxySmoke = $true
        directApiSmoke = $true
        monitoringSamples = $true
        performanceApiTiming = $true
        loadSmoke = $true
        browserTour = $true
    }
    outputFiles = [ordered]@{
        frontendProxySmoke = $artifactPaths.frontendProxySmoke
        directApiSmoke = $artifactPaths.directApiSmoke
        monitoring = $artifactPaths.monitoring
        performance = $artifactPaths.performance
        loadSmoke = $artifactPaths.loadSmoke
        browserTour = $artifactPaths.browserTour
    }
    attachedEvidence = $attached
    productionClaim = $false
    claimBoundary = "fixture"
    nextRequiredEvidence = @()
}
$baseManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $validManifestPath -Encoding utf8

$missingManifest = $baseManifest | ConvertTo-Json -Depth 8 | ConvertFrom-Json
$missingManifest.nextRequiredEvidence = @("manual owner, merchant, warehouse, support-admin, and auditor live browser plus installed-Android walkthrough")
$missingManifest.includedProof.browserTour = $false
$missingManifest.outputFiles.loadSmoke = (Join-Path $resolvedOutputDirectory "missing-load-smoke.json")
$missingManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $missingEvidenceManifestPath -Encoding utf8

$wrongAttachmentManifest = $baseManifest | ConvertTo-Json -Depth 8 | ConvertFrom-Json
$wrongAttachmentManifest.attachedEvidence.androidRelease.schema = "merhouse.load-smoke.v1"
$wrongAttachmentManifest.attachedEvidence.androidRelease.path = $artifactPaths.invalidAndroidRelease
$wrongAttachmentManifest.attachedEvidence.androidRelease.versionCode = 99
$wrongAttachmentManifest.attachedEvidence.androidRelease.versionName = "wrong-version"
$wrongAttachmentManifest.attachedEvidence.installedAndroidTour.path = $artifactPaths.invalidInstalledAndroidTour
$wrongAttachmentManifest.attachedEvidence.backupRestore.path = $artifactPaths.invalidBackupRestore
$wrongAttachmentManifest.attachedEvidence.rollback.path = $artifactPaths.invalidRollback
$wrongAttachmentManifest.attachedEvidence.alertRouting.path = $artifactPaths.invalidAlertRouting
$wrongAttachmentManifest.attachedEvidence.emailProvider.path = $artifactPaths.invalidEmailProvider
$wrongAttachmentManifest.attachedEvidence.liveStakeholderWalkthrough.path = $artifactPaths.invalidLiveStakeholderWalkthrough
$wrongAttachmentManifest.outputFiles.frontendProxySmoke = $artifactPaths.invalidFrontendProxySmoke
$wrongAttachmentManifest.outputFiles.directApiSmoke = $artifactPaths.invalidBrowserTour
$wrongAttachmentManifest.outputFiles.monitoring = $artifactPaths.invalidMonitoring
$wrongAttachmentManifest.outputFiles.performance = $artifactPaths.invalidPerformance
$wrongAttachmentManifest.outputFiles.loadSmoke = $artifactPaths.invalidLoadSmoke
$wrongAttachmentManifest.outputFiles.browserTour = $artifactPaths.invalidBrowserTour
$wrongAttachmentManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $wrongAttachmentManifestPath -Encoding utf8

$wrongRollbackMonitoringManifest = $baseManifest | ConvertTo-Json -Depth 8 | ConvertFrom-Json
$wrongRollbackMonitoringManifest.attachedEvidence.rollback.path = $artifactPaths.rollbackWrongMonitoring
$wrongRollbackMonitoringManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $wrongRollbackMonitoringManifestPath -Encoding utf8

@{
    schema = "merhouse.v17.android-release.v1"
    commitSha = "wrong-fixture"
    apiBaseUrl = "https://api.example.com"
    artifactKind = "apk"
    artifactPath = $artifactPaths.invalidAndroidReleaseArtifact
    sha256 = $androidArtifactHash
    bytes = $androidArtifactBytes
    versionCode = 0
    versionName = ""
    cleartextTraffic = "true"
    signing = "embedded-keystore"
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidAndroidRelease -Encoding utf8

@{
    schema = "merhouse.v17.email-provider-proof.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://wrong-api.example.com"
    providerStatus = "smtp-staging-configured"
    workflowsProven = @("password-recovery")
    workflowEvidence = @{
        "password-recovery" = "only one workflow was checked for owner@example.com"
    }
    workflowProviderStatuses = @{
        "password-recovery" = "SENT"
    }
    deliveryEvidence = ""
    secretPolicy = "No SMTP credentials are stored."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidEmailProvider -Encoding utf8

@{
    schema = "merhouse.v17.alert-routing.v1"
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    routedSignals = @("frontend-health")
    signalEvidence = @{
        "frontend-health" = "only frontend alert routing was checked"
    }
    deliveryEvidence = ""
    secretPolicy = ""
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidAlertRouting -Encoding utf8

@{
    schema = "merhouse.native-android-tour.report.v1"
    apiUrl = "https://wrong-api.example.com"
    checkedAt = ""
    apkSha256 = "not-a-sha"
    apkBytes = 0
    deviceSerials = @()
    checkedRoutes = 0
    records = @()
    badRecords = @("loading-shell")
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidInstalledAndroidTour -Encoding utf8

@{
    schema = "merhouse.v17.backup-restore-drill.v1"
    commitSha = "wrong-fixture"
    backupPath = $artifactPaths.backupRestoreDump
    preflight = @{
        envAudit = "failed"
        vpsShape = "passed"
    }
    backupSha256 = $androidArtifactHash
    backupBytes = $androidArtifactBytes
    restored = $false
    secretPolicy = ""
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidBackupRestore -Encoding utf8

@{
    schema = "merhouse.v17.rollback-rehearsal.v1"
    commitSha = "wrong-fixture"
    rollbackRan = $false
    preflight = @{
        envAudit = "failed"
        vpsShape = "passed"
    }
    postRollbackMonitoring = @{
        ran = $false
        frontendBaseUrl = "https://wrong-app.example.com"
        apiBaseUrl = "https://wrong-api.example.com"
        reportPath = (Join-Path $resolvedOutputDirectory "missing-rollback-monitoring.json")
    }
    secretPolicy = ""
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $artifactPaths.invalidRollback -Encoding utf8

@{
    schema = "merhouse.v17.live-stakeholder-walkthrough.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://wrong-api.example.com"
    browserWalkthroughCompleted = $true
    installedAndroidWalkthroughCompleted = $false
    proofMode = "scripted-tour-only"
    rolesCovered = @("owner", "merchant")
    reviewer = "local-proof-fixture"
    secretPolicy = "No smoke credentials are stored."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $artifactPaths.invalidLiveStakeholderWalkthrough -Encoding utf8

& (Join-Path $PSScriptRoot "v17-cutover-readiness.ps1") -DeploymentEvidenceManifestPath $validManifestPath -OutputPath $validOutputPath

$failedAsExpected = $false
try {
    & (Join-Path $PSScriptRoot "v17-cutover-readiness.ps1") -DeploymentEvidenceManifestPath $missingEvidenceManifestPath -OutputPath $missingOutputPath
} catch {
    if ($_.Exception.Message -match "nextRequiredEvidence" -and $_.Exception.Message -match "browserTour" -and $_.Exception.Message -match "outputFiles.loadSmoke") {
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
        $_.Exception.Message -match "androidRelease.path artifact commitSha" -and
        $_.Exception.Message -match "androidRelease.path artifact sha256" -and
        $_.Exception.Message -match "androidRelease.path artifact versionCode" -and
        $_.Exception.Message -match "androidRelease.path artifact versionName" -and
        $_.Exception.Message -match "androidRelease.versionCode" -and
        $_.Exception.Message -match "androidRelease.versionName" -and
        $_.Exception.Message -match "androidRelease.path artifact cleartextTraffic" -and
        $_.Exception.Message -match "androidRelease.path artifact signing" -and
        $_.Exception.Message -match "outputFiles.frontendProxySmoke must not include apiResponses.adminLogin.accessToken" -and
        $_.Exception.Message -match "installedAndroidTour.path artifact apiUrl" -and
        $_.Exception.Message -match "installedAndroidTour.path artifact checkedAt" -and
        $_.Exception.Message -match "installedAndroidTour.path artifact apkSha256" -and
        $_.Exception.Message -match "installedAndroidTour.path artifact apkBytes" -and
        $_.Exception.Message -match "installedAndroidTour.path artifact deviceSerials" -and
        $_.Exception.Message -match "installedAndroidTour.path artifact checkedRoutes" -and
        $_.Exception.Message -match "installedAndroidTour.path artifact records" -and
        $_.Exception.Message -match "installedAndroidTour.path artifact badRecords" -and
        $_.Exception.Message -match "backupRestore.path artifact commitSha" -and
        $_.Exception.Message -match "backupRestore.path artifact restored" -and
        $_.Exception.Message -match "backupRestore.path artifact preflight.envAudit" -and
        $_.Exception.Message -match "backupRestore.path artifact backupSha256" -and
        $_.Exception.Message -match "rollback.path artifact commitSha" -and
        $_.Exception.Message -match "rollback.path artifact rollbackRan" -and
        $_.Exception.Message -match "rollback.path artifact preflight.envAudit" -and
        $_.Exception.Message -match "rollback.path artifact postRollbackMonitoring.ran" -and
        $_.Exception.Message -match "outputFiles.directApiSmoke status" -and
        $_.Exception.Message -match "outputFiles.directApiSmoke testRun" -and
        $_.Exception.Message -match "outputFiles.directApiSmoke apiResponses" -and
        $_.Exception.Message -match "outputFiles.monitoring checkedAt" -and
        $_.Exception.Message -match "outputFiles.performance generatedAt" -and
        $_.Exception.Message -match "outputFiles.loadSmoke baseUrl" -and
        $_.Exception.Message -match "outputFiles.loadSmoke result.passed" -and
        $_.Exception.Message -match "outputFiles.loadSmoke concurrentUsers" -and
        $_.Exception.Message -match "outputFiles.loadSmoke requestsPerUser" -and
        $_.Exception.Message -match "outputFiles.loadSmoke totalRequests" -and
        $_.Exception.Message -match "outputFiles.loadSmoke records count" -and
        $_.Exception.Message -match "outputFiles.browserTour appUrl" -and
        $_.Exception.Message -match "outputFiles.browserTour apiUrl" -and
        $_.Exception.Message -match "emailProvider.path artifact apiBaseUrl" -and
        $_.Exception.Message -match "emailProvider.path artifact providerStatus" -and
        $_.Exception.Message -match "emailProvider.path artifact must not include email-shaped PII" -and
        $_.Exception.Message -match "workflowsProven must include access-request" -and
        $_.Exception.Message -match "workflowEvidence.access-request" -and
        $_.Exception.Message -match "workflowProviderStatuses.access-request" -and
        $_.Exception.Message -match "alertRouting.path artifact routedSignals must include api-health" -and
        $_.Exception.Message -match "alertRouting.path artifact signalEvidence.api-health" -and
        $_.Exception.Message -match "alertRouting.path artifact deliveryEvidence" -and
        $_.Exception.Message -match "liveStakeholderWalkthrough.path artifact apiBaseUrl" -and
        $_.Exception.Message -match "installedAndroidWalkthroughCompleted" -and
        $_.Exception.Message -match "liveStakeholderWalkthrough.path artifact proofMode" -and
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

$failedAsExpected = $false
try {
    & (Join-Path $PSScriptRoot "v17-cutover-readiness.ps1") -DeploymentEvidenceManifestPath $wrongRollbackMonitoringManifestPath -OutputPath $wrongRollbackMonitoringOutputPath
} catch {
    if ($_.Exception.Message -match "postRollbackMonitoring.reportPath frontendBaseUrl") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Rollback evidence with wrong monitoring report target was accepted as cutover-ready."
}

Write-Host "V17 cutover readiness fixture check passed."
