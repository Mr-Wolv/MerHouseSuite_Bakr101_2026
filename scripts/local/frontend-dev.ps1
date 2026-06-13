param(
    [int]$Port = 5173,
    [string]$HostName = "127.0.0.1",
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$frontendRoot = Join-Path $projectRoot "frontend"
$packageJson = Join-Path $frontendRoot "package.json"
$nodeModules = Join-Path $frontendRoot "node_modules"

if (-not (Test-Path $packageJson)) {
    throw "Frontend package.json was not found at $packageJson."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found on PATH. Install Node.js or add npm to PATH before running the frontend."
}

if (-not $SkipInstall -and -not (Test-Path $nodeModules)) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $frontendRoot
    try {
        npm install
    } finally {
        Pop-Location
    }
}

Write-Host "Starting MerHouse frontend at http://$HostName`:$Port"
Push-Location $frontendRoot
try {
    npm run dev -- --host $HostName --port $Port
} finally {
    Pop-Location
}
