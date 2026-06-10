param(
    [Parameter(Mandatory = $true)] [string]$FrontendBaseUrl,
    [Parameter(Mandatory = $true)] [string]$ApiBaseUrl,
    [string]$OutputDirectory = "reports",
    [string]$DeploymentLabel = "v17-deployed-proof",
    [string]$ProviderStatus = "not-recorded",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [string]$MerchantEmail = "review.merchant@merhouse.local",
    [string]$MerchantPassword = "review-password",
    [string]$WarehouseEmail = "review.operator@merhouse.local",
    [string]$WarehousePassword = "review-password",
    [string]$SupportAdminEmail = "review.support@merhouse.local",
    [string]$SupportAdminPassword = "review-password",
    [string]$AuditorEmail = "review.auditor@merhouse.local",
    [string]$AuditorPassword = "review-password",
    [switch]$IncludeBrowserTour,
    [switch]$IncludeLoadSmoke,
    [int]$ConcurrentUsers = 25,
    [int]$RequestsPerUser = 8
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

$normalizedFrontendBaseUrl = Assert-AbsoluteHttpUrl -Name "FrontendBaseUrl" -Value $FrontendBaseUrl
$normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
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
    & (Join-Path $PSScriptRoot "frontend-deploy-check.ps1") -BaseUrl $normalizedFrontendBaseUrl -OutputPath $frontendSmokeOutput
}

Invoke-Checked "Checking deployed API smoke..." {
    & (Join-Path $PSScriptRoot "api-smoke.ps1") -BaseUrl $normalizedApiBaseUrl -OutputPath $apiSmokeOutput -AdminEmail $AdminEmail -AdminPassword $AdminPassword
}

Invoke-Checked "Checking deployed monitoring samples..." {
    & (Join-Path $PSScriptRoot "deployed-monitoring-proof.ps1") -FrontendBaseUrl $normalizedFrontendBaseUrl -ApiBaseUrl $normalizedApiBaseUrl -OutputPath $monitoringOutput
}

Invoke-Checked "Checking deployed performance/API timing..." {
    & (Join-Path $PSScriptRoot "performance-readiness.ps1") -IncludeApiSmoke -ApiBaseUrl $normalizedApiBaseUrl -OutputPath $performanceOutput
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
    nextRequiredEvidence = @(
        "signed Android release proof against the same API URL",
        "installed Android walkthrough against deployed target",
        "backup restore drill",
        "rollback rehearsal",
        "monitoring alert routing proof",
        "manual owner, merchant, warehouse, support-admin, and auditor live walkthrough"
    )
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestOutput -Encoding utf8

Write-Host ""
Write-Host "V17 deployment evidence manifest: $manifestOutput"
Write-Host "V17 deployed proof completed for $normalizedFrontendBaseUrl / $normalizedApiBaseUrl."
