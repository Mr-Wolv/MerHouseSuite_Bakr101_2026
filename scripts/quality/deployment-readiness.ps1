param(
    [switch]$IncludeE2E,
    [switch]$IncludeApiSmoke,
    [switch]$SkipCompose,
    [string]$ApiBaseUrl = "http://localhost:8080",
    [string]$NativeApiBaseUrl = "http://10.0.2.2:8080",
    [string]$WebTourReportPath = "",
    [string]$NativeTourReportPath = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$dossierPath = Join-Path $projectRoot "docs\\quality\\deployment-ready-local-certification.md"

function Assert-FileContains {
    param(
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [string] $Pattern,
        [Parameter(Mandatory = $true)] [string] $Message
    )

    if (-not (Select-String -Path $Path -Pattern $Pattern -Quiet)) {
        throw $Message
    }
}

function Resolve-DeploymentPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $projectRoot $Path))
}

. (Join-Path $PSScriptRoot "..\proof\lib\url-guard-lib.ps1")

$normalizedApiBaseUrl = $ApiBaseUrl
if ($IncludeApiSmoke) {
    $normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
}
$normalizedNativeApiBaseUrl = Assert-AbsoluteHttpUrl -Name "NativeApiBaseUrl" -Value $NativeApiBaseUrl

Write-Host "Checking V16.2 deployment-ready local certification dossier..."
if (-not (Test-Path $dossierPath)) {
    throw "Missing deployment-ready local certification dossier at $dossierPath"
}

Assert-FileContains -Path $dossierPath -Pattern "V16\.2 is not a SaaS launch" -Message "Dossier must state that V16.2 is not a SaaS launch."
Assert-FileContains -Path $dossierPath -Pattern "Local Mock Contracts" -Message "Dossier must define local mock contracts."
Assert-FileContains -Path $dossierPath -Pattern "Account Settings" -Message "Dossier must include account settings scope."
Assert-FileContains -Path $dossierPath -Pattern "Future Activation Checklist" -Message "Dossier must include future activation checklist."

$hasWebTourReport = -not [string]::IsNullOrWhiteSpace($WebTourReportPath)
$hasNativeTourReport = -not [string]::IsNullOrWhiteSpace($NativeTourReportPath)
if ($hasWebTourReport -ne $hasNativeTourReport) {
    throw "Pass both -WebTourReportPath and -NativeTourReportPath so deployment readiness can prove cross-surface parity, or omit both for the default local gate."
}
$resolvedWebTourReportPath = $null
$resolvedNativeTourReportPath = $null
if ($hasWebTourReport -and $hasNativeTourReport) {
    $resolvedWebTourReportPath = Resolve-DeploymentPath $WebTourReportPath
    $resolvedNativeTourReportPath = Resolve-DeploymentPath $NativeTourReportPath
    if (-not (Test-Path $resolvedWebTourReportPath)) {
        throw "Deployment web tour report was not found: $resolvedWebTourReportPath"
    }
    if (-not (Test-Path $resolvedNativeTourReportPath)) {
        throw "Deployment native tour report was not found: $resolvedNativeTourReportPath"
    }
    Write-Host "Deployment web tour report input: $resolvedWebTourReportPath"
    Write-Host "Deployment native tour report input: $resolvedNativeTourReportPath"
}

Write-Host "Running markdown proof..."
& (Join-Path $PSScriptRoot "markdown-check.ps1")

Write-Host "Running publication/readiness boundary proof..."
& (Join-Path $PSScriptRoot "public-readiness.ps1") -SkipCompose:$SkipCompose

Write-Host "Running shared mobile shell proof..."
& (Join-Path $PSScriptRoot "..\proof\android\mobile-shell-check.ps1")

Write-Host "Running native mobile wrapper proof..."
Write-Host "Deployment native Android API base URL: $normalizedNativeApiBaseUrl"
& (Join-Path $PSScriptRoot "..\proof\android\native-mobile-check.ps1") -Sync -ApiBaseUrl $normalizedNativeApiBaseUrl

if ($hasWebTourReport -and $hasNativeTourReport) {
    Write-Host "Running cross-surface tour report proof..."
    & (Join-Path $PSScriptRoot "..\proof\release\cross-surface-tour-check.ps1") -WebReportPath $resolvedWebTourReportPath -NativeReportPath $resolvedNativeTourReportPath
} else {
    Write-Host "Skipping cross-surface tour report proof. Pass -WebTourReportPath and -NativeTourReportPath when browser and installed-APK reports are available."
}

Write-Host "Running local performance readiness proof..."
$performanceArgs = @{}
if ($hasWebTourReport -and $hasNativeTourReport) {
    $performanceArgs["WebReportPath"] = $resolvedWebTourReportPath
    $performanceArgs["NativeReportPath"] = $resolvedNativeTourReportPath
}
if ($IncludeApiSmoke) {
    $performanceArgs["IncludeApiSmoke"] = $true
    $performanceArgs["ApiBaseUrl"] = $normalizedApiBaseUrl
}
& (Join-Path $PSScriptRoot "..\proof\release\performance-readiness.ps1") @performanceArgs

Write-Host "Running broad local quality gate..."
& (Join-Path $PSScriptRoot "check.ps1") -IncludeE2E:$IncludeE2E -SkipCompose:$SkipCompose -SkipMobile

if ($IncludeApiSmoke) {
    Write-Host "API smoke proof already ran inside timed performance readiness."
} else {
    Write-Host "Skipping API smoke proof. Pass -IncludeApiSmoke when the seeded local stack is available."
}

Write-Host "Deployment-ready local certification gate passed."
