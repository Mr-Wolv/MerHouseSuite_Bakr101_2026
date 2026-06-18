param(
    [Parameter(Mandatory = $true)] [string]$FrontendBaseUrl,
    [Parameter(Mandatory = $true)] [string]$ApiBaseUrl,
    [string]$OutputDirectory = "reports",
    [string]$DeploymentLabel = "v17-deployed-proof",
    [string]$ProviderStatus = "not-recorded",
    [string]$AdminEmail = "",
    [string]$AdminPassword = "",
    [string]$MerchantEmail = "",
    [string]$MerchantPassword = "",
    [string]$WarehouseEmail = "",
    [string]$WarehousePassword = "",
    [string]$SupportAdminEmail = "",
    [string]$SupportAdminPassword = "",
    [string]$AuditorEmail = "",
    [string]$AuditorPassword = "",
    [string]$AndroidReleaseManifestPath = "",
    [string]$InstalledAndroidTourReportPath = "",
    [string]$BackupRestoreManifestPath = "",
    [string]$RollbackManifestPath = "",
    [string]$EmailProviderProofManifestPath = "",
    [string]$AlertRoutingManifestPath = "",
    [string]$LiveStakeholderWalkthroughManifestPath = "",
    [string]$EnvFile = ".secrets/deploy/managed/huggingface.env",
    [string]$PostgresContainer = "merhouse-production-postgres-1",
    [switch]$IncludeBrowserTour,
    [switch]$IncludeLoadSmoke,
    [int]$ConcurrentUsers = 25,
    [int]$RequestsPerUser = 8,
    [int]$MaxLoadAverageMs = 750,
    [int]$BrowserTourTimeoutMs = 420000
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")

function Assert-DeployedCredential {
    param(
        [Parameter(Mandatory = $true)] [string] $Name,
        [AllowNull()] [string] $Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name is required for deployed V17 proof. Pass staging or production smoke credentials explicitly."
    }
    $normalizedValue = $Value.Trim()
    if ($normalizedValue -in @(
        "admin@merhouse.local",
        "local-owner-password",
        "review.merchant@merhouse.local",
        "review.operator@merhouse.local",
        "review.support@merhouse.local",
        "review.auditor@merhouse.local",
        "review-password"
    )) {
        throw "$Name uses a local demo value. Deployed V17 proof requires explicit staging or production smoke credentials."
    }
}

function Resolve-EvidenceAttachment {
    param(
        [Parameter(Mandatory = $true)] [string] $Name,
        [AllowNull()] [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $null
    }

    function Assert-ProofTimestamp {
        param(
            [string]$FieldName,
            [AllowNull()]$Value
        )

        $timestamp = if ($null -eq $Value) { "" } else { $Value.ToString() }
        if ([string]::IsNullOrWhiteSpace($timestamp)) {
            throw "$Name $FieldName must be a non-blank ISO-8601 timestamp."
        }
        $parsed = [DateTimeOffset]::MinValue
        if (-not [DateTimeOffset]::TryParse(
            $timestamp,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind,
            [ref]$parsed
        )) {
            throw "$Name $FieldName must be a valid ISO-8601 timestamp."
        }
    }

    function Assert-NoSecretLeak {
        param(
            [AllowNull()]$Value,
            [string]$Path = "",
            [switch]$RejectEmailAddresses,
            [switch]$RejectProviderEvidenceBodies,
            [switch]$RejectOperationalProofBodies
        )

        if ($null -eq $Value) {
            return
        }

        if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string] -and $Value -isnot [System.Management.Automation.PSCustomObject]) {
            $index = 0
            foreach ($item in $Value) {
                Assert-NoSecretLeak -Value $item -Path "$Path[$index]" -RejectEmailAddresses:$RejectEmailAddresses -RejectProviderEvidenceBodies:$RejectProviderEvidenceBodies -RejectOperationalProofBodies:$RejectOperationalProofBodies
                $index++
            }
            return
        }

        if ($Value -is [System.Management.Automation.PSCustomObject]) {
            foreach ($property in $Value.PSObject.Properties) {
                $propertyPath = if ([string]::IsNullOrWhiteSpace($Path)) { $property.Name } else { "$Path.$($property.Name)" }
                $sensitiveField = $property.Name -match '^(?i)(accessToken|refreshToken|resetToken|temporaryPassword|password|apiKey|clientSecret|privateKey|signingSecret|smtpPassword)$'
                if ($sensitiveField) {
                    $raw = if ($null -eq $property.Value) { "" } else { $property.Value.ToString() }
                    if (-not [string]::IsNullOrWhiteSpace($raw) -and $raw -ne "[redacted]") {
                        throw "$Name must not include $propertyPath; redact sensitive proof values before attaching deployed V17 evidence."
                    }
                }
                Assert-NoSecretLeak -Value $property.Value -Path $propertyPath -RejectEmailAddresses:$RejectEmailAddresses -RejectProviderEvidenceBodies:$RejectProviderEvidenceBodies -RejectOperationalProofBodies:$RejectOperationalProofBodies
            }
            return
        }

        if ($Value -is [string]) {
            if ($RejectEmailAddresses -and $Value -match '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b') {
                throw "$Name must not include email-shaped PII at $Path; use reviewer initials, ticket references, or non-identifying proof labels."
            }
            if ($Value -match '(?i)\bBearer\s+[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+' -or
                $Value -match '(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|signing[_-]?secret)\s*[:=]\s*[''"]?[A-Za-z0-9_./+=:-]{16,}') {
                throw "$Name must not include token-shaped data at $Path; redact sensitive proof values before attaching deployed V17 evidence."
            }
            if ($RejectProviderEvidenceBodies -and $Path -ne "secretPolicy" -and $Value -match '(?i)(message[_ -]?body|provider[_ -]?log|smtp[_ -]?log|smtp[_ -]?transcript|email[_ -]?header|message[_ -]?id|raw[_ -]?email|alert[_ -]?payload|raw[_ -]?payload|webhook[_ -]?payload|webhook[_ -]?body|notification[_ -]?body|delivery[_ -]?transcript|http[_ -]?transcript|request[_ -]?body|response[_ -]?body)') {
                throw "$Name must not include copied provider logs, message bodies, alert payloads, SMTP/HTTP transcripts, headers, message IDs, or raw email/payload content at $Path."
            }
            if ($RejectOperationalProofBodies -and $Path -ne "secretPolicy" -and $Value -match '(?i)(deployment[_ -]?log|browser[_ -]?log|android[_ -]?log|adb[_ -]?logcat|logcat|stack[_ -]?trace|console[_ -]?output|raw[_ -]?log|screenshot[_ -]?data|data:image|base64)') {
                throw "$Name must not include copied deployment logs, browser/Android logs, stack traces, console output, or screenshot data at $Path."
            }
        }
    }

    function Assert-MonitoringReportPassed {
        param(
            [AllowNull()]$Report
        )

        if ([bool]$Report.localHttpRehearsal) {
            throw "$Name postRollbackMonitoring.reportPath localHttpRehearsal must be false for deployed V17 evidence."
        }
        if ($null -eq $Report.frontend -or $null -eq $Report.apiHealth) {
            throw "$Name postRollbackMonitoring.reportPath frontend and apiHealth result blocks must be present."
        }
        if ([int]$Report.frontend.failures -ne 0) {
            throw "$Name postRollbackMonitoring.reportPath frontend.failures must be zero."
        }
        if ([int]$Report.apiHealth.failures -ne 0) {
            throw "$Name postRollbackMonitoring.reportPath apiHealth.failures must be zero."
        }
        if (@($Report.frontend.records).Count -lt 1) {
            throw "$Name postRollbackMonitoring.reportPath frontend.records must include at least one sample."
        }
        if (@($Report.apiHealth.records).Count -lt 1) {
            throw "$Name postRollbackMonitoring.reportPath apiHealth.records must include at least one sample."
        }
        if (@($Report.frontend.records | Where-Object { -not [bool]$_.ok }).Count -gt 0) {
            throw "$Name postRollbackMonitoring.reportPath frontend.records must all be passing samples."
        }
        if (@($Report.apiHealth.records | Where-Object { -not [bool]$_.ok }).Count -gt 0) {
            throw "$Name postRollbackMonitoring.reportPath apiHealth.records must all be passing samples."
        }
        if ($null -eq $Report.budgets -or $null -eq $Report.budgets.maxFrontendMs -or $null -eq $Report.budgets.maxApiHealthMs) {
            throw "$Name postRollbackMonitoring.reportPath budgets.maxFrontendMs and budgets.maxApiHealthMs must be present."
        }
        if ([long]$Report.frontend.maxMs -gt [long]$Report.budgets.maxFrontendMs) {
            throw "$Name postRollbackMonitoring.reportPath frontend.maxMs must be within budgets.maxFrontendMs."
        }
        if ([long]$Report.apiHealth.maxMs -gt [long]$Report.budgets.maxApiHealthMs) {
            throw "$Name postRollbackMonitoring.reportPath apiHealth.maxMs must be within budgets.maxApiHealthMs."
        }
    }

    $resolvedPath = Resolve-MerHousePath -Path $Path -ProjectRoot $projectRoot
    if (-not (Test-Path -LiteralPath $resolvedPath)) {
        throw "$Name was not found: $resolvedPath"
    }

    try {
        $json = Get-Content -Raw -LiteralPath $resolvedPath | ConvertFrom-Json
    } catch {
        throw "$Name must be a JSON proof artifact with a schema field."
    }
    $rejectEmailAddresses = $Name -in @("EmailProviderProofManifestPath", "AlertRoutingManifestPath", "LiveStakeholderWalkthroughManifestPath")
    $rejectProviderEvidenceBodies = $Name -in @("EmailProviderProofManifestPath", "AlertRoutingManifestPath")
    $rejectOperationalProofBodies = $Name -eq "LiveStakeholderWalkthroughManifestPath"
    Assert-NoSecretLeak -Value $json -RejectEmailAddresses:$rejectEmailAddresses -RejectProviderEvidenceBodies:$rejectProviderEvidenceBodies -RejectOperationalProofBodies:$rejectOperationalProofBodies
    $schema = $json.schema
    if ([string]::IsNullOrWhiteSpace($schema)) {
        throw "$Name must include a non-blank schema field."
    }

    $expectedSchemas = @{
        AndroidReleaseManifestPath = @("merhouse.v17.android-release.v1")
        InstalledAndroidTourReportPath = @("merhouse.native-android-tour.report.v1")
        BackupRestoreManifestPath = @("merhouse.v17.backup-restore-drill.v1")
        RollbackManifestPath = @("merhouse.v17.rollback-rehearsal.v1")
        EmailProviderProofManifestPath = @("merhouse.v17.email-provider-proof.v1")
        AlertRoutingManifestPath = @("merhouse.v17.alert-routing.v1")
        LiveStakeholderWalkthroughManifestPath = @("merhouse.v17.live-stakeholder-walkthrough.v1")
    }
    if ($expectedSchemas.ContainsKey($Name) -and $schema -notin $expectedSchemas[$Name]) {
        throw "$Name schema must be one of: $($expectedSchemas[$Name] -join ', '). Found: $schema."
    }
    if ($Name -eq "AndroidReleaseManifestPath") {
        Assert-ProofTimestamp -FieldName "generatedAt" -Value $json.generatedAt
        if ([string]::IsNullOrWhiteSpace($json.apiBaseUrl)) {
            throw "AndroidReleaseManifestPath must include apiBaseUrl."
        }
        if ([string]::IsNullOrWhiteSpace($json.commitSha)) {
            throw "AndroidReleaseManifestPath must include commitSha."
        }
        if ($json.artifactKind -notin @("apk", "aab")) {
            throw "AndroidReleaseManifestPath artifactKind must be apk or aab."
        }
        if ([string]::IsNullOrWhiteSpace($json.artifactPath)) {
            throw "AndroidReleaseManifestPath must include artifactPath."
        }
        $artifactPath = Resolve-MerHousePath -Path $json.artifactPath -ProjectRoot $projectRoot
        if (-not (Test-Path -LiteralPath $artifactPath)) {
            throw "AndroidReleaseManifestPath artifactPath was not found: $artifactPath"
        }
        if ($json.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
            throw "AndroidReleaseManifestPath sha256 must be a 64-character hex digest."
        }
        $artifactHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($artifactHash -ne $json.sha256.ToLowerInvariant()) {
            throw "AndroidReleaseManifestPath sha256 must match artifactPath content."
        }
        $artifactBytes = (Get-Item -LiteralPath $artifactPath).Length
        if ([long]$json.bytes -ne $artifactBytes -or $artifactBytes -le 0) {
            throw "AndroidReleaseManifestPath bytes must match a non-empty artifactPath file."
        }
        if ($null -eq $json.versionCode -or $json.versionCode.ToString() -notmatch '^[1-9][0-9]*$') {
            throw "AndroidReleaseManifestPath versionCode must be a positive integer."
        }
        if ([string]::IsNullOrWhiteSpace($json.versionName)) {
            throw "AndroidReleaseManifestPath must include versionName."
        }
        if ($json.cleartextTraffic -ne "disabled-for-release") {
            throw "AndroidReleaseManifestPath cleartextTraffic must be disabled-for-release."
        }
        if ($json.signing -ne "external-keystore-env") {
            throw "AndroidReleaseManifestPath signing must be external-keystore-env."
        }
    }
    if ($Name -eq "InstalledAndroidTourReportPath") {
        if ([string]::IsNullOrWhiteSpace($json.apiUrl)) {
            throw "InstalledAndroidTourReportPath must include apiUrl."
        }
        Assert-ProofTimestamp -FieldName "checkedAt" -Value $json.checkedAt
        if ($json.apkSha256 -notmatch '^[a-fA-F0-9]{64}$') {
            throw "InstalledAndroidTourReportPath apkSha256 must be a 64-character hex digest."
        }
        if ([long]$json.apkBytes -le 0) {
            throw "InstalledAndroidTourReportPath apkBytes must be greater than zero."
        }
        if (@($json.deviceSerials).Count -lt 1) {
            throw "InstalledAndroidTourReportPath deviceSerials must include at least one connected device."
        }
        if ([int]$json.checkedRoutes -lt 1) {
            throw "InstalledAndroidTourReportPath checkedRoutes must be greater than zero."
        }
        if (@($json.records).Count -lt 1) {
            throw "InstalledAndroidTourReportPath records must include at least one installed-app route record."
        }
        if (@($json.badRecords).Count -gt 0) {
            throw "InstalledAndroidTourReportPath badRecords must be empty."
        }
    }
    if ($Name -eq "EmailProviderProofManifestPath") {
        Assert-ProofTimestamp -FieldName "completedAt" -Value $json.completedAt
        if ([string]::IsNullOrWhiteSpace($json.frontendBaseUrl)) {
            throw "EmailProviderProofManifestPath must include frontendBaseUrl."
        }
        if ([string]::IsNullOrWhiteSpace($json.apiBaseUrl)) {
            throw "EmailProviderProofManifestPath must include apiBaseUrl."
        }
        if ($json.providerStatus -notin @("smtp-staging-proven", "smtp-production-proven", "email-provider-proven")) {
            throw "EmailProviderProofManifestPath providerStatus must be a proven provider label."
        }
        foreach ($workflow in @("password-recovery", "access-request", "notification-email")) {
            if (@($json.workflowsProven) -notcontains $workflow) {
                throw "EmailProviderProofManifestPath workflowsProven must include $workflow."
            }
            if ($null -eq $json.workflowEvidence -or [string]::IsNullOrWhiteSpace($json.workflowEvidence.$workflow)) {
                throw "EmailProviderProofManifestPath workflowEvidence.$workflow must be non-blank."
            }
            if ($null -eq $json.workflowProviderStatuses -or $json.workflowProviderStatuses.$workflow -ne "SENT") {
                throw "EmailProviderProofManifestPath workflowProviderStatuses.$workflow must be SENT."
            }
        }
        if ([string]::IsNullOrWhiteSpace($json.deliveryEvidence)) {
            throw "EmailProviderProofManifestPath must include deliveryEvidence."
        }
        if ([string]::IsNullOrWhiteSpace($json.secretPolicy)) {
            throw "EmailProviderProofManifestPath must include secretPolicy."
        }
    }
    if ($Name -eq "BackupRestoreManifestPath") {
        Assert-ProofTimestamp -FieldName "generatedAt" -Value $json.generatedAt
        if ([string]::IsNullOrWhiteSpace($json.commitSha)) {
            throw "BackupRestoreManifestPath must include commitSha."
        }
        if (-not [bool]$json.restored) {
            throw "BackupRestoreManifestPath must set restored to true."
        }
        if ($json.preflight.envAudit -ne "passed") {
            throw "BackupRestoreManifestPath preflight.envAudit must be passed."
        }
        if ($json.preflight.deploymentShape -ne "passed") {
            throw "BackupRestoreManifestPath preflight.deploymentShape must be passed."
        }
        if ([string]::IsNullOrWhiteSpace($json.backupPath)) {
            throw "BackupRestoreManifestPath must include backupPath."
        }
        $backupPath = Resolve-MerHousePath -Path $json.backupPath -ProjectRoot $projectRoot
        if (-not (Test-Path -LiteralPath $backupPath)) {
            throw "BackupRestoreManifestPath backupPath was not found: $backupPath"
        }
        if ($json.backupSha256 -notmatch '^[a-fA-F0-9]{64}$') {
            throw "BackupRestoreManifestPath backupSha256 must be a 64-character hex digest."
        }
        $backupHash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($backupHash -ne $json.backupSha256.ToLowerInvariant()) {
            throw "BackupRestoreManifestPath backupSha256 must match backupPath content."
        }
        $backupBytes = (Get-Item -LiteralPath $backupPath).Length
        if ([long]$json.backupBytes -ne $backupBytes -or $backupBytes -le 0) {
            throw "BackupRestoreManifestPath backupBytes must match a non-empty backupPath file."
        }
        if ([string]::IsNullOrWhiteSpace($json.secretPolicy)) {
            throw "BackupRestoreManifestPath must include secretPolicy."
        }
    }
    if ($Name -eq "RollbackManifestPath") {
        Assert-ProofTimestamp -FieldName "generatedAt" -Value $json.generatedAt
        if ([string]::IsNullOrWhiteSpace($json.commitSha)) {
            throw "RollbackManifestPath must include commitSha."
        }
        if (-not [bool]$json.rollbackRan) {
            throw "RollbackManifestPath must set rollbackRan to true."
        }
        if ($json.preflight.envAudit -ne "passed") {
            throw "RollbackManifestPath preflight.envAudit must be passed."
        }
        if ($json.preflight.deploymentShape -ne "passed") {
            throw "RollbackManifestPath preflight.deploymentShape must be passed."
        }
        if ([string]::IsNullOrWhiteSpace($json.secretPolicy)) {
            throw "RollbackManifestPath must include secretPolicy."
        }
        if ($null -eq $json.postRollbackMonitoring -or -not [bool]$json.postRollbackMonitoring.ran) {
            throw "RollbackManifestPath postRollbackMonitoring.ran must be true."
        }
        if ([bool]$json.postRollbackMonitoring.ran) {
            if ([string]::IsNullOrWhiteSpace($json.postRollbackMonitoring.frontendBaseUrl)) {
                throw "RollbackManifestPath postRollbackMonitoring.frontendBaseUrl must be present when monitoring ran."
            }
            if ([string]::IsNullOrWhiteSpace($json.postRollbackMonitoring.apiBaseUrl)) {
                throw "RollbackManifestPath postRollbackMonitoring.apiBaseUrl must be present when monitoring ran."
            }
            $monitoringPath = Resolve-MerHousePath -Path $json.postRollbackMonitoring.reportPath -ProjectRoot $projectRoot
            if (-not (Test-Path -LiteralPath $monitoringPath)) {
                throw "RollbackManifestPath postRollbackMonitoring.reportPath was not found: $monitoringPath"
            }
            try {
                $monitoringReport = Get-Content -Raw -LiteralPath $monitoringPath | ConvertFrom-Json
            } catch {
                throw "RollbackManifestPath postRollbackMonitoring.reportPath must be readable JSON proof."
            }
            Assert-NoSecretLeak -Value $monitoringReport
            if ($monitoringReport.schema -ne "merhouse.v17.deployed-monitoring.v1") {
                throw "RollbackManifestPath postRollbackMonitoring.reportPath schema must be merhouse.v17.deployed-monitoring.v1."
            }
            Assert-ProofTimestamp -FieldName "postRollbackMonitoring.reportPath checkedAt" -Value $monitoringReport.checkedAt
            if ($monitoringReport.frontendBaseUrl -ne $json.postRollbackMonitoring.frontendBaseUrl) {
                throw "RollbackManifestPath postRollbackMonitoring.reportPath frontendBaseUrl must match postRollbackMonitoring.frontendBaseUrl."
            }
            if ($monitoringReport.apiBaseUrl -ne $json.postRollbackMonitoring.apiBaseUrl) {
                throw "RollbackManifestPath postRollbackMonitoring.reportPath apiBaseUrl must match postRollbackMonitoring.apiBaseUrl."
            }
            Assert-MonitoringReportPassed -Report $monitoringReport
        }
    }
    if ($Name -eq "AlertRoutingManifestPath") {
        Assert-ProofTimestamp -FieldName "generatedAt" -Value $json.generatedAt
        if ([string]::IsNullOrWhiteSpace($json.frontendBaseUrl)) {
            throw "AlertRoutingManifestPath must include frontendBaseUrl."
        }
        if ([string]::IsNullOrWhiteSpace($json.apiBaseUrl)) {
            throw "AlertRoutingManifestPath must include apiBaseUrl."
        }
        if (@($json.routedSignals).Count -lt 1) {
            throw "AlertRoutingManifestPath must include at least one routedSignals entry."
        }
        foreach ($signal in @("api-health", "frontend-health", "failed-provider-delivery")) {
            if (@($json.routedSignals) -notcontains $signal) {
                throw "AlertRoutingManifestPath routedSignals must include $signal."
            }
            if ($null -eq $json.signalEvidence -or [string]::IsNullOrWhiteSpace($json.signalEvidence.$signal)) {
                throw "AlertRoutingManifestPath signalEvidence.$signal must be non-blank."
            }
        }
        if ([string]::IsNullOrWhiteSpace($json.deliveryEvidence)) {
            throw "AlertRoutingManifestPath must include deliveryEvidence."
        }
        if ([string]::IsNullOrWhiteSpace($json.secretPolicy)) {
            throw "AlertRoutingManifestPath must include secretPolicy."
        }
    }
    if ($Name -eq "LiveStakeholderWalkthroughManifestPath") {
        Assert-ProofTimestamp -FieldName "completedAt" -Value $json.completedAt
        if ([string]::IsNullOrWhiteSpace($json.frontendBaseUrl)) {
            throw "LiveStakeholderWalkthroughManifestPath must include frontendBaseUrl."
        }
        if ([string]::IsNullOrWhiteSpace($json.apiBaseUrl)) {
            throw "LiveStakeholderWalkthroughManifestPath must include apiBaseUrl."
        }
        if (-not [bool]$json.browserWalkthroughCompleted) {
            throw "LiveStakeholderWalkthroughManifestPath must set browserWalkthroughCompleted to true."
        }
        if (-not [bool]$json.installedAndroidWalkthroughCompleted) {
            throw "LiveStakeholderWalkthroughManifestPath must set installedAndroidWalkthroughCompleted to true."
        }
        if ($json.proofMode -ne "manual-live-review") {
            throw "LiveStakeholderWalkthroughManifestPath proofMode must be manual-live-review."
        }
        foreach ($role in @("owner", "merchant", "warehouse", "support-admin", "auditor")) {
            if (@($json.rolesCovered) -notcontains $role) {
                throw "LiveStakeholderWalkthroughManifestPath rolesCovered must include $role."
            }
        }
        if ([string]::IsNullOrWhiteSpace($json.reviewer)) {
            throw "LiveStakeholderWalkthroughManifestPath must include reviewer."
        }
        foreach ($evidenceName in @("browserWalkthrough", "installedAndroidWalkthrough", "stakeholderCoverage")) {
            if ($null -eq $json.manualEvidence -or [string]::IsNullOrWhiteSpace($json.manualEvidence.$evidenceName)) {
                throw "LiveStakeholderWalkthroughManifestPath manualEvidence.$evidenceName must be non-blank."
            }
        }
        if ([string]::IsNullOrWhiteSpace($json.secretPolicy)) {
            throw "LiveStakeholderWalkthroughManifestPath must include secretPolicy."
        }
    }

    return [ordered]@{
        path = $resolvedPath
        schema = $schema
        frontendBaseUrl = $json.frontendBaseUrl
        apiBaseUrl = $json.apiBaseUrl
        apiUrl = $json.apiUrl
        providerStatus = $json.providerStatus
        commitSha = $json.commitSha
        artifactKind = $json.artifactKind
        artifactPath = $json.artifactPath
        sha256 = $json.sha256
        bytes = $json.bytes
        apkSha256 = $json.apkSha256
        apkBytes = $json.apkBytes
        versionCode = $json.versionCode
        versionName = $json.versionName
        postRollbackMonitoringFrontendBaseUrl = $json.postRollbackMonitoring.frontendBaseUrl
        postRollbackMonitoringApiBaseUrl = $json.postRollbackMonitoring.apiBaseUrl
    }
}

