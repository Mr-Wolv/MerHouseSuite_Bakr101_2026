param(
    [switch]$IncludeLoadSmoke,
    [switch]$IncludeAndroidRelease,
    [string]$ApiBaseUrl = "",
    [int]$ConcurrentUsers = 25,
    [int]$RequestsPerUser = 8
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

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

function Assert-ScriptParse {
    $parseFailed = $false
    Get-ChildItem -Path (Join-Path $projectRoot "scripts") -Recurse -Filter *.ps1 | ForEach-Object {
        $tokens = $null
        $parseErrors = $null
        $null = [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$parseErrors)
        if ($parseErrors.Count -gt 0) {
            $parseFailed = $true
            Write-Host $_.FullName
            $parseErrors | ForEach-Object { Write-Host $_.Message }
        }
    }
    if ($parseFailed) {
        throw "PowerShell script parser check failed."
    }
    Write-Host "PowerShell script parser check passed."
}

function Assert-PostgresBackupNameGuards {
    foreach ($relativePath in @("scripts\deploy\backup-postgres.ps1", "scripts\deploy\restore-postgres.ps1")) {
        $scriptPath = Join-Path $projectRoot $relativePath
        $scriptText = Get-Content -Raw -LiteralPath $scriptPath
        if ($scriptText -notmatch 'function\s+Assert-SafePostgresBackupName') {
            throw "$relativePath must define Assert-SafePostgresBackupName before composing container backup paths."
        }
        if ($scriptText -notmatch 'Assert-SafePostgresBackupName\s+-Name\s+\$backupName') {
            throw "$relativePath must validate backupName before using it in docker compose operations."
        }
        if ($scriptText -notmatch '\^\[A-Za-z0-9\]\[A-Za-z0-9\._-\]\{0,127\}\\\.dump\$') {
            throw "$relativePath must restrict PostgreSQL backup filenames to simple .dump names."
        }
    }
    Write-Host "PostgreSQL backup filename guard check passed."
}

function Assert-RollbackManifestContract {
    $scriptPath = Join-Path $projectRoot "scripts\deploy\rollback-drill.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.v17\.rollback-rehearsal\.v1"') {
        throw "scripts\deploy\rollback-drill.ps1 must write the V17 rollback rehearsal schema."
    }
    if ($scriptText -notmatch 'generatedAt\s*=\s*\(Get-Date\)\.ToUniversalTime\(\)\.ToString\("o"\)') {
        throw "scripts\deploy\rollback-drill.ps1 must write generatedAt so deployed proof can attach rollback rehearsal evidence."
    }
    if ($scriptText -match 'checkedAt\s*=') {
        throw "scripts\deploy\rollback-drill.ps1 must not use checkedAt for the rollback rehearsal manifest timestamp."
    }
    Write-Host "Rollback rehearsal manifest contract check passed."
}

