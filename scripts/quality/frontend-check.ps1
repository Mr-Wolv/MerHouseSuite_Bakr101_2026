param(
    [switch]$SkipInstall,
    [switch]$IncludeE2E
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
    npm test -- --run --no-file-parallelism
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend tests failed."
    }

    if ($IncludeE2E) {
        & (Join-Path $projectRoot "scripts\local\wait-backend.ps1")
        Write-Host "Running frontend Playwright tests..."
        $previousBaseUrl = $env:FRONTEND_TOUR_BASE_URL
        $previousApiUrl = $env:E2E_API_URL
        try {
            if (-not $env:FRONTEND_TOUR_BASE_URL) {
                $env:FRONTEND_TOUR_BASE_URL = "http://localhost:3000"
            }
            if (-not $env:E2E_API_URL) {
                $env:E2E_API_URL = $env:FRONTEND_TOUR_BASE_URL
            }
            npm run test:e2e
            if ($LASTEXITCODE -ne 0) {
                throw "Frontend Playwright tests failed."
            }
        } finally {
            $env:FRONTEND_TOUR_BASE_URL = $previousBaseUrl
            $env:E2E_API_URL = $previousApiUrl
        }
    } else {
        Write-Host "Skipping frontend Playwright tests. Use -IncludeE2E when a seeded local stack is running."
    }
} finally {
    Pop-Location
}