function Get-ProviderStatusEvidenceState {
    param([AllowNull()] [string] $Status)

    $normalized = if ($null -eq $Status) { "" } else { $Status.Trim().ToLowerInvariant() }
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        throw "ProviderStatus must be a non-blank deployment evidence label."
    }

    if ($normalized -in @(
        "smtp-staging-proven",
        "smtp-production-proven",
        "email-provider-proven",
        "email-disabled-by-policy"
    )) {
        return "closed"
    }

    if ($normalized -in @(
        "not-recorded",
        "smtp-staging-configured",
        "smtp-configured",
        "email-configured"
    )) {
        return "open"
    }

    throw "ProviderStatus must be one of: not-recorded, smtp-staging-configured, smtp-configured, email-configured, smtp-staging-proven, smtp-production-proven, email-provider-proven, email-disabled-by-policy."
}

$normalizedFrontendBaseUrl = Assert-AbsoluteHttpUrl -Name "FrontendBaseUrl" -Value $FrontendBaseUrl
$normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
if (-not $normalizedFrontendBaseUrl.StartsWith("https://")) {
    throw "FrontendBaseUrl must be an HTTPS deployment URL for deployed V17 proof."
}
if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
    throw "ApiBaseUrl must be an HTTPS deployment URL for deployed V17 proof."
}
$providerEvidenceState = Get-ProviderStatusEvidenceState -Status $ProviderStatus
Assert-DeployedCredential -Name "AdminEmail" -Value $AdminEmail
Assert-DeployedCredential -Name "AdminPassword" -Value $AdminPassword