function Assert-DeployedProofHttpsGuards {
    $deployedProofScriptPath = Join-Path $projectRoot "scripts\quality\deployed-v17-proof.ps1"
    $deployedProofText = Get-Content -Raw -LiteralPath $deployedProofScriptPath
    $deployedMonitoringScriptPath = Join-Path $projectRoot "scripts\quality\deployed-monitoring-proof.ps1"
    $deployedMonitoringText = Get-Content -Raw -LiteralPath $deployedMonitoringScriptPath
    if ($deployedProofText -notmatch 'FrontendBaseUrl must be an HTTPS deployment URL for deployed V17 proof') {
        throw "scripts\quality\deployed-v17-proof.ps1 must require an HTTPS frontend URL for deployed V17 proof."
    }
    if ($deployedProofText -notmatch 'ApiBaseUrl must be an HTTPS deployment URL for deployed V17 proof') {
        throw "scripts\quality\deployed-v17-proof.ps1 must require an HTTPS API URL for deployed V17 proof."
    }
    if ($deployedProofText -notmatch 'Assert-AbsoluteHttpUrl\s+-Name\s+"FrontendBaseUrl"') {
        throw "scripts\quality\deployed-v17-proof.ps1 must normalize the frontend URL through the shared URL guard."
    }
    if ($deployedProofText -notmatch 'Assert-AbsoluteHttpUrl\s+-Name\s+"ApiBaseUrl"') {
        throw "scripts\quality\deployed-v17-proof.ps1 must normalize the API URL through the shared URL guard."
    }
    if ($deployedProofText -notmatch 'AndroidReleaseManifestPath commitSha must match deployed commitSha') {
        throw "scripts\quality\deployed-v17-proof.ps1 must require Android release proof to match the deployed commit SHA."
    }
    if ($deployedProofText -notmatch 'BackupRestoreManifestPath commitSha must match deployed commitSha') {
        throw "scripts\quality\deployed-v17-proof.ps1 must require backup restore proof to match the deployed commit SHA."
    }
    if ($deployedProofText -notmatch 'RollbackManifestPath commitSha must match deployed commitSha') {
        throw "scripts\quality\deployed-v17-proof.ps1 must require rollback proof to match the deployed commit SHA."
    }
    if ($deployedProofText -match 'recognized installed Android tour provenance') {
        throw "scripts\quality\deployed-v17-proof.ps1 must require the installed Android tour report schema instead of inferring schema-less provenance."
    }
    $cutoverReadinessScriptPath = Join-Path $projectRoot "scripts\quality\v17-cutover-readiness.ps1"
    $cutoverReadinessText = Get-Content -Raw -LiteralPath $cutoverReadinessScriptPath
    if ($cutoverReadinessText -match 'hasNativeTourProvenance') {
        throw "scripts\quality\v17-cutover-readiness.ps1 must require the installed Android tour report schema instead of inferring schema-less provenance."
    }
    if ($deployedMonitoringText -notmatch 'FrontendBaseUrl must be an HTTPS deployment URL for deployed monitoring proof') {
        throw "scripts\quality\deployed-monitoring-proof.ps1 must require an HTTPS frontend URL unless local HTTP rehearsal is explicit."
    }
    if ($deployedMonitoringText -notmatch 'ApiBaseUrl must be an HTTPS deployment URL for deployed monitoring proof') {
        throw "scripts\quality\deployed-monitoring-proof.ps1 must require an HTTPS API URL unless local HTTP rehearsal is explicit."
    }
    if ($deployedMonitoringText -notmatch '\[switch\]\$AllowLocalHttpRehearsal') {
        throw "scripts\quality\deployed-monitoring-proof.ps1 must keep local HTTP rehearsal explicit."
    }
    Write-Host "Deployed V17 HTTPS target guard check passed."
}

function Assert-EmailProviderProofScriptContract {
    $scriptPath = Join-Path $projectRoot "scripts\quality\v17-email-provider-proof.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.v17\.email-provider-proof\.v1"') {
        throw "scripts\quality\v17-email-provider-proof.ps1 must write the V17 email provider proof schema."
    }
    if ($scriptText -notmatch '\[switch\]\$ConfirmProviderProof') {
        throw "scripts\quality\v17-email-provider-proof.ps1 must require explicit provider-proof confirmation."
    }
    if ($scriptText -notmatch 'FrontendBaseUrl must be an HTTPS deployment URL for V17 email provider proof') {
        throw "scripts\quality\v17-email-provider-proof.ps1 must require an HTTPS frontend URL."
    }
    if ($scriptText -notmatch 'ApiBaseUrl must be an HTTPS deployment URL for V17 email provider proof') {
        throw "scripts\quality\v17-email-provider-proof.ps1 must require an HTTPS API URL."
    }
    if ($scriptText -notmatch 'workflowProviderStatuses') {
        throw "scripts\quality\v17-email-provider-proof.ps1 must emit workflow provider statuses for cutover readiness."
    }
    if ($scriptText -notmatch 'recipient or operator email addresses') {
        throw "scripts\quality\v17-email-provider-proof.ps1 must reject email-shaped PII in proof evidence."
    }
    if ($scriptText -notmatch 'SMTP transcripts' -or $scriptText -notmatch 'message IDs') {
        throw "scripts\quality\v17-email-provider-proof.ps1 must reject copied provider logs, SMTP transcripts, email headers, and message IDs."
    }
    Write-Host "V17 email provider proof script contract check passed."
}

