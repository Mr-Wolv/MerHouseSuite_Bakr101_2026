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
    [string]$AlertRoutingManifestPath = "",
    [string]$LiveStakeholderWalkthroughManifestPath = "",
    [switch]$IncludeBrowserTour,
    [switch]$IncludeLoadSmoke,
    [int]$ConcurrentUsers = 25,
    [int]$RequestsPerUser = 8
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

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

    $resolvedPath = if ([System.IO.Path]::IsPathRooted($Path)) {
        [System.IO.Path]::GetFullPath($Path)
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $projectRoot $Path))
    }
    if (-not (Test-Path -LiteralPath $resolvedPath)) {
        throw "$Name was not found: $resolvedPath"
    }

    try {
        $json = Get-Content -Raw -LiteralPath $resolvedPath | ConvertFrom-Json
    } catch {
        throw "$Name must be a JSON proof artifact with a schema field."
    }
    $schema = $json.schema
    if ([string]::IsNullOrWhiteSpace($schema) -and $Name -eq "InstalledAndroidTourReportPath") {
        $hasNativeTourProvenance =
            -not [string]::IsNullOrWhiteSpace($json.apkSha256) -and
            -not [string]::IsNullOrWhiteSpace($json.apiUrl) -and
            $null -ne $json.checkedRoutes -and
            @($json.deviceSerials).Count -gt 0
        if ($hasNativeTourProvenance) {
            $schema = "merhouse.native-android-tour.report.v1"
        }
    }
    if ([string]::IsNullOrWhiteSpace($schema)) {
        throw "$Name must include a non-blank schema field or recognized installed Android tour provenance."
    }

    $expectedSchemas = @{
        AndroidReleaseManifestPath = @("merhouse.v17.android-release.v1")
        InstalledAndroidTourReportPath = @("merhouse.native-android-tour.report.v1")
        BackupRestoreManifestPath = @("merhouse.v17.backup-restore-drill.v1")
        RollbackManifestPath = @("merhouse.v17.rollback-rehearsal.v1")
        AlertRoutingManifestPath = @("merhouse.v17.alert-routing.v1")
        LiveStakeholderWalkthroughManifestPath = @("merhouse.v17.live-stakeholder-walkthrough.v1")
    }
    if ($expectedSchemas.ContainsKey($Name) -and $schema -notin $expectedSchemas[$Name]) {
        throw "$Name schema must be one of: $($expectedSchemas[$Name] -join ', '). Found: $schema."
    }
    if ($Name -eq "AlertRoutingManifestPath") {
        if ([string]::IsNullOrWhiteSpace($json.frontendBaseUrl)) {
            throw "AlertRoutingManifestPath must include frontendBaseUrl."
        }
        if ([string]::IsNullOrWhiteSpace($json.apiBaseUrl)) {
            throw "AlertRoutingManifestPath must include apiBaseUrl."
        }
        if (@($json.routedSignals).Count -lt 1) {
            throw "AlertRoutingManifestPath must include at least one routedSignals entry."
        }
        if ([string]::IsNullOrWhiteSpace($json.deliveryEvidence)) {
            throw "AlertRoutingManifestPath must include deliveryEvidence."
        }
        if ([string]::IsNullOrWhiteSpace($json.secretPolicy)) {
            throw "AlertRoutingManifestPath must include secretPolicy."
        }
    }
    if ($Name -eq "LiveStakeholderWalkthroughManifestPath") {
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
        foreach ($role in @("owner", "merchant", "warehouse", "support-admin", "auditor")) {
            if (@($json.rolesCovered) -notcontains $role) {
                throw "LiveStakeholderWalkthroughManifestPath rolesCovered must include $role."
            }
        }
        if ([string]::IsNullOrWhiteSpace($json.reviewer)) {
            throw "LiveStakeholderWalkthroughManifestPath must include reviewer."
        }
        if ([string]::IsNullOrWhiteSpace($json.completedAt)) {
            throw "LiveStakeholderWalkthroughManifestPath must include completedAt."
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
$alertRoutingEvidence = Resolve-EvidenceAttachment -Name "AlertRoutingManifestPath" -Path $AlertRoutingManifestPath
$liveStakeholderWalkthroughEvidence = Resolve-EvidenceAttachment -Name "LiveStakeholderWalkthroughManifestPath" -Path $LiveStakeholderWalkthroughManifestPath

if ($androidReleaseEvidence -and $androidReleaseEvidence.apiBaseUrl -ne $normalizedApiBaseUrl) {
    throw "AndroidReleaseManifestPath apiBaseUrl must match deployed ApiBaseUrl. Expected $normalizedApiBaseUrl but found $($androidReleaseEvidence.apiBaseUrl)."
}
if ($installedAndroidTourEvidence -and $installedAndroidTourEvidence.apiUrl -ne $normalizedApiBaseUrl) {
    throw "InstalledAndroidTourReportPath apiUrl must match deployed ApiBaseUrl. Expected $normalizedApiBaseUrl but found $($installedAndroidTourEvidence.apiUrl)."
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

$resolvedOutputDirectory = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
}
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

Write-Host "V17 deployed proof frontend target: $normalizedFrontendBaseUrl"
Write-Host "V17 deployed proof API target: $normalizedApiBaseUrl"
Write-Host "V17 deployed proof output directory: $resolvedOutputDirectory"

$commitSha = ""
try {
    Push-Location $projectRoot
    $commitSha = (git rev-parse HEAD).Trim()
} catch {
    $commitSha = "unavailable"
} finally {
    Pop-Location
}

Invoke-Checked "Checking deployed frontend shell and proxy smoke..." {
    & (Join-Path $PSScriptRoot "frontend-deploy-check.ps1") `
        -BaseUrl $normalizedFrontendBaseUrl `
        -OutputPath $frontendSmokeOutput `
        -AdminEmail $AdminEmail `
        -AdminPassword $AdminPassword `
        -ExpectOpenApiDocs:$false
}

Invoke-Checked "Checking deployed API smoke..." {
    & (Join-Path $PSScriptRoot "api-smoke.ps1") -BaseUrl $normalizedApiBaseUrl -OutputPath $apiSmokeOutput -AdminEmail $AdminEmail -AdminPassword $AdminPassword -ExpectOpenApiDocs:$false
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
            -RequestsPerUser $RequestsPerUser
    }
} else {
    Write-Host ""
    Write-Host "Skipping deployed load smoke. Pass -IncludeLoadSmoke when the staging or production target is ready for concurrent health traffic."
}

if ($IncludeBrowserTour) {
    Invoke-Checked "Checking deployed browser route tour..." {
        & (Join-Path $PSScriptRoot "frontend-full-tour.ps1") `
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
            -AuditorPassword $AuditorPassword
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