if ($IncludeBrowserTour) {
    Assert-DeployedCredential -Name "MerchantEmail" -Value $MerchantEmail
    Assert-DeployedCredential -Name "MerchantPassword" -Value $MerchantPassword
    Assert-DeployedCredential -Name "WarehouseEmail" -Value $WarehouseEmail
    Assert-DeployedCredential -Name "WarehousePassword" -Value $WarehousePassword
    Assert-DeployedCredential -Name "SupportAdminEmail" -Value $SupportAdminEmail
    Assert-DeployedCredential -Name "SupportAdminPassword" -Value $SupportAdminPassword
    Assert-DeployedCredential -Name "AuditorEmail" -Value $AuditorEmail
    Assert-DeployedCredential -Name "AuditorPassword" -Value $AuditorPassword
}

$androidReleaseEvidence = Resolve-EvidenceAttachment -Name "AndroidReleaseManifestPath" -Path $AndroidReleaseManifestPath
$installedAndroidTourEvidence = Resolve-EvidenceAttachment -Name "InstalledAndroidTourReportPath" -Path $InstalledAndroidTourReportPath
$backupRestoreEvidence = Resolve-EvidenceAttachment -Name "BackupRestoreManifestPath" -Path $BackupRestoreManifestPath
$rollbackEvidence = Resolve-EvidenceAttachment -Name "RollbackManifestPath" -Path $RollbackManifestPath
$emailProviderEvidence = Resolve-EvidenceAttachment -Name "EmailProviderProofManifestPath" -Path $EmailProviderProofManifestPath
$alertRoutingEvidence = Resolve-EvidenceAttachment -Name "AlertRoutingManifestPath" -Path $AlertRoutingManifestPath
$liveStakeholderWalkthroughEvidence = Resolve-EvidenceAttachment -Name "LiveStakeholderWalkthroughManifestPath" -Path $LiveStakeholderWalkthroughManifestPath

