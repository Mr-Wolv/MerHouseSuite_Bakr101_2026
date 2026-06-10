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

$validAlertPath = Join-Path $resolvedOutputDirectory "v17-alert-routing-proof-check-valid.json"
$wrongAlertPath = Join-Path $resolvedOutputDirectory "v17-alert-routing-proof-check-wrong.json"
$validWalkthroughPath = Join-Path $resolvedOutputDirectory "v17-live-walkthrough-proof-check-valid.json"
$wrongWalkthroughPath = Join-Path $resolvedOutputDirectory "v17-live-walkthrough-proof-check-wrong.json"
$validAndroidReleasePath = Join-Path $resolvedOutputDirectory "v17-android-release-proof-check-valid.json"
$wrongAndroidReleasePath = Join-Path $resolvedOutputDirectory "v17-android-release-proof-check-wrong.json"
$validAndroidArtifactPath = Join-Path $resolvedOutputDirectory "v17-android-release-proof-check.aab"
$wrongAndroidArtifactPath = Join-Path $resolvedOutputDirectory "v17-android-release-proof-check-wrong.aab"
$validInstalledAndroidTourPath = Join-Path $resolvedOutputDirectory "v17-installed-android-tour-proof-check-valid.json"
$wrongInstalledAndroidTourPath = Join-Path $resolvedOutputDirectory "v17-installed-android-tour-proof-check-wrong.json"
$validEmailProviderPath = Join-Path $resolvedOutputDirectory "v17-email-provider-proof-check-valid.json"
$wrongEmailProviderPath = Join-Path $resolvedOutputDirectory "v17-email-provider-proof-check-wrong.json"
$validBackupRestorePath = Join-Path $resolvedOutputDirectory "v17-backup-restore-proof-check-valid.json"
$wrongBackupRestorePath = Join-Path $resolvedOutputDirectory "v17-backup-restore-proof-check-wrong.json"
$validBackupDumpPath = Join-Path $resolvedOutputDirectory "v17-backup-restore-proof-check.dump"
$validRollbackPath = Join-Path $resolvedOutputDirectory "v17-rollback-proof-check-valid.json"
$wrongRollbackPath = Join-Path $resolvedOutputDirectory "v17-rollback-proof-check-wrong.json"
$validRollbackMonitoringPath = Join-Path $resolvedOutputDirectory "v17-rollback-monitoring-proof-check.json"

