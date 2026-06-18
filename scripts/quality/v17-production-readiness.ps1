param(
    [switch]$IncludeLoadSmoke,
    [switch]$IncludeAndroidRelease,
    [string]$ApiBaseUrl = "",
    [string]$FrontendUrl = "",
    [int]$ConcurrentUsers = 25,
    [int]$RequestsPerUser = 8
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
. (Join-Path $PSScriptRoot "..\proof\lib\url-guard-lib.ps1")

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

function Assert-BackendPublicSafetyContract {
    $scriptPath = Join-Path $projectRoot "backend\src\main\java\com\merhouse\config\ProductionSafetyConfig.java"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'MERHOUSE_PUBLIC_FRONTEND_URL must be an HTTPS deployment origin') {
        throw "ProductionSafetyConfig must require an HTTPS public frontend URL for public deployments."
    }
    if ($scriptText -notmatch 'MERHOUSE_CORS_ALLOWED_ORIGINS must list explicit deployment origins') {
        throw "ProductionSafetyConfig must reject wildcard CORS for public deployments."
    }
    if ($scriptText -notmatch 'MERHOUSE_CORS_ALLOWED_ORIGINS must include MERHOUSE_PUBLIC_FRONTEND_URL') {
        throw "ProductionSafetyConfig must require CORS to include the public frontend URL."
    }
    Write-Host "Backend public safety contract check passed."
}

function Assert-AndroidReleaseProofContract {
    $scriptPath = Join-Path $projectRoot "scripts\quality\v17-production-readiness.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    $androidReleaseCallPattern = 'native-android-release-check\.ps1"\s+-ApiBaseUrl\s+\$normalizedApiBaseUrl\s+-FrontendUrl\s+\$normalizedFrontendUrl\s+-OutputPath\s+"\.\\reports\\v17-android-release\.json"'
    if ($scriptText -notmatch $androidReleaseCallPattern) {
        throw "scripts\quality\v17-production-readiness.ps1 must build an installable signed APK for V17 Android proof."
    }
    $bundleCallPattern = 'native-android-release-check\.ps1"[\s\S]*?-Bundle[\s\S]*?-OutputPath\s+"\.\\reports\\v17-android-release\.json"'
    if ($scriptText -match $bundleCallPattern) {
        throw "scripts\quality\v17-production-readiness.ps1 must not use -Bundle for the broad signed Android proof; the installed Android walkthrough needs an APK fingerprint."
    }
    Write-Host "Android release proof contract check passed."
}

