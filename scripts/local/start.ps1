param(
    [switch]$ResetDatabase,
    [switch]$SkipPrune,
    [switch]$NoCache,
    [switch]$PullImages,
    [switch]$Prune,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$composeFile = Join-Path $projectRoot "docker-compose.yml"

if (-not (Test-Path $composeFile)) {
    throw "docker-compose.yml was not found at $composeFile."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker was not found on PATH. Start Docker Desktop and try again."
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
    Write-Host "Stopping existing stack..."
    $downArgs = @("compose", "down", "--remove-orphans")
    if ($ResetDatabase) {
        $downArgs += "--volumes"
    }
    Invoke-Docker $downArgs

    $legacyProjectName = (Split-Path -Leaf $projectRoot).ToLowerInvariant()
    if ($legacyProjectName -and $legacyProjectName -ne "merhouse") {
        Write-Host "Stopping legacy folder-named stack if present..."
        $legacyDownArgs = @("compose", "-p", $legacyProjectName, "down", "--remove-orphans")
        if ($ResetDatabase) {
            $legacyDownArgs += "--volumes"
        }
        Invoke-Docker $legacyDownArgs
    }

    if ($Prune -and -not $SkipPrune) {
        Write-Host "Removing old Docker build cache and unused images..."
        Invoke-Docker @("builder", "prune", "-af")
        Invoke-Docker @("image", "prune", "-af")
        Invoke-Docker @("container", "prune", "-f")
        if ($ResetDatabase) {
            Invoke-Docker @("volume", "prune", "-f")
        }
    }

    if ($SkipBuild) {
        Write-Host "Skipping image build and reusing existing local images..."
    } else {
        Write-Host "Building postgres, backend, and frontend stack..."
        $buildArgs = @("compose", "build")
        if ($PullImages) {
            $buildArgs += "--pull"
        }
        if ($NoCache) {
            $buildArgs += "--no-cache"
        }
        Invoke-Docker $buildArgs
    }

    if ($Prune -and -not $SkipPrune) {
        Write-Host "Cleaning build cache after successful build..."
        Invoke-Docker @("builder", "prune", "-af")
    }

    Write-Host "Starting stack..."
    $upArgs = @("compose", "up", "-d", "--remove-orphans")
    if ($SkipBuild) {
        $upArgs += "--no-build"
    }
    Invoke-Docker $upArgs
    & (Join-Path $PSScriptRoot "wait-backend.ps1")

    Write-Host ""
    Write-Host "Deployment is running:"
    Write-Host "  Frontend: http://localhost:3000"
    Write-Host "  Backend:  http://localhost:8080"
    Write-Host "  Postgres: localhost:5432"
    Write-Host ""
    Invoke-Docker @("compose", "ps")
    Write-Host ""
    Invoke-Docker @("system", "df")
} finally {
    Pop-Location
}
