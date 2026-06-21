param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$backendRoot = Join-Path $projectRoot "backend"
$mvnw = Join-Path $backendRoot "mvnw.cmd"

if (-not (Test-Path -LiteralPath $mvnw)) {
    throw "Backend Maven wrapper was not found at $mvnw."
}

Push-Location $backendRoot
try {
    $previousFirebaseEmulatorHost = [Environment]::GetEnvironmentVariable("FIREBASE_EMULATOR_HOST", "Process")
    [Environment]::SetEnvironmentVariable("FIREBASE_EMULATOR_HOST", "true", "Process")
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
        if ($null -eq $previousFirebaseEmulatorHost) {
            [Environment]::SetEnvironmentVariable("FIREBASE_EMULATOR_HOST", $null, "Process")
        } else {
            [Environment]::SetEnvironmentVariable("FIREBASE_EMULATOR_HOST", $previousFirebaseEmulatorHost, "Process")
        }
    }
} finally {
    Pop-Location
}