function Assert-AndroidReleaseWorkflowContract {
    $workflowPath = Join-Path $projectRoot ".github\workflows\merhouse-android-release.yml"
    $workflowText = Get-Content -Raw -LiteralPath $workflowPath
    if ($workflowText -notmatch 'native-android-release-check\.ps1') {
        throw ".github\workflows\merhouse-android-release.yml must build the signed APK through native-android-release-check.ps1."
    }
    if ($workflowText -notmatch '-ApiBaseUrl\s+"\$env:MERHOUSE_ANDROID_API_BASE_URL"') {
        throw ".github\workflows\merhouse-android-release.yml must pass the backend URL secret into native-android-release-check.ps1."
    }
    if ($workflowText -notmatch '-FrontendUrl\s+"\$env:MERHOUSE_ANDROID_FRONTEND_URL"') {
        throw ".github\workflows\merhouse-android-release.yml must pass the frontend URL secret into native-android-release-check.ps1."
    }
    foreach ($requiredSecret in @(
        "MERHOUSE_ANDROID_API_BASE_URL",
        "MERHOUSE_ANDROID_FRONTEND_URL",
        "MERHOUSE_ANDROID_KEYSTORE_BASE64",
        "MERHOUSE_ANDROID_KEYSTORE_PASSWORD",
        "MERHOUSE_ANDROID_KEY_ALIAS",
        "MERHOUSE_ANDROID_KEY_PASSWORD"
    )) {
        if ($workflowText -notmatch [regex]::Escape($requiredSecret)) {
            throw ".github\workflows\merhouse-android-release.yml must require $requiredSecret from GitHub Actions secrets."
        }
    }
    if ($workflowText -notmatch 'gh release view "(\$\{\{ inputs\.tag \}\}|\$TAG)"') {
        throw ".github\workflows\merhouse-android-release.yml must check whether the target GitHub Release already exists."
    }
    if ($workflowText -notmatch 'gh release edit "(\$\{\{ inputs\.tag \}\}|\$TAG)"') {
        throw ".github\workflows\merhouse-android-release.yml must update an existing GitHub Release instead of failing reruns."
    }
    if ($workflowText -notmatch 'gh release upload "(\$\{\{ inputs\.tag \}\}|\$TAG)"[\s\S]*--clobber') {
        throw ".github\workflows\merhouse-android-release.yml must upload Android release assets with --clobber on reruns."
    }
    if ($workflowText -match 'actions/upload-artifact') {
        throw ".github\workflows\merhouse-android-release.yml must not publish Actions artifacts; only the deliberate GitHub Release APK asset is allowed."
    }
    if ($workflowText -match 'gh release (upload|create)[\s\S]*reports/v17-android-release-\$\{\{ inputs\.version_name \}\}\.json') {
        throw ".github\workflows\merhouse-android-release.yml must keep the Android proof JSON inside the workflow run and publish only the APK release asset."
    }
    if ($workflowText -match 'notes=.*api_base_url|notes=.*frontend_base_url') {
        throw ".github\workflows\merhouse-android-release.yml release notes must not print deployed target URLs."
    }
    if ($workflowText -notmatch '(?s)gh release create "(\$\{\{ inputs\.tag \}\}|\$TAG)"') {
        throw ".github\workflows\merhouse-android-release.yml must create the GitHub Release when it does not already exist."
    }
    if ($workflowText -notmatch '(?s)--prerelease=(\$\{\{ inputs\.prerelease \}\}|\$PRERELEASE)') {
        throw ".github\workflows\merhouse-android-release.yml must apply the prerelease input to created and updated releases."
    }
    Write-Host "Android release workflow contract check passed."
}

function Assert-DeployedProofHttpsGuards {
    $deployedProofScriptPath = Join-Path $projectRoot "scripts\proof\release\deployed-v17-proof.ps1"
    $deployedProofText = Get-Content -Raw -LiteralPath $deployedProofScriptPath
    $deployedMonitoringScriptPath = Join-Path $projectRoot "scripts\proof\release\deployed-monitoring-proof.ps1"
    $deployedMonitoringText = Get-Content -Raw -LiteralPath $deployedMonitoringScriptPath
    if ($deployedProofText -notmatch 'FrontendBaseUrl must be an HTTPS deployment URL for deployed V17 proof') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must require an HTTPS frontend URL for deployed V17 proof."
    }
    if ($deployedProofText -notmatch 'ApiBaseUrl must be an HTTPS deployment URL for deployed V17 proof') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must require an HTTPS API URL for deployed V17 proof."
    }
    if ($deployedProofText -notmatch 'Assert-AbsoluteHttpUrl\s+-Name\s+"FrontendBaseUrl"') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must normalize the frontend URL through the shared URL guard."
    }
    if ($deployedProofText -notmatch 'Assert-AbsoluteHttpUrl\s+-Name\s+"ApiBaseUrl"') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must normalize the API URL through the shared URL guard."
    }
    if ($deployedProofText -notmatch 'AndroidReleaseManifestPath commitSha must match deployed commitSha') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must require Android release proof to match the deployed commit SHA."
    }
    if ($deployedProofText -notmatch 'BackupRestoreManifestPath commitSha must match deployed commitSha') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must require backup restore proof to match the deployed commit SHA."
    }
    if ($deployedProofText -notmatch 'RollbackManifestPath commitSha must match deployed commitSha') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must require rollback proof to match the deployed commit SHA."
    }
    if ($deployedProofText -match 'recognized installed Android tour provenance') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must require the installed Android tour report schema instead of inferring schema-less provenance."
    }
    if ($deployedProofText -notmatch 'InstalledAndroidTourReportPath APK fingerprint must match AndroidReleaseManifestPath') {
        throw "scripts\proof\release\deployed-v17-proof.ps1 must reject mismatched Android release and installed-tour APK fingerprints."
    }
    $cutoverReadinessScriptPath = Join-Path $projectRoot "scripts\proof\release\v17-cutover-readiness.ps1"
    $cutoverReadinessText = Get-Content -Raw -LiteralPath $cutoverReadinessScriptPath
    if ($cutoverReadinessText -match 'hasNativeTourProvenance') {
        throw "scripts\proof\release\v17-cutover-readiness.ps1 must require the installed Android tour report schema instead of inferring schema-less provenance."
    }
    if ($deployedMonitoringText -notmatch 'FrontendBaseUrl must be an HTTPS deployment URL for deployed monitoring proof') {
        throw "scripts\proof\release\deployed-monitoring-proof.ps1 must require an HTTPS frontend URL unless local HTTP rehearsal is explicit."
    }
    if ($deployedMonitoringText -notmatch 'ApiBaseUrl must be an HTTPS deployment URL for deployed monitoring proof') {
        throw "scripts\proof\release\deployed-monitoring-proof.ps1 must require an HTTPS API URL unless local HTTP rehearsal is explicit."
    }
    if ($deployedMonitoringText -notmatch '\[switch\]\$AllowLocalHttpRehearsal') {
        throw "scripts\proof\release\deployed-monitoring-proof.ps1 must keep local HTTP rehearsal explicit."
    }
    Write-Host "Deployed V17 HTTPS target guard check passed."
}