function Assert-NativeAndroidTourReportContract {
    $scriptPath = Join-Path $projectRoot "scripts\quality\native-android-tour.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.native-android-tour\.report\.v1"') {
        throw "scripts\quality\native-android-tour.ps1 must write the installed Android tour report schema."
    }
    if ($scriptText -notmatch 'apkSha256' -or $scriptText -notmatch 'apkBytes' -or $scriptText -notmatch 'deviceSerials') {
        throw "scripts\quality\native-android-tour.ps1 must write APK fingerprint and device provenance."
    }
    Write-Host "Native Android tour report contract check passed."
}

function Assert-AlertRoutingProofScriptContract {
    $scriptPath = Join-Path $projectRoot "scripts\quality\v17-alert-routing-proof.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.v17\.alert-routing\.v1"') {
        throw "scripts\quality\v17-alert-routing-proof.ps1 must write the V17 alert routing proof schema."
    }
    if ($scriptText -notmatch '\[switch\]\$ConfirmAlertRoutingProof') {
        throw "scripts\quality\v17-alert-routing-proof.ps1 must require explicit alert-routing proof confirmation."
    }
    if ($scriptText -notmatch 'FrontendBaseUrl must be an HTTPS deployment URL for V17 alert routing proof') {
        throw "scripts\quality\v17-alert-routing-proof.ps1 must require an HTTPS frontend URL."
    }
    if ($scriptText -notmatch 'ApiBaseUrl must be an HTTPS deployment URL for V17 alert routing proof') {
        throw "scripts\quality\v17-alert-routing-proof.ps1 must require an HTTPS API URL."
    }
    foreach ($signal in @("api-health", "frontend-health", "failed-provider-delivery")) {
        if ($scriptText -notmatch [regex]::Escape($signal)) {
            throw "scripts\quality\v17-alert-routing-proof.ps1 must emit $signal evidence for cutover readiness."
        }
    }
    if ($scriptText -notmatch 'recipient or operator email addresses') {
        throw "scripts\quality\v17-alert-routing-proof.ps1 must reject email-shaped PII in proof evidence."
    }
    Write-Host "V17 alert routing proof script contract check passed."
}

function Assert-LiveStakeholderWalkthroughProofScriptContract {
    $scriptPath = Join-Path $projectRoot "scripts\quality\v17-live-stakeholder-walkthrough-proof.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.v17\.live-stakeholder-walkthrough\.v1"') {
        throw "scripts\quality\v17-live-stakeholder-walkthrough-proof.ps1 must write the V17 live stakeholder walkthrough proof schema."
    }
    if ($scriptText -notmatch '\[switch\]\$ConfirmManualLiveReview') {
        throw "scripts\quality\v17-live-stakeholder-walkthrough-proof.ps1 must require explicit manual live-review confirmation."
    }
    if ($scriptText -notmatch 'proofMode\s*=\s*"manual-live-review"') {
        throw "scripts\quality\v17-live-stakeholder-walkthrough-proof.ps1 must record manual-live-review proof mode."
    }
    foreach ($role in @("owner", "merchant", "warehouse", "support-admin", "auditor")) {
        if ($scriptText -notmatch [regex]::Escape($role)) {
            throw "scripts\quality\v17-live-stakeholder-walkthrough-proof.ps1 must include $role in rolesCovered."
        }
    }
    if ($scriptText -notmatch 'BrowserWalkthroughEvidence' -or $scriptText -notmatch 'InstalledAndroidWalkthroughEvidence' -or $scriptText -notmatch 'StakeholderCoverageEvidence') {
        throw "scripts\quality\v17-live-stakeholder-walkthrough-proof.ps1 must require browser, installed Android, and stakeholder coverage evidence."
    }
    if ($scriptText -notmatch 'reviewer, operator, or stakeholder email addresses') {
        throw "scripts\quality\v17-live-stakeholder-walkthrough-proof.ps1 must reject email-shaped PII in proof evidence."
    }
    Write-Host "V17 live stakeholder walkthrough proof script contract check passed."
}

