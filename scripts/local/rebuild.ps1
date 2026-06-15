<#
.SYNOPSIS
    Rebuilds and restarts Docker Compose services with health check.
.DESCRIPTION
    Builds the selected services, restarts them, and waits for the backend health endpoint.
.PARAMETER BackendOnly
    Only rebuild and restart the backend service.
.PARAMETER FrontendOnly
    Only rebuild and restart the frontend service.
.PARAMETER Full
    Rebuild both backend and frontend services.
.PARAMETER NoCache
    Pass --no-cache to docker compose build.
.PARAMETER PullImages
    Pass --pull to docker compose build to refresh base images.
#>
param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$Full,
    [switch]$NoCache,
    [switch]$PullImages
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$composeFile = Join-Path $projectRoot "docker-compose.yml"
$backendUrl = Get-MerHouseDefaultApiUrl

if (-not (Test-Path $composeFile)) {
    throw "docker-compose.yml was not found at $composeFile."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker was not found on PATH."
}

function Invoke-Docker {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed: docker $($Arguments -join ' ')"
    }
}

Push-Location $projectRoot
try {
    $services = @()
    if ($Full -or (-not $BackendOnly -and -not $FrontendOnly)) {
        $services = @("backend", "frontend")
    } elseif ($BackendOnly) {
        $services = @("backend")
    } elseif ($FrontendOnly) {
        $services = @("frontend")
    }

    $buildArgs = @("compose", "build")
    if ($NoCache) { $buildArgs += "--no-cache" }
    if ($PullImages) { $buildArgs += "--pull" }

    foreach ($svc in $services) {
        Write-Host "Building $svc..."
        Invoke-Docker ($buildArgs + @($svc))
    }

    foreach ($svc in $services) {
        Write-Host "Restarting $svc..."
        Invoke-Docker @("compose", "up", "-d", "--no-deps", "--no-build", $svc)
    }

    Write-Host "Waiting for backend health at $backendUrl..."
    & (Join-Path $PSScriptRoot "wait-backend.ps1")

    Write-Host ""
    Write-Host "Rebuild complete. Services running:"
    Invoke-Docker @("compose", "ps")
} finally {
    Pop-Location
}
