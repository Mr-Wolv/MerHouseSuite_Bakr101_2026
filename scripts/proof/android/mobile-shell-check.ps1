param(
    [string]$FrontendRoot = ".\frontend"
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$resolvedFrontendRoot = Resolve-MerHousePath -Path $FrontendRoot -ProjectRoot $projectRoot

$indexPath = Join-Path $resolvedFrontendRoot "index.html"
$manifestPath = Join-Path $resolvedFrontendRoot "public\manifest.webmanifest"
$serviceWorkerPath = Join-Path $resolvedFrontendRoot "public\sw.js"

if (-not (Test-Path -LiteralPath $indexPath)) {
    throw "Frontend index.html was not found at $indexPath."
}
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Mobile shell manifest was not found at $manifestPath."
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

    if ($icon.src -eq "/app-icon.svg") {
        $iconSvg = Get-Content -Raw -LiteralPath $iconPath
        foreach ($expected in @("#10261f", "#d9f99d")) {
            if (-not $iconSvg.Contains($expected)) {
                throw "Mobile shell icon is missing MerHouse identity color: $expected"
            }
        }
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

Write-Host "Shared mobile shell check passed."
Write-Host "Frontend root: $resolvedFrontendRoot"
Write-Host "Manifest: $manifestPath"
Write-Host "Manifest name: $($manifest.name)"
Write-Host "Manifest short name: $($manifest.short_name)"
Write-Host "Manifest display: $($manifest.display)"
Write-Host "Manifest theme color: $($manifest.theme_color)"
Write-Host "Manifest icon count: $($icons.Count)"
Write-Host "Manifest has maskable icon: $hasMaskableIcon"
Write-Host "Service worker: $serviceWorkerPath"