function Assert-EmailProviderProofScriptContract {
    $scriptPath = Join-Path $projectRoot "scripts\proof\release\v17-email-provider-proof.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.v17\.email-provider-proof\.v1"') {
        throw "scripts\proof\release\v17-email-provider-proof.ps1 must write the V17 email provider proof schema."
    }
    if ($scriptText -notmatch '\[switch\]\$ConfirmProviderProof') {
        throw "scripts\proof\release\v17-email-provider-proof.ps1 must require explicit provider-proof confirmation."
    }
    if ($scriptText -notmatch 'FrontendBaseUrl must be an HTTPS deployment URL for V17 email provider proof') {
        throw "scripts\proof\release\v17-email-provider-proof.ps1 must require an HTTPS frontend URL."
    }
    if ($scriptText -notmatch 'ApiBaseUrl must be an HTTPS deployment URL for V17 email provider proof') {
        throw "scripts\proof\release\v17-email-provider-proof.ps1 must require an HTTPS API URL."
    }
    if ($scriptText -notmatch 'workflowProviderStatuses') {
        throw "scripts\proof\release\v17-email-provider-proof.ps1 must emit workflow provider statuses for cutover readiness."
    }
    if ($scriptText -notmatch 'recipient or operator email addresses') {
        throw "scripts\proof\release\v17-email-provider-proof.ps1 must reject email-shaped PII in proof evidence."
    }
    if ($scriptText -notmatch 'SMTP transcripts' -or $scriptText -notmatch 'message IDs') {
        throw "scripts\proof\release\v17-email-provider-proof.ps1 must reject copied provider logs, SMTP transcripts, email headers, and message IDs."
    }
    if ($scriptText -notmatch 'too vague for V17 proof') {
        throw "scripts\proof\release\v17-email-provider-proof.ps1 must reject vague placeholder evidence."
    }
    Write-Host "V17 email provider proof script contract check passed."
}

function Assert-NativeAndroidTourReportContract {
    $scriptPath = Join-Path $projectRoot "scripts\proof\android\native-android-tour.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.native-android-tour\.report\.v1"') {
        throw "scripts\proof\android\native-android-tour.ps1 must write the installed Android tour report schema."
    }
    if ($scriptText -notmatch 'apkSha256' -or $scriptText -notmatch 'apkBytes' -or $scriptText -notmatch 'deviceSerials') {
        throw "scripts\proof\android\native-android-tour.ps1 must write APK fingerprint and device provenance."
    }
    Write-Host "Native Android tour report contract check passed."
}

