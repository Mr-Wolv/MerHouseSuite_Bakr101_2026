param()

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$androidRoot = Join-Path $projectRoot "frontend\android"
$buildGradlePath = Join-Path $androidRoot "app\build.gradle"
$manifestPath = Join-Path $androidRoot "app\src\main\AndroidManifest.xml"

foreach ($path in @($buildGradlePath, $manifestPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Expected Android release-shape file was not found: $path"
    }
}

$buildGradle = Get-Content -LiteralPath $buildGradlePath -Raw
$manifest = Get-Content -LiteralPath $manifestPath -Raw

$requiredGradlePatterns = @(
    'buildTypes\s*\{[\s\S]*release\s*\{',
    'release\s*\{[\s\S]*manifestPlaceholders\s*=\s*\[usesCleartextTraffic:\s*"false"\]',
    'signingConfigs\s*\{[\s\S]*release\s*\{',
    'System\.getenv\("MERHOUSE_ANDROID_KEYSTORE_PATH"\)',
    'System\.getenv\("MERHOUSE_ANDROID_KEYSTORE_PASSWORD"\)',
    'System\.getenv\("MERHOUSE_ANDROID_KEY_ALIAS"\)',
    'System\.getenv\("MERHOUSE_ANDROID_KEY_PASSWORD"\)',
    'if\s*\(System\.getenv\("MERHOUSE_ANDROID_KEYSTORE_PATH"\)\)\s*\{[\s\S]*signingConfig signingConfigs\.release'
)

foreach ($pattern in $requiredGradlePatterns) {
    if ($buildGradle -notmatch $pattern) {
        throw "Android release Gradle shape is missing required boundary: $pattern"
    }
}

if ($manifest -notmatch 'android:usesCleartextTraffic="\$\{usesCleartextTraffic\}"') {
    throw "AndroidManifest.xml must use the usesCleartextTraffic manifest placeholder."
}
if ($manifest -notmatch 'xmlns:tools="http://schemas\.android\.com/tools"') {
    throw "AndroidManifest.xml must declare the tools namespace for release cleartext override."
}
if ($manifest -notmatch 'tools:replace="android:usesCleartextTraffic"') {
    throw "AndroidManifest.xml must override plugin cleartext declarations with tools:replace."
}

$forbiddenGradlePatterns = @(
    'storePassword\s+["''][^"'']+["'']',
    'keyPassword\s+["''][^"'']+["'']',
    'keyAlias\s+["''][^"'']+["'']',
    'storeFile\s+file\(["''][^"'']+["'']\)'
)

foreach ($pattern in $forbiddenGradlePatterns) {
    if ($buildGradle -match $pattern) {
        throw "Android release Gradle file must not hardcode signing material: $pattern"
    }
}

Write-Host "Android release shape check passed."
Write-Host "Release cleartext traffic: disabled through manifest placeholder."
Write-Host "Release signing: external MERHOUSE_ANDROID_KEYSTORE_* environment variables."