if ($androidReleaseEvidence -and $androidReleaseEvidence.apiBaseUrl -ne $normalizedApiBaseUrl) {
    throw "AndroidReleaseManifestPath apiBaseUrl must match deployed ApiBaseUrl. Expected $normalizedApiBaseUrl but found $($androidReleaseEvidence.apiBaseUrl)."
}
if ($installedAndroidTourEvidence -and $installedAndroidTourEvidence.apiUrl -ne $normalizedApiBaseUrl) {
    throw "InstalledAndroidTourReportPath apiUrl must match deployed ApiBaseUrl. Expected $normalizedApiBaseUrl but found $($installedAndroidTourEvidence.apiUrl)."
}
if ($androidReleaseEvidence -and $installedAndroidTourEvidence) {
    if ($installedAndroidTourEvidence.apkSha256 -ne $androidReleaseEvidence.sha256 -or
        [long]$installedAndroidTourEvidence.apkBytes -ne [long]$androidReleaseEvidence.bytes) {
        throw "InstalledAndroidTourReportPath APK fingerprint must match AndroidReleaseManifestPath so the installed walkthrough proves the signed release artifact."
    }
}
if ($emailProviderEvidence -and $emailProviderEvidence.apiBaseUrl -ne $normalizedApiBaseUrl) {
    throw "EmailProviderProofManifestPath apiBaseUrl must match deployed ApiBaseUrl. Expected $normalizedApiBaseUrl but found $($emailProviderEvidence.apiBaseUrl)."
}
if ($emailProviderEvidence -and $emailProviderEvidence.frontendBaseUrl -ne $normalizedFrontendBaseUrl) {
    throw "EmailProviderProofManifestPath frontendBaseUrl must match deployed FrontendBaseUrl. Expected $normalizedFrontendBaseUrl but found $($emailProviderEvidence.frontendBaseUrl)."
}
if ($emailProviderEvidence -and $emailProviderEvidence.providerStatus.ToString().ToLowerInvariant() -ne $ProviderStatus.Trim().ToLowerInvariant()) {
    throw "EmailProviderProofManifestPath providerStatus must match ProviderStatus. Expected $ProviderStatus but found $($emailProviderEvidence.providerStatus)."
}
if ($rollbackEvidence -and -not [string]::IsNullOrWhiteSpace($rollbackEvidence.postRollbackMonitoringApiBaseUrl) -and $rollbackEvidence.postRollbackMonitoringApiBaseUrl -ne $normalizedApiBaseUrl) {
    throw "RollbackManifestPath postRollbackMonitoring.apiBaseUrl must match deployed ApiBaseUrl. Expected $normalizedApiBaseUrl but found $($rollbackEvidence.postRollbackMonitoringApiBaseUrl)."
}
if ($rollbackEvidence -and -not [string]::IsNullOrWhiteSpace($rollbackEvidence.postRollbackMonitoringFrontendBaseUrl) -and $rollbackEvidence.postRollbackMonitoringFrontendBaseUrl -ne $normalizedFrontendBaseUrl) {
    throw "RollbackManifestPath postRollbackMonitoring.frontendBaseUrl must match deployed FrontendBaseUrl. Expected $normalizedFrontendBaseUrl but found $($rollbackEvidence.postRollbackMonitoringFrontendBaseUrl)."
}
if ($alertRoutingEvidence -and $alertRoutingEvidence.apiBaseUrl -ne $normalizedApiBaseUrl) {
    throw "AlertRoutingManifestPath apiBaseUrl must match deployed ApiBaseUrl. Expected $normalizedApiBaseUrl but found $($alertRoutingEvidence.apiBaseUrl)."
}
if ($alertRoutingEvidence -and $alertRoutingEvidence.frontendBaseUrl -ne $normalizedFrontendBaseUrl) {
    throw "AlertRoutingManifestPath frontendBaseUrl must match deployed FrontendBaseUrl. Expected $normalizedFrontendBaseUrl but found $($alertRoutingEvidence.frontendBaseUrl)."
}
if ($liveStakeholderWalkthroughEvidence -and $liveStakeholderWalkthroughEvidence.apiBaseUrl -ne $normalizedApiBaseUrl) {
    throw "LiveStakeholderWalkthroughManifestPath apiBaseUrl must match deployed ApiBaseUrl. Expected $normalizedApiBaseUrl but found $($liveStakeholderWalkthroughEvidence.apiBaseUrl)."
}
if ($liveStakeholderWalkthroughEvidence -and $liveStakeholderWalkthroughEvidence.frontendBaseUrl -ne $normalizedFrontendBaseUrl) {
    throw "LiveStakeholderWalkthroughManifestPath frontendBaseUrl must match deployed FrontendBaseUrl. Expected $normalizedFrontendBaseUrl but found $($liveStakeholderWalkthroughEvidence.frontendBaseUrl)."
}

