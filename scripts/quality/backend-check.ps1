param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendRoot = Join-Path $projectRoot "backend"
$mvnw = Join-Path $backendRoot "mvnw.cmd"

if (-not (Test-Path -LiteralPath $mvnw)) {
    throw "Backend Maven wrapper was not found at $mvnw."
}

Push-Location $backendRoot
try {
    if ($SkipTests) {
        Write-Host "Compiling backend without tests..."
        .\mvnw.cmd -DskipTests package
    } else {
        Write-Host "Running backend tests..."
        .\mvnw.cmd test
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Backend check failed."
    }
} finally {
    Pop-Location
}

