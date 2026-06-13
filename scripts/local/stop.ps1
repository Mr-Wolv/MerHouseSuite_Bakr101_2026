param(
    [switch]$RemoveVolumes
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot

Push-Location $projectRoot
try {
    $args = @("compose", "down", "--remove-orphans")
    if ($RemoveVolumes) {
        $args += "--volumes"
    }
    & docker @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose stop failed."
    }
} finally {
    Pop-Location
}