$resolvedOutputDirectory = Resolve-MerHousePath -Path $OutputDirectory -ProjectRoot $projectRoot
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$apiSmokeOutput = Join-Path $resolvedOutputDirectory "v17-deployed-api-smoke-$timestamp.json"
$frontendSmokeOutput = Join-Path $resolvedOutputDirectory "v17-deployed-frontend-proxy-smoke-$timestamp.json"
$monitoringOutput = Join-Path $resolvedOutputDirectory "v17-deployed-monitoring-$timestamp.json"
$performanceOutput = Join-Path $resolvedOutputDirectory "v17-deployed-performance-$timestamp.json"
$loadSmokeOutput = Join-Path $resolvedOutputDirectory "v17-deployed-load-smoke-$timestamp.json"
$tourOutput = Join-Path $resolvedOutputDirectory "v17-deployed-frontend-tour-$timestamp.json"
$manifestOutput = Join-Path $resolvedOutputDirectory "v17-deployment-evidence-$timestamp.json"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)] [string] $Label,
        [Parameter(Mandatory = $true)] [scriptblock] $Command
    )

    Write-Host ""
    Write-Host $Label
    $global:LASTEXITCODE = 0
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed."
    }
}

function Read-DeploymentEnvFile {
    param([Parameter(Mandatory = $true)] [string] $Path)

    $values = @{}
    $lineNumber = 0
    foreach ($line in Get-Content -LiteralPath $Path) {
        $lineNumber += 1
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }
        if ($trimmed -notmatch '^[A-Za-z_][A-Za-z0-9_]*=') {
            throw "Invalid env assignment at $Path line ${lineNumber}."
        }
        $parts = $trimmed -split "=", 2
        $values[$parts[0]] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

function Set-OrClearEnvVar {
    param(
        [Parameter(Mandatory = $true)] [string] $Name,
        [AllowNull()] [string] $Value
    )

    if ($null -eq $Value) {
        Remove-Item -Path "Env:$Name" -ErrorAction SilentlyContinue
    } else {
        Set-Item -Path "Env:$Name" -Value $Value
    }
}

$envPath = Resolve-MerHousePath -Path $EnvFile -ProjectRoot $projectRoot
if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Deployment EnvFile was not found: $envPath"
}
if ((Split-Path $envPath -Leaf) -eq "env.production.example") {
    throw "V17 deployed proof must use the ignored private deployment env file, not env.production.example."
}
$deploymentEnv = Read-DeploymentEnvFile -Path $envPath
foreach ($requiredEnvName in @("MERHOUSE_POSTGRES_USER", "MERHOUSE_POSTGRES_DB")) {
    if (-not $deploymentEnv.ContainsKey($requiredEnvName) -or [string]::IsNullOrWhiteSpace($deploymentEnv[$requiredEnvName])) {
        throw "Deployment EnvFile must include $requiredEnvName so direct database proof checks target the deployed stack."
    }
}
if ([string]::IsNullOrWhiteSpace($PostgresContainer)) {
    throw "PostgresContainer is required so direct database proof checks target the deployed stack."
}

