param()

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$androidRoot = Join-Path $projectRoot "frontend\android"
$buildGradlePath = Join-Path $androidRoot "app\build.gradle"
$rootBuildGradlePath = Join-Path $androidRoot "build.gradle"
$manifestPath = Join-Path $androidRoot "app\src\main\AndroidManifest.xml"
$capacitorConfigPath = Join-Path $projectRoot "frontend\capacitor.config.ts"

foreach ($path in @($buildGradlePath, $rootBuildGradlePath, $manifestPath, $capacitorConfigPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Expected Android release-shape file was not found: $path"
    }
}

$buildGradle = Get-Content -LiteralPath $buildGradlePath -Raw
$rootBuildGradle = Get-Content -LiteralPath $rootBuildGradlePath -Raw
$manifest = Get-Content -LiteralPath $manifestPath -Raw
$capacitorConfig = Get-Content -LiteralPath $capacitorConfigPath -Raw

if ($capacitorConfig -notmatch 'MERHOUSE_ANDROID_FRONTEND_URL') {
    throw "Capacitor config must support MERHOUSE_ANDROID_FRONTEND_URL so signed APK proof can wrap the deployed frontend."
}
if ($capacitorConfig -notmatch 'url:\s*deployedFrontendUrl') {
    throw "Capacitor config must use deployedFrontendUrl as the optional server URL."
}

$requiredGradlePatterns = @(
    'buildTypes\s*\{[\s\S]*release\s*\{',
    'release\s*\{[\s\S]*manifestPlaceholders\s*=\s*\[usesCleartextTraffic:\s*"false"\]',
    'signingConfigs\s*\{[\s\S]*release\s*\{',
    'System\.getenv\("MERHOUSE_ANDROID_KEYSTORE_PATH"\)',
    'System\.getenv\("MERHOUSE_ANDROID_KEYSTORE_PASSWORD"\)',
    'System\.getenv\("MERHOUSE_ANDROID_KEY_ALIAS"\)',
    'System\.getenv\("MERHOUSE_ANDROID_KEY_PASSWORD"\)',
    'System\.getenv\("MERHOUSE_ANDROID_PROOF_WEBVIEW_DEBUG"\)\s*==\s*"true"',
    'buildConfigField\s+"boolean",\s*"MERHOUSE_PROOF_WEBVIEW_DEBUG",',
    'debuggable\s+System\.getenv\("MERHOUSE_ANDROID_PROOF_WEBVIEW_DEBUG"\)\s*==\s*"true"',
    'System\.getenv\("MERHOUSE_ANDROID_VERSION_CODE"\)',
    'System\.getenv\("MERHOUSE_ANDROID_VERSION_NAME"\)',
    'versionCode\s+merhouseVersionCode\s*\?\s*merhouseVersionCode\.toInteger\(\)\s*:\s*1',
    'versionName\s+merhouseVersionName\s*\?:\s*"1\.0"',
    'if\s*\(System\.getenv\("MERHOUSE_ANDROID_KEYSTORE_PATH"\)\)\s*\{[\s\S]*signingConfig signingConfigs\.release'
)

foreach ($pattern in $requiredGradlePatterns) {
    if ($buildGradle -notmatch $pattern) {
        throw "Android release Gradle shape is missing required boundary: $pattern"
    }
}

$mainActivityPath = Join-Path $androidRoot "app\src\main\java\com\merhouse\operations\MainActivity.java"
$mainActivity = Get-Content -LiteralPath $mainActivityPath -Raw
if ($mainActivity -notmatch 'BuildConfig\.MERHOUSE_PROOF_WEBVIEW_DEBUG') {
    throw "MainActivity must gate WebView debugging behind BuildConfig.MERHOUSE_PROOF_WEBVIEW_DEBUG."
}
if ($mainActivity -notmatch 'WebView\.setWebContentsDebuggingEnabled\(true\)') {
    throw "MainActivity must enable WebView debugging only through the proof build flag."
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
    if ($buildGradle -match $pattern -or $rootBuildGradle -match $pattern) {
        throw "Android release Gradle file must not hardcode signing material: $pattern"
    }
}

$forbiddenProviderPatterns = @(
    'com\.google\.gms:google-services',
    'com\.google\.gms\.google-services',
    'google-services\.json'
)
foreach ($pattern in $forbiddenProviderPatterns) {
    if ($buildGradle -match $pattern -or $rootBuildGradle -match $pattern) {
        throw "Android release Gradle file must not enable Google/Firebase provider hooks while native push is out of V17 scope: $pattern"
    }
}

Write-Host "Android release shape check passed."
Write-Host "Release cleartext traffic: disabled through manifest placeholder."
Write-Host "Release signing: external MERHOUSE_ANDROID_KEYSTORE_* environment variables."
Write-Host "Release versioning: external MERHOUSE_ANDROID_VERSION_* environment variables with local defaults."
Write-Host "Release WebView debugging: disabled by default; opt-in internal proof flag is recorded."
Write-Host "Native push provider hooks: disabled for V17."
