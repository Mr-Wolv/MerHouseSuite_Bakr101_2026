param(
    [switch]$RemoveVolumes
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

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