$previousPostgresEnv = @{
    MERHOUSE_POSTGRES_CONTAINER = [Environment]::GetEnvironmentVariable("MERHOUSE_POSTGRES_CONTAINER", "Process")
    MERHOUSE_POSTGRES_USER = [Environment]::GetEnvironmentVariable("MERHOUSE_POSTGRES_USER", "Process")
    MERHOUSE_POSTGRES_DB = [Environment]::GetEnvironmentVariable("MERHOUSE_POSTGRES_DB", "Process")
}

Write-Host "V17 deployed proof frontend target: $normalizedFrontendBaseUrl"
Write-Host "V17 deployed proof API target: $normalizedApiBaseUrl"
Write-Host "V17 deployed proof output directory: $resolvedOutputDirectory"
Write-Host "V17 deployed proof direct DB container: $PostgresContainer"

$commitSha = ""
try {
    Push-Location $projectRoot
    $commitSha = (git rev-parse HEAD).Trim()
} catch {
    $commitSha = "unavailable"
} finally {
    Pop-Location
}

if ($commitSha -eq "unavailable" -and ($androidReleaseEvidence -or $backupRestoreEvidence -or $rollbackEvidence)) {
    throw "Git commit SHA must be available before attaching Android release, backup restore, or rollback evidence."
}
if ($androidReleaseEvidence -and $androidReleaseEvidence.commitSha -ne $commitSha) {
    throw "AndroidReleaseManifestPath commitSha must match deployed commitSha. Expected $commitSha but found $($androidReleaseEvidence.commitSha)."
}
if ($backupRestoreEvidence -and $backupRestoreEvidence.commitSha -ne $commitSha) {
    throw "BackupRestoreManifestPath commitSha must match deployed commitSha. Expected $commitSha but found $($backupRestoreEvidence.commitSha)."
}
if ($rollbackEvidence -and $rollbackEvidence.commitSha -ne $commitSha) {
    throw "RollbackManifestPath commitSha must match deployed commitSha. Expected $commitSha but found $($rollbackEvidence.commitSha)."
}

