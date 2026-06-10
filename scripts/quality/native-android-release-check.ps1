param(
    [string]$ApiBaseUrl,
    [switch]$Bundle,
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
    throw "ApiBaseUrl is required for a signed Android release build."
}
$normalizedApiBaseUrl = Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $ApiBaseUrl
if (-not $normalizedApiBaseUrl.StartsWith("https://")) {
    throw "Signed Android release builds must use an https ApiBaseUrl."
}
foreach ($required in @("MERHOUSE_ANDROID_KEYSTORE_PATH", "MERHOUSE_ANDROID_KEYSTORE_PASSWORD", "MERHOUSE_ANDROID_KEY_ALIAS", "MERHOUSE_ANDROID_KEY_PASSWORD")) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($required))) {
        throw "$required must be set outside Git for signed Android release builds."
    }
}
if (-not (Test-Path $env:MERHOUSE_ANDROID_KEYSTORE_PATH)) {
    throw "Android keystore was not found at MERHOUSE_ANDROID_KEYSTORE_PATH."
}

& (Join-Path $PSScriptRoot "native-mobile-check.ps1") -Sync -ApiBaseUrl $normalizedApiBaseUrl
if ($LASTEXITCODE -ne 0) {
    throw "Native sync failed before release assembly."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$androidRoot = Join-Path $repoRoot "frontend\android"
Push-Location $androidRoot
try {
    $gradleCommand = if ($IsWindows -or $env:OS -eq "Windows_NT") {
        ".\gradlew.bat"
    } else {
        "./gradlew"
    }
    if ($Bundle) {
        & $gradleCommand bundleRelease
        $artifact = Join-Path $androidRoot "app\build\outputs\bundle\release\app-release.aab"
    } else {
        & $gradleCommand assembleRelease
        $artifact = Join-Path $androidRoot "app\build\outputs\apk\release\app-release.apk"
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
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = ".\reports\v17-android-release-$timestamp.json"
}
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
}
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
    artifactKind = $artifactKind
    artifactPath = $artifact
    sha256 = $hash
    bytes = $bytes
    cleartextTraffic = "disabled-for-release"
    signing = "external-keystore-env"
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8

Write-Host "Signed Android release artifact: $artifact"
Write-Host "Android release SHA-256: $hash"
Write-Host "Android release bytes: $bytes"
Write-Host "Android release manifest: $resolvedOutputPath"
Write-Host "Signed Android release check passed."