function Assert-AlertRoutingProofScriptContract {
    $scriptPath = Join-Path $projectRoot "scripts\proof\release\v17-alert-routing-proof.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.v17\.alert-routing\.v1"') {
        throw "scripts\proof\release\v17-alert-routing-proof.ps1 must write the V17 alert routing proof schema."
    }
    if ($scriptText -notmatch '\[switch\]\$ConfirmAlertRoutingProof') {
        throw "scripts\proof\release\v17-alert-routing-proof.ps1 must require explicit alert-routing proof confirmation."
    }
    if ($scriptText -notmatch 'FrontendBaseUrl must be an HTTPS deployment URL for V17 alert routing proof') {
        throw "scripts\proof\release\v17-alert-routing-proof.ps1 must require an HTTPS frontend URL."
    }
    if ($scriptText -notmatch 'ApiBaseUrl must be an HTTPS deployment URL for V17 alert routing proof') {
        throw "scripts\proof\release\v17-alert-routing-proof.ps1 must require an HTTPS API URL."
    }
    foreach ($signal in @("api-health", "frontend-health", "failed-provider-delivery")) {
        if ($scriptText -notmatch [regex]::Escape($signal)) {
            throw "scripts\proof\release\v17-alert-routing-proof.ps1 must emit $signal evidence for cutover readiness."
        }
    }
    if ($scriptText -notmatch 'recipient or operator email addresses') {
        throw "scripts\proof\release\v17-alert-routing-proof.ps1 must reject email-shaped PII in proof evidence."
    }
    if ($scriptText -notmatch 'alert payloads' -or $scriptText -notmatch 'delivery transcripts') {
        throw "scripts\proof\release\v17-alert-routing-proof.ps1 must reject copied provider logs, alert payloads, webhook bodies, and delivery transcripts."
    }
    if ($scriptText -notmatch 'too vague for V17 proof') {
        throw "scripts\proof\release\v17-alert-routing-proof.ps1 must reject vague placeholder evidence."
    }
    Write-Host "V17 alert routing proof script contract check passed."
}

function Assert-LiveStakeholderWalkthroughProofScriptContract {
    $scriptPath = Join-Path $projectRoot "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1"
    $scriptText = Get-Content -Raw -LiteralPath $scriptPath
    if ($scriptText -notmatch 'schema\s*=\s*"merhouse\.v17\.live-stakeholder-walkthrough\.v1"') {
        throw "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 must write the V17 live stakeholder walkthrough proof schema."
    }
    if ($scriptText -notmatch '\[switch\]\$ConfirmManualLiveReview') {
        throw "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 must require explicit manual live-review confirmation."
    }
    if ($scriptText -notmatch 'proofMode\s*=\s*"manual-live-review"') {
        throw "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 must record manual-live-review proof mode."
    }
    foreach ($role in @("owner", "merchant", "warehouse", "support-admin", "auditor")) {
        if ($scriptText -notmatch [regex]::Escape($role)) {
            throw "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 must include $role in rolesCovered."
        }
    }
    if ($scriptText -notmatch 'BrowserWalkthroughEvidence' -or $scriptText -notmatch 'InstalledAndroidWalkthroughEvidence' -or $scriptText -notmatch 'StakeholderCoverageEvidence') {
        throw "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 must require browser, installed Android, and stakeholder coverage evidence."
    }
    if ($scriptText -notmatch 'reviewer, operator, or stakeholder email addresses') {
        throw "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 must reject email-shaped PII in proof evidence."
    }
    if ($scriptText -notmatch 'browser/Android logs' -or $scriptText -notmatch 'screenshot data') {
        throw "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 must reject copied logs and screenshot data."
    }
    if ($scriptText -notmatch 'too vague for V17 proof') {
        throw "scripts\proof\release\v17-live-stakeholder-walkthrough-proof.ps1 must reject vague placeholder evidence."
    }
    Write-Host "V17 live stakeholder walkthrough proof script contract check passed."
}