Set-Content -LiteralPath $validAndroidArtifactPath -Value "fixture signed Android artifact" -Encoding utf8
Set-Content -LiteralPath $wrongAndroidArtifactPath -Value "changed Android artifact" -Encoding utf8
Set-Content -LiteralPath $validBackupDumpPath -Value "fixture postgres custom-format backup" -Encoding utf8
$validAndroidArtifactHash = (Get-FileHash -LiteralPath $validAndroidArtifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
$validAndroidArtifactBytes = (Get-Item -LiteralPath $validAndroidArtifactPath).Length
$validBackupHash = (Get-FileHash -LiteralPath $validBackupDumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
$validBackupBytes = (Get-Item -LiteralPath $validBackupDumpPath).Length

@{
    schema = "merhouse.v17.android-release.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    apiBaseUrl = "https://api.example.com"
    artifactKind = "aab"
    artifactPath = $validAndroidArtifactPath
    sha256 = $validAndroidArtifactHash
    bytes = $validAndroidArtifactBytes
    versionCode = 17
    versionName = "17.0.0-internal"
    cleartextTraffic = "disabled-for-release"
    signing = "external-keystore-env"
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validAndroidReleasePath -Encoding utf8

@{
    schema = "merhouse.v17.android-release.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    apiBaseUrl = "https://api.example.com"
    artifactKind = "aab"
    artifactPath = $wrongAndroidArtifactPath
    sha256 = $validAndroidArtifactHash
    bytes = $validAndroidArtifactBytes
    versionCode = 0
    versionName = ""
    cleartextTraffic = "true"
    signing = "embedded-keystore"
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongAndroidReleasePath -Encoding utf8

@{
    schema = "merhouse.native-android-tour.report.v1"
    apiUrl = "https://api.example.com"
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    apkSha256 = $validAndroidArtifactHash
    apkBytes = $validAndroidArtifactBytes
    deviceSerials = @("emulator-fixture")
    checkedRoutes = 2
    records = @(
        @{ role = "OWNER"; route = "/admin"; screenshot = "fixture-owner-admin.png" },
        @{ role = "MERCHANT_ACTIVE"; route = "/merchant"; screenshot = "fixture-merchant.png" }
    )
    badRecords = @()
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $validInstalledAndroidTourPath -Encoding utf8

@{
    schema = "merhouse.native-android-tour.report.v1"
    apiUrl = "https://api.example.com"
    checkedAt = ""
    apkSha256 = "not-a-sha"
    apkBytes = 0
    deviceSerials = @()
    checkedRoutes = 0
    records = @()
    badRecords = @("loading-shell")
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongInstalledAndroidTourPath -Encoding utf8

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
    deliveryEvidence = "operator-confirmed-smtp-staging-fixture"
    secretPolicy = "No SMTP credentials, reset tokens, invitation passwords, or message bodies are stored in this parser proof fixture."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validEmailProviderPath -Encoding utf8

@{
    schema = "merhouse.v17.email-provider-proof.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://wrong-api.example.com"
    providerStatus = "smtp-staging-configured"
    workflowsProven = @("password-recovery")
    workflowEvidence = @{
        "password-recovery" = "only one workflow was checked"
    }
    deliveryEvidence = ""
    secretPolicy = "No SMTP credentials are stored."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongEmailProviderPath -Encoding utf8

@{
    schema = "merhouse.v17.backup-restore-drill.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    backupPath = $validBackupDumpPath
    preflight = @{
        envAudit = "passed"
        vpsShape = "passed"
    }
    backupSha256 = $validBackupHash
    backupBytes = $validBackupBytes
    restored = $true
    secretPolicy = "manifest omits database credentials and env values"
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validBackupRestorePath -Encoding utf8

@{
    schema = "merhouse.v17.backup-restore-drill.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    backupPath = $validBackupDumpPath
    preflight = @{
        envAudit = "failed"
        vpsShape = "passed"
    }
    backupSha256 = $validAndroidArtifactHash
    backupBytes = $validAndroidArtifactBytes
    restored = $false
    secretPolicy = ""
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongBackupRestorePath -Encoding utf8

@{
    schema = "merhouse.v17.deployed-monitoring.v1"
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validRollbackMonitoringPath -Encoding utf8

@{
    schema = "merhouse.v17.rollback-rehearsal.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    rollbackRan = $true
    preflight = @{
        envAudit = "passed"
        vpsShape = "passed"
    }
    postRollbackMonitoring = @{
        ran = $true
        frontendBaseUrl = "https://app.example.com"
        apiBaseUrl = "https://api.example.com"
        reportPath = $validRollbackMonitoringPath
    }
    secretPolicy = "Private env values, provider credentials, deployment logs, keystores, and backup archives are excluded from this manifest."
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $validRollbackPath -Encoding utf8

@{
    schema = "merhouse.v17.rollback-rehearsal.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    rollbackRan = $false
    preflight = @{
        envAudit = "failed"
        vpsShape = "passed"
    }
    postRollbackMonitoring = @{
        ran = $true
        frontendBaseUrl = "https://app.example.com"
        apiBaseUrl = "https://api.example.com"
        reportPath = (Join-Path $resolvedOutputDirectory "missing-rollback-monitoring-proof-check.json")
    }
    secretPolicy = ""
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $wrongRollbackPath -Encoding utf8

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
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validAlertPath -Encoding utf8

@{
    schema = "merhouse.load-smoke.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongAlertPath -Encoding utf8

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
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $validWalkthroughPath -Encoding utf8

@{
    schema = "merhouse.v17.live-stakeholder-walkthrough.v1"
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
    frontendBaseUrl = "https://app.example.com"
    apiBaseUrl = "https://api.example.com"
    browserWalkthroughCompleted = $true
    installedAndroidWalkthroughCompleted = $false
    rolesCovered = @("owner", "merchant")
    reviewer = "local-proof-fixture"
    secretPolicy = "No smoke credentials are stored."
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $wrongWalkthroughPath -Encoding utf8

$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot "deployed-v17-proof.ps1"),
    [ref]$tokens,
    [ref]$parseErrors
)
if ($parseErrors.Count -gt 0) {
    throw "deployed-v17-proof.ps1 has parse errors."
}
$resolverFunction = $ast.Find({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq "Resolve-EvidenceAttachment"
}, $true)
if ($null -eq $resolverFunction) {
    throw "Could not find Resolve-EvidenceAttachment in deployed-v17-proof.ps1."
}
$validationFunctions = $resolverFunction.Extent.Text

function Invoke-AttachmentResolver {
    param(
        [string]$Name,
        [string]$Path
    )

    $escapedRoot = $projectRoot.Path.Replace("'", "''")
    $escapedPath = $Path.Replace("'", "''")
    $scriptBlock = [scriptblock]::Create(@"
`$projectRoot = Resolve-Path '$escapedRoot'
$validationFunctions
Resolve-EvidenceAttachment -Name '$Name' -Path '$escapedPath' | ConvertTo-Json -Depth 6
"@)
    & $scriptBlock
}

$androidRelease = Invoke-AttachmentResolver -Name "AndroidReleaseManifestPath" -Path $validAndroidReleasePath | ConvertFrom-Json
if ($androidRelease.schema -ne "merhouse.v17.android-release.v1") {
    throw "Valid Android release attachment did not resolve with the expected schema."
}
if ($androidRelease.apiBaseUrl -ne "https://api.example.com" -or $androidRelease.artifactKind -ne "aab") {
    throw "Valid Android release attachment did not preserve release target metadata."
}
if ($androidRelease.sha256 -ne $validAndroidArtifactHash -or [long]$androidRelease.bytes -ne $validAndroidArtifactBytes) {
    throw "Valid Android release attachment did not preserve artifact hash and size."
}
if ([int]$androidRelease.versionCode -ne 17 -or $androidRelease.versionName -ne "17.0.0-internal") {
    throw "Valid Android release attachment did not preserve release version metadata."
}

$installedAndroidTour = Invoke-AttachmentResolver -Name "InstalledAndroidTourReportPath" -Path $validInstalledAndroidTourPath | ConvertFrom-Json
if ($installedAndroidTour.schema -ne "merhouse.native-android-tour.report.v1") {
    throw "Valid installed Android tour attachment did not resolve with the expected schema."
}
if ($installedAndroidTour.apiUrl -ne "https://api.example.com") {
    throw "Valid installed Android tour attachment did not preserve the API URL."
}

$emailProvider = Invoke-AttachmentResolver -Name "EmailProviderProofManifestPath" -Path $validEmailProviderPath | ConvertFrom-Json
if ($emailProvider.schema -ne "merhouse.v17.email-provider-proof.v1") {
    throw "Valid email-provider attachment did not resolve with the expected schema."
}
if ($emailProvider.frontendBaseUrl -ne "https://app.example.com" -or $emailProvider.apiBaseUrl -ne "https://api.example.com") {
    throw "Valid email-provider attachment did not preserve deployed target URLs."
}
if ($emailProvider.providerStatus -ne "smtp-staging-proven") {
    throw "Valid email-provider attachment did not preserve provider status."
}

$backupRestore = Invoke-AttachmentResolver -Name "BackupRestoreManifestPath" -Path $validBackupRestorePath | ConvertFrom-Json
if ($backupRestore.schema -ne "merhouse.v17.backup-restore-drill.v1") {
    throw "Valid backup-restore attachment did not resolve with the expected schema."
}

$rollback = Invoke-AttachmentResolver -Name "RollbackManifestPath" -Path $validRollbackPath | ConvertFrom-Json
if ($rollback.schema -ne "merhouse.v17.rollback-rehearsal.v1") {
    throw "Valid rollback attachment did not resolve with the expected schema."
}
if ($rollback.postRollbackMonitoringFrontendBaseUrl -ne "https://app.example.com" -or $rollback.postRollbackMonitoringApiBaseUrl -ne "https://api.example.com") {
    throw "Valid rollback attachment did not preserve post-rollback monitoring target URLs."
}

$resolved = Invoke-AttachmentResolver -Name "AlertRoutingManifestPath" -Path $validAlertPath | ConvertFrom-Json
if ($resolved.schema -ne "merhouse.v17.alert-routing.v1") {
    throw "Valid alert-routing attachment did not resolve with the expected schema."
}
if ($resolved.frontendBaseUrl -ne "https://app.example.com" -or $resolved.apiBaseUrl -ne "https://api.example.com") {
    throw "Valid alert-routing attachment did not preserve deployed target URLs."
}

$walkthrough = Invoke-AttachmentResolver -Name "LiveStakeholderWalkthroughManifestPath" -Path $validWalkthroughPath | ConvertFrom-Json
if ($walkthrough.schema -ne "merhouse.v17.live-stakeholder-walkthrough.v1") {
    throw "Valid live walkthrough attachment did not resolve with the expected schema."
}
if ($walkthrough.frontendBaseUrl -ne "https://app.example.com" -or $walkthrough.apiBaseUrl -ne "https://api.example.com") {
    throw "Valid live walkthrough attachment did not preserve deployed target URLs."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "AndroidReleaseManifestPath" -Path $wrongAndroidReleasePath | Out-Null
} catch {
    if ($_.Exception.Message -match "sha256 must match artifactPath content") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Wrong Android release artifact attachment was accepted."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "InstalledAndroidTourReportPath" -Path $wrongInstalledAndroidTourPath | Out-Null
} catch {
    if ($_.Exception.Message -match "checkedAt") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Incomplete installed Android tour attachment was accepted."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "AlertRoutingManifestPath" -Path $wrongAlertPath | Out-Null
} catch {
    if ($_.Exception.Message -match "AlertRoutingManifestPath schema must be one of") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Wrong-schema alert-routing attachment was accepted."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "EmailProviderProofManifestPath" -Path $wrongEmailProviderPath | Out-Null
} catch {
    if ($_.Exception.Message -match "providerStatus must be a proven provider label") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Incomplete email-provider attachment was accepted."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "BackupRestoreManifestPath" -Path $wrongBackupRestorePath | Out-Null
} catch {
    if ($_.Exception.Message -match "restored to true") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Incomplete backup-restore attachment was accepted."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "RollbackManifestPath" -Path $wrongRollbackPath | Out-Null
} catch {
    if ($_.Exception.Message -match "rollbackRan to true") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Incomplete rollback attachment was accepted."
}

$failedAsExpected = $false
try {
    Invoke-AttachmentResolver -Name "LiveStakeholderWalkthroughManifestPath" -Path $wrongWalkthroughPath | Out-Null
} catch {
    if ($_.Exception.Message -match "installedAndroidWalkthroughCompleted") {
        $failedAsExpected = $true
    } else {
        throw
    }
}

if (-not $failedAsExpected) {
    throw "Incomplete live walkthrough attachment was accepted."
}

Write-Host "Deployed V17 proof attachment rule check passed."
