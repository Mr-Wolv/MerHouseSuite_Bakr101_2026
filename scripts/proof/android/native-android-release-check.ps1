param(
    [string]$ApiBaseUrl,
    [string]$FrontendUrl = "",
    [switch]$Bundle,
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")

function Use-AndroidSdk {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
        $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
        return
    }

    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
        $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
        return
    }

    $sdkCandidates = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk",
        "C:\Android\Sdk",
        "$HOME/Android/Sdk",
        "$HOME/Library/Android/sdk",
        "/opt/android-sdk",
        "/usr/local/lib/android/sdk"
    )

    foreach ($candidate in $sdkCandidates) {
        if ($candidate -and (Test-Path $candidate)) {
            $env:ANDROID_HOME = $candidate
            $env:ANDROID_SDK_ROOT = $candidate
            $env:PATH = "$(Join-Path $candidate "platform-tools")$([System.IO.Path]::PathSeparator)$(Join-Path $candidate "cmdline-tools\latest\bin")$([System.IO.Path]::PathSeparator)$(Join-Path $candidate "emulator")$([System.IO.Path]::PathSeparator)$env:PATH"
            return
        }
    }

    throw "Android SDK was not found. Install Android Studio or set ANDROID_HOME/ANDROID_SDK_ROOT, then rerun this script."
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "native-android-release-shape-check.ps1")
if ($LASTEXITCODE -ne 0) {
    throw "Android release shape check failed."
}

if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
    throw "ApiBaseUrl is required for a signed Android release build."
}
if ([string]::IsNullOrWhiteSpace($FrontendUrl)) {
    throw "FrontendUrl is required for a signed Android release build so the APK wraps the deployed frontend."
}
$normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
    throw "Signed Android release builds must use an https ApiBaseUrl."
}
$normalizedFrontendUrl = Assert-AbsoluteHttpUrl -Name "FrontendUrl" -Value $FrontendUrl
if (-not $normalizedFrontendUrl.StartsWith("https://")) {
    throw "Signed Android release builds must use an https FrontendUrl."
}
if ($normalizedFrontendUrl.EndsWith("/")) {
    throw "FrontendUrl must not end with a slash."
}
foreach ($required in @("MERHOUSE_ANDROID_KEYSTORE_PATH", "MERHOUSE_ANDROID_KEYSTORE_PASSWORD", "MERHOUSE_ANDROID_KEY_ALIAS", "MERHOUSE_ANDROID_KEY_PASSWORD")) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($required))) {
        throw "$required must be set outside Git for signed Android release builds."
    }
}
foreach ($required in @("MERHOUSE_ANDROID_VERSION_CODE", "MERHOUSE_ANDROID_VERSION_NAME")) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($required))) {
        throw "$required must be set outside Git for signed Android release builds."
    }
}
$androidVersionCode = [Environment]::GetEnvironmentVariable("MERHOUSE_ANDROID_VERSION_CODE")
$androidVersionName = [Environment]::GetEnvironmentVariable("MERHOUSE_ANDROID_VERSION_NAME")
$proofWebViewDebug = [Environment]::GetEnvironmentVariable("MERHOUSE_ANDROID_PROOF_WEBVIEW_DEBUG") -eq "true"
if ($androidVersionCode -notmatch '^[1-9][0-9]*$') {
    throw "MERHOUSE_ANDROID_VERSION_CODE must be a positive integer."
}
if (-not (Test-Path $env:MERHOUSE_ANDROID_KEYSTORE_PATH)) {
    throw "Android keystore was not found at MERHOUSE_ANDROID_KEYSTORE_PATH."
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "native-mobile-check.ps1") -Sync -ApiBaseUrl $normalizedApiBaseUrl -FrontendUrl $normalizedFrontendUrl
if ($LASTEXITCODE -ne 0) {
    throw "Native sync failed before release assembly."
}

$repoRoot = Get-MerHouseProjectRoot
$androidRoot = Join-Path $repoRoot "frontend\android"
Push-Location $androidRoot
try {
    Use-AndroidSdk
    $isWindowsRunner = $IsWindows -or $env:OS -eq "Windows_NT"
    $gradleCommand = if ($isWindowsRunner) { ".\gradlew.bat" } else { "./gradlew" }
    if (-not $isWindowsRunner) {
        chmod +x "./gradlew"
    }
    if ($Bundle) {
        $global:LASTEXITCODE = 0
        & $gradleCommand bundleRelease
        $artifact = Join-Path $androidRoot (Join-Path "app" (Join-Path "build" (Join-Path "outputs" (Join-Path "bundle" (Join-Path "release" "app-release.aab")))))
    } else {
        $global:LASTEXITCODE = 0
        & $gradleCommand assembleRelease
        $artifact = Join-Path $androidRoot (Join-Path "app" (Join-Path "build" (Join-Path "outputs" (Join-Path "apk" (Join-Path "release" "app-release.apk")))))
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Android release build failed."
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $artifact)) {
    throw "Expected Android release artifact was not found: $artifact"
}

$hash = (Get-FileHash $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
$bytes = (Get-Item $artifact).Length
$artifactKind = if ($Bundle) { "aab" } else { "apk" }
$repoRoot = Get-MerHouseProjectRoot
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\v17-android-release-$timestamp.json"
}
$resolvedOutputPath = Resolve-MerHousePath -Path $OutputPath -ProjectRoot $repoRoot
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutputPath) | Out-Null

$commitSha = ""
try {
    Push-Location $repoRoot
    $commitSha = (git rev-parse HEAD).Trim()
} catch {
    $commitSha = "unavailable"
} finally {
    Pop-Location
}

$manifest = [ordered]@{
    schema = "merhouse.v17.android-release.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = $commitSha
    apiBaseUrl = $normalizedApiBaseUrl
    frontendUrl = $normalizedFrontendUrl
    wrapperMode = "deployed-frontend"
    artifactKind = $artifactKind
    artifactPath = $artifact
    sha256 = $hash
    bytes = $bytes
    versionCode = [int]$androidVersionCode
    versionName = $androidVersionName
    cleartextTraffic = "disabled-for-release"
    webViewDebugging = if ($proofWebViewDebug) { "enabled-for-internal-proof" } else { "disabled" }
    androidDebuggable = if ($proofWebViewDebug) { "enabled-for-internal-proof" } else { "disabled" }
    signing = "external-keystore-env"
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

Write-Host "Signed Android release artifact: $artifact"
Write-Host "Android release SHA-256: $hash"
Write-Host "Android release bytes: $bytes"
Write-Host "Android release manifest: $resolvedOutputPath"
Write-Host "Signed Android release check passed."
