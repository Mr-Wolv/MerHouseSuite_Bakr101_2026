param(
    [switch]$RemoveVolumes
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot

Push-Location $projectRoot
try {
    $downArgs = @("compose", "down", "--remove-orphans")
    if ($RemoveVolumes) {
        $downArgs += "--volumes"
    }
    & docker @downArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose stop failed."
    }
} finally {
    Pop-Location
}

