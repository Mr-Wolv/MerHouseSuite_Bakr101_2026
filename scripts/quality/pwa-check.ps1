param(
    [string]$FrontendRoot = ".\frontend"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$resolvedFrontendRoot = if ([System.IO.Path]::IsPathRooted($FrontendRoot)) {
    $FrontendRoot
} else {
    Join-Path $projectRoot $FrontendRoot
}

$indexPath = Join-Path $resolvedFrontendRoot "index.html"
$manifestPath = Join-Path $resolvedFrontendRoot "public\manifest.webmanifest"
$serviceWorkerPath = Join-Path $resolvedFrontendRoot "public\sw.js"

if (-not (Test-Path -LiteralPath $indexPath)) {
    throw "Frontend index.html was not found at $indexPath."
}
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "PWA manifest was not found at $manifestPath."
}
if (-not (Test-Path -LiteralPath $serviceWorkerPath)) {
    throw "Service worker was not found at $serviceWorkerPath."
}

$indexHtml = Get-Content -Raw -LiteralPath $indexPath
foreach ($required in @(
    '<link rel="manifest" href="/manifest.webmanifest"',
    '<meta name="theme-color"',
    '<meta name="apple-mobile-web-app-capable" content="yes"',
    '<meta name="mobile-web-app-capable" content="yes"'
)) {
    if ($indexHtml -notlike "*$required*") {
        throw "index.html is missing required mobile metadata: $required"
    }
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
if ($manifest.name -ne "MerHouse Operations Console") {
    throw "Manifest name must be 'MerHouse Operations Console'."
}
if ($manifest.short_name -ne "MerHouse") {
    throw "Manifest short_name must be 'MerHouse'."
}
if ($manifest.start_url -ne "/") {
    throw "Manifest start_url must be '/'."
}
if ($manifest.scope -ne "/") {
    throw "Manifest scope must be '/'."
}
if ($manifest.display -ne "standalone") {
    throw "Manifest display must be 'standalone'."
}
if ($manifest.theme_color -ne "#0f766e") {
    throw "Manifest theme_color must match the mobile metadata theme."
}

$icons = @($manifest.icons)
if ($icons.Count -lt 1) {
    throw "Manifest must define at least one app icon."
}

$hasMaskableIcon = $false
foreach ($icon in $icons) {
    if (-not $icon.src) {
        throw "Manifest icon is missing src."
    }
    $iconPath = Join-Path (Join-Path $resolvedFrontendRoot "public") ($icon.src.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $iconPath)) {
        throw "Manifest icon file was not found: $($icon.src)"
    }
    if (($icon.purpose -as [string]) -match "maskable") {
        $hasMaskableIcon = $true
    }
}

if (-not $hasMaskableIcon) {
    throw "Manifest must include a maskable app icon."
}

$serviceWorker = Get-Content -Raw -LiteralPath $serviceWorkerPath
foreach ($required in @("install", "activate", "fetch", "/api/")) {
    if ($serviceWorker -notlike "*$required*") {
        throw "Service worker is missing expected online-first behavior marker: $required"
    }
}

Write-Host "PWA/mobile installability check passed."