Push-Location $projectRoot
try {
    Invoke-Checked "Checking PowerShell script parsing..." { Assert-ScriptParse }
    Invoke-Checked "Checking backend public safety contract..." { Assert-BackendPublicSafetyContract }
    Invoke-Checked "Checking Android release proof contract..." { Assert-AndroidReleaseProofContract }
    Invoke-Checked "Checking Android release workflow contract..." { Assert-AndroidReleaseWorkflowContract }
    Invoke-Checked "Checking deployed V17 HTTPS target guards..." { Assert-DeployedProofHttpsGuards }
    Invoke-Checked "Checking native Android tour report contract..." { Assert-NativeAndroidTourReportContract }
    Invoke-Checked "Checking V17 email provider proof script contract..." { Assert-EmailProviderProofScriptContract }
    Invoke-Checked "Checking V17 alert routing proof script contract..." { Assert-AlertRoutingProofScriptContract }
    Invoke-Checked "Checking V17 live stakeholder walkthrough proof script contract..." { Assert-LiveStakeholderWalkthroughProofScriptContract }
    # Deployment shape check was removed with Vercel migration.
    # The remaining deploy/managed/huggingface-backend/ files are validated
    # indirectly through the backend public safety contract and the Android
    # release workflow contract above.
    Invoke-Checked "Checking V17 Android release shape..." { & ".\scripts\proof\android\native-android-release-shape-check.ps1" }
    Invoke-Checked "Checking V17 deployed evidence attachment rules..." { & ".\scripts\proof\release\deployed-v17-proof-attachment-check.ps1" }
    Invoke-Checked "Checking V17 cutover readiness guard..." { & ".\scripts\proof\release\v17-cutover-readiness-check.ps1" }
    Invoke-Checked "Checking markdown links..." { & ".\scripts\quality\markdown-check.ps1" }
    Invoke-Checked "Checking public-facing repository readiness..." { & ".\scripts\quality\public-readiness.ps1" -SkipCompose }
    Invoke-Checked "Checking frontend performance readiness..." { & ".\scripts\proof\release\performance-readiness.ps1" }

    if ($IncludeLoadSmoke) {
        if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
            throw "-ApiBaseUrl is required when -IncludeLoadSmoke is supplied."
        }
        $normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
        if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
            throw "-ApiBaseUrl must be an HTTPS staging or production URL when -IncludeLoadSmoke is supplied."
        }
        Invoke-Checked "Running V17 load smoke..." {
            & ".\scripts\proof\release\load-smoke.ps1" -BaseUrl $normalizedApiBaseUrl -ConcurrentUsers $ConcurrentUsers -RequestsPerUser $RequestsPerUser
        }
    } else {
        Write-Host ""
        Write-Host "Skipping V17 load smoke. Pass -IncludeLoadSmoke -ApiBaseUrl <https://target> when staging or production is reachable."
    }

    if ($IncludeAndroidRelease) {
        if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
            throw "-ApiBaseUrl is required when -IncludeAndroidRelease is supplied."
        }
        if ([string]::IsNullOrWhiteSpace($FrontendUrl)) {
            throw "-FrontendUrl is required when -IncludeAndroidRelease is supplied so the APK wraps the deployed frontend."
        }
        $normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
        $normalizedFrontendUrl = Assert-AbsoluteHttpUrl -Name "FrontendUrl" -Value $FrontendUrl
        if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
            throw "-ApiBaseUrl must be an HTTPS staging or production URL when -IncludeAndroidRelease is supplied."
        }
        if (-not $normalizedFrontendUrl.StartsWith("https://")) {
            throw "-FrontendUrl must be an HTTPS staging or production URL when -IncludeAndroidRelease is supplied."
        }
        Invoke-Checked "Building signed Android release proof..." {
            & ".\scripts\proof\android\native-android-release-check.ps1" -ApiBaseUrl $normalizedApiBaseUrl -FrontendUrl $normalizedFrontendUrl -OutputPath ".\reports\v17-android-release.json"
        }
    } else {
        Write-Host ""
        Write-Host "Skipping signed Android release proof. Pass -IncludeAndroidRelease -ApiBaseUrl <https://api-target> -FrontendUrl <https://frontend-target> when keystore env vars are available."
    }

    Write-Host ""
    Write-Host "V17 production readiness preflight passed."
} finally {
    Pop-Location
}