Push-Location $projectRoot
try {
    Invoke-Checked "Checking PowerShell script parsing..." { Assert-ScriptParse }
    Invoke-Checked "Checking PostgreSQL backup filename guards..." { Assert-PostgresBackupNameGuards }
    Invoke-Checked "Checking rollback rehearsal manifest contract..." { Assert-RollbackManifestContract }
    Invoke-Checked "Checking deployed V17 HTTPS target guards..." { Assert-DeployedProofHttpsGuards }
    Invoke-Checked "Checking native Android tour report contract..." { Assert-NativeAndroidTourReportContract }
    Invoke-Checked "Checking V17 email provider proof script contract..." { Assert-EmailProviderProofScriptContract }
    Invoke-Checked "Checking V17 alert routing proof script contract..." { Assert-AlertRoutingProofScriptContract }
    Invoke-Checked "Checking V17 live stakeholder walkthrough proof script contract..." { Assert-LiveStakeholderWalkthroughProofScriptContract }
    Invoke-Checked "Checking V17 env template audit..." { & ".\scripts\deploy\env-audit.ps1" -EnvFile "deploy/vps/env.production.example" -AllowTemplate }
    Invoke-Checked "Checking V17 VPS deployment shape..." { & ".\scripts\deploy\vps-check.ps1" }
    Invoke-Checked "Checking V17 reverse proxy template..." { & ".\scripts\deploy\reverse-proxy-check.ps1" }
    Invoke-Checked "Checking V17 Android release shape..." { & ".\scripts\quality\native-android-release-shape-check.ps1" }
    Invoke-Checked "Checking V17 deployed evidence attachment rules..." { & ".\scripts\quality\deployed-v17-proof-attachment-check.ps1" }
    Invoke-Checked "Checking V17 cutover readiness guard..." { & ".\scripts\quality\v17-cutover-readiness-check.ps1" }
    Invoke-Checked "Checking markdown links..." { & ".\scripts\quality\markdown-check.ps1" }
    Invoke-Checked "Checking public-facing repository readiness..." { & ".\scripts\quality\public-readiness.ps1" -SkipCompose }
    Invoke-Checked "Checking frontend performance readiness..." { & ".\scripts\quality\performance-readiness.ps1" }

    if ($IncludeLoadSmoke) {
        if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
            throw "-ApiBaseUrl is required when -IncludeLoadSmoke is supplied."
        }
        $normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
        if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
            throw "-ApiBaseUrl must be an HTTPS staging or production URL when -IncludeLoadSmoke is supplied."
        }
        Invoke-Checked "Running V17 load smoke..." {
            & ".\scripts\quality\load-smoke.ps1" -BaseUrl $normalizedApiBaseUrl -ConcurrentUsers $ConcurrentUsers -RequestsPerUser $RequestsPerUser
        }
    } else {
        Write-Host ""
        Write-Host "Skipping V17 load smoke. Pass -IncludeLoadSmoke -ApiBaseUrl <https://target> when staging or production is reachable."
    }

    if ($IncludeAndroidRelease) {
        if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
            throw "-ApiBaseUrl is required when -IncludeAndroidRelease is supplied."
        }
        $normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
        if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
            throw "-ApiBaseUrl must be an HTTPS staging or production URL when -IncludeAndroidRelease is supplied."
        }
        Invoke-Checked "Building signed Android release proof..." {
            & ".\scripts\quality\native-android-release-check.ps1" -ApiBaseUrl $normalizedApiBaseUrl -Bundle -OutputPath ".\reports\v17-android-release.json"
        }
    } else {
        Write-Host ""
        Write-Host "Skipping signed Android release proof. Pass -IncludeAndroidRelease -ApiBaseUrl <https://target> when keystore env vars are available."
    }

    Write-Host ""
    Write-Host "V17 production readiness preflight passed."
} finally {
    Pop-Location
}
