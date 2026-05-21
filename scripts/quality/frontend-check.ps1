param(
    [switch]$SkipInstall,
    [switch]$IncludeE2E
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$frontendRoot = Join-Path $projectRoot "frontend"
$packageJson = Join-Path $frontendRoot "package.json"
$nodeModules = Join-Path $frontendRoot "node_modules"

if (-not (Test-Path $packageJson)) {
    throw "Frontend package.json was not found at $packageJson."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found on PATH. Install Node.js or add npm to PATH before running frontend checks."
}

Push-Location $frontendRoot
try {
    if (-not $SkipInstall -and -not (Test-Path $nodeModules)) {
        Write-Host "Installing frontend dependencies..."
        npm install
    }

    Write-Host "Running frontend lint..."
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend lint failed."
    }

    Write-Host "Running frontend build..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed."
    }

    Write-Host "Running frontend tests..."
    npm test -- --run
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend tests failed."
    }

    if ($IncludeE2E) {
        Write-Host "Running frontend Playwright tests..."
        npm run test:e2e
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend Playwright tests failed."
        }
    } else {
        Write-Host "Skipping frontend Playwright tests. Use -IncludeE2E when a seeded local stack is running."
    }
} finally {
    Pop-Location
}