try {
    Set-Item -Path Env:MERHOUSE_POSTGRES_CONTAINER -Value $PostgresContainer
    Set-Item -Path Env:MERHOUSE_POSTGRES_USER -Value $deploymentEnv["MERHOUSE_POSTGRES_USER"]
    Set-Item -Path Env:MERHOUSE_POSTGRES_DB -Value $deploymentEnv["MERHOUSE_POSTGRES_DB"]

    Invoke-Checked "Checking deployed frontend shell and proxy smoke..." {
        & (Join-Path $PSScriptRoot "frontend-deploy-check.ps1") `
            -BaseUrl $normalizedFrontendBaseUrl `
            -OutputPath $frontendSmokeOutput `
            -AdminEmail $AdminEmail `
            -AdminPassword $AdminPassword `
            -ExpectOpenApiDocs:$false
    }

    Invoke-Checked "Checking deployed API smoke..." {
        & (Join-Path $PSScriptRoot "..\..\quality\api-smoke.ps1") -BaseUrl $normalizedApiBaseUrl -OutputPath $apiSmokeOutput -AdminEmail $AdminEmail -AdminPassword $AdminPassword -ExpectOpenApiDocs:$false
    }

    Invoke-Checked "Checking deployed monitoring samples..." {
        & (Join-Path $PSScriptRoot "deployed-monitoring-proof.ps1") -FrontendBaseUrl $normalizedFrontendBaseUrl -ApiBaseUrl $normalizedApiBaseUrl -OutputPath $monitoringOutput
    }

    Invoke-Checked "Checking deployed performance/API timing..." {
        & (Join-Path $PSScriptRoot "performance-readiness.ps1") `
            -IncludeApiSmoke `
            -ApiBaseUrl $normalizedApiBaseUrl `
            -ApiSmokeAdminEmail $AdminEmail `
            -ApiSmokeAdminPassword $AdminPassword `
            -ExpectOpenApiDocs:$false `
            -OutputPath $performanceOutput
    }

    if ($IncludeLoadSmoke) {
        Invoke-Checked "Checking deployed load smoke..." {
            & (Join-Path $PSScriptRoot "load-smoke.ps1") `
                -BaseUrl $normalizedApiBaseUrl `
                -OutputPath $loadSmokeOutput `
                -ConcurrentUsers $ConcurrentUsers `
                -RequestsPerUser $RequestsPerUser `
                -MaxAverageMs $MaxLoadAverageMs
        }
    } else {
        Write-Host ""
        Write-Host "Skipping deployed load smoke. Pass -IncludeLoadSmoke when the staging or production target is ready for concurrent health traffic."
    }
} finally {
    foreach ($entry in $previousPostgresEnv.GetEnumerator()) {
        Set-OrClearEnvVar -Name $entry.Key -Value $entry.Value
    }
}

