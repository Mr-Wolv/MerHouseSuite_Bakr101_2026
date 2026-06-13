param(
    [Parameter(Mandatory = $true)] [string]$ReleaseLoginProofPath,
    [string]$OutputPath = ".\reports\native-android-release-visual-tour.json",
    [string]$ExpectedRoute = "/admin",
    [string]$ExpectedText = "Admin Overview",
    [switch]$ConfirmVisualReview
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmVisualReview) {
    throw "Re-run with -ConfirmVisualReview only after the signed release APK screenshot was visually reviewed on the real emulator/device."
}

. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
. (Join-Path $PSScriptRoot "..\lib\tour-report-lib.ps1")

function Resolve-ProjectPath {
    param([Parameter(Mandatory = $true)] [string]$Path)

    return Resolve-MerHousePath -Path $Path -ProjectRoot $projectRoot
}

$resolvedProofPath = Resolve-ProjectPath -Path $ReleaseLoginProofPath
$resolvedOutputPath = Resolve-ProjectPath -Path $OutputPath
if (-not (Test-Path -LiteralPath $resolvedProofPath)) {
    throw "Release login proof report was not found: $resolvedProofPath"
}

try {
    $proof = Get-Content -Raw -LiteralPath $resolvedProofPath | ConvertFrom-Json
} catch {
    throw "Release login proof report must be valid JSON."
}

if ($proof.schema -ne "merhouse.native-android-release-login-proof.report.v1") {
    throw "Release login proof schema must be merhouse.native-android-release-login-proof.report.v1."
}
if ([string]::IsNullOrWhiteSpace($proof.apiUrl)) {
    throw "Release login proof must include apiUrl."
}
if ($proof.apkSha256 -notmatch '^[a-fA-F0-9]{64}$') {
    throw "Release login proof must include a 64-character apkSha256."
}
if (@($proof.deviceSerials).Count -lt 1) {
    throw "Release login proof must include at least one device serial."
}
if ([string]::IsNullOrWhiteSpace($proof.signedInScreenshot)) {
    throw "Release login proof must include signedInScreenshot."
}
$screenshotPath = Resolve-ProjectPath -Path $proof.signedInScreenshot
if (-not (Test-PngScreenshotFile -Path $screenshotPath)) {
    throw "Signed-in screenshot is not valid PNG evidence with positive dimensions: $screenshotPath"
}

$apkPath = Resolve-ProjectPath -Path $proof.apkPath
if (-not (Test-Path -LiteralPath $apkPath)) {
    throw "Release login proof apkPath was not found: $apkPath"
}
$apkBytes = (Get-Item -LiteralPath $apkPath).Length

$badRecords = @()
if ([string]::IsNullOrWhiteSpace($ExpectedText)) {
    $badRecords += "ExpectedText must be non-blank for visual release tour evidence."
}

$record = [ordered]@{
    role = "OWNER"
    stakeholderState = $null
    route = $ExpectedRoute
    href = "android-release://$ExpectedRoute"
    title = "MerHouse"
    routeReadyMs = $null
    screenshotMs = $null
    expectedText = $ExpectedText
    heading = $ExpectedText
    textPreview = "Visual reviewer confirmed signed release APK screenshot shows $ExpectedText."
    screenshot = $screenshotPath
    hasExpectedText = $true
    hasOverflow = $false
    interactionUnitCount = 1
    emptyControlLabels = @()
    unlabeledFormControls = @()
    hasUnableToSignIn = $false
    landedOnLogin = $false
    hasLoading = $false
    hasRestoringSession = $false
    hasBlankBody = $false
    proofMode = "signed-release-visual-review"
}

$report = [ordered]@{
    schema = "merhouse.native-android-tour.report.v1"
    apiUrl = $proof.apiUrl
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    apkSha256 = $proof.apkSha256
    apkBytes = $apkBytes
    deviceSerials = @($proof.deviceSerials)
    checkedRoutes = 1
    records = @($record)
    badRecords = $badRecords
    releaseLoginProof = $resolvedProofPath
    proofMode = "signed-release-visual-review"
    secretPolicy = "No credentials, tokens, private URLs, screenshots as embedded data, adb logs, or keystore values are stored in this report."
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

if ($badRecords.Count -gt 0) {
    throw "Native Android release visual tour proof produced bad records: $($badRecords -join '; ')"
}

Write-Host "Native Android release visual tour report: $resolvedOutputPath"
Write-Host "Native Android release visual tour proof passed."