if ($IncludeBrowserTour) {
    Invoke-Checked "Checking deployed browser route tour..." {
        & (Join-Path $PSScriptRoot "..\web\frontend-full-tour.ps1") `
            -BaseUrl $normalizedFrontendBaseUrl `
            -ApiUrl $normalizedApiBaseUrl `
            -OutputPath $tourOutput `
            -AdminEmail $AdminEmail `
            -AdminPassword $AdminPassword `
            -MerchantEmail $MerchantEmail `
            -MerchantPassword $MerchantPassword `
            -WarehouseEmail $WarehouseEmail `
            -WarehousePassword $WarehousePassword `
            -SupportAdminEmail $SupportAdminEmail `
            -SupportAdminPassword $SupportAdminPassword `
            -AuditorEmail $AuditorEmail `
            -AuditorPassword $AuditorPassword `
            -TourTimeoutMs $BrowserTourTimeoutMs `
            -Coverage Deployment
    }
} else {
    Write-Host ""
    Write-Host "Skipping deployed browser tour. Pass -IncludeBrowserTour after the target is seeded with stakeholder proof data."
}

$nextRequiredEvidence = @()
if (-not $androidReleaseEvidence) {
    $nextRequiredEvidence += "signed Android release proof against the same API URL"
}
if (-not $installedAndroidTourEvidence) {
    $nextRequiredEvidence += "installed Android walkthrough against deployed target"
}
if (-not $backupRestoreEvidence) {
    $nextRequiredEvidence += "backup restore drill"
}
if (-not $rollbackEvidence) {
    $nextRequiredEvidence += "rollback rehearsal"
}
if ($providerEvidenceState -eq "open") {
    $nextRequiredEvidence += "provider-backed recovery, access-request, and notification email proof or an explicit email-disabled production policy"
} elseif ($ProviderStatus.Trim().ToLowerInvariant() -ne "email-disabled-by-policy" -and -not $emailProviderEvidence) {
    $nextRequiredEvidence += "email provider proof artifact for recovery, access-request, and notification email workflows"
}
if (-not $alertRoutingEvidence) {
    $nextRequiredEvidence += "monitoring alert routing proof"
}
if (-not $liveStakeholderWalkthroughEvidence) {
    $nextRequiredEvidence += "manual owner, merchant, warehouse, support-admin, and auditor live browser plus installed-Android walkthrough"
}

$manifest = [ordered]@{
    schema = "merhouse.v17.deployment-evidence.v1"
    deploymentLabel = $DeploymentLabel
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = $commitSha
    frontendBaseUrl = $normalizedFrontendBaseUrl
    apiBaseUrl = $normalizedApiBaseUrl
    providerStatus = $ProviderStatus
    includedProof = [ordered]@{
        frontendProxySmoke = $true
        directApiSmoke = $true
        monitoringSamples = $true
        performanceApiTiming = $true
        loadSmoke = [bool]$IncludeLoadSmoke
        browserTour = [bool]$IncludeBrowserTour
    }
    outputFiles = [ordered]@{
        frontendProxySmoke = $frontendSmokeOutput
        directApiSmoke = $apiSmokeOutput
        monitoring = $monitoringOutput
        performance = $performanceOutput
        loadSmoke = if ($IncludeLoadSmoke) { $loadSmokeOutput } else { $null }
        browserTour = if ($IncludeBrowserTour) { $tourOutput } else { $null }
        manifest = $manifestOutput
    }
    attachedEvidence = [ordered]@{
        androidRelease = $androidReleaseEvidence
        installedAndroidTour = $installedAndroidTourEvidence
        backupRestore = $backupRestoreEvidence
        rollback = $rollbackEvidence
        emailProvider = $emailProviderEvidence
        alertRouting = $alertRoutingEvidence
        liveStakeholderWalkthrough = $liveStakeholderWalkthroughEvidence
    }
    productionClaim = $false
    claimBoundary = "Deployment evidence manifest only; productionClaim remains false until an explicit cutover decision is recorded after reviewing nextRequiredEvidence."
    nextRequiredEvidence = $nextRequiredEvidence
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestOutput -Encoding utf8

Write-Host ""
Write-Host "V17 deployment evidence manifest: $manifestOutput"
Write-Host "V17 deployed proof completed for $normalizedFrontendBaseUrl / $normalizedApiBaseUrl."
