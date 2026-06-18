# Shared helpers used across all MerHouse scripts.
# Dot-source this file near the top of any script that needs project root
# resolution or project-relative path resolution.
#
#   . (Join-Path $PSScriptRoot "..\lib\common.ps1")     # from scripts/<dir>/
#   . (Join-Path $PSScriptRoot "..\..\lib\common.ps1")  # from scripts/<dir>/<sub>/
#
# $PSScriptRoot inside this file always points at scripts/lib/, so going up
# two levels always yields the repository root regardless of the caller's depth.

$ErrorActionPreference = "Stop"

$_merhouseCommonDir = $PSScriptRoot

function Get-MerHouseProjectRoot {
    <#
    .SYNOPSIS
        Returns the absolute path of the MerHouse repository root.
    .DESCRIPTION
        Resolves two levels up from the directory containing this common.ps1
        (i.e. scripts/lib/ -> scripts/ -> project root).  The result is cached
        in a script-scoped variable so repeated calls are cheap.
    #>

    return (Resolve-Path (Join-Path $_merhouseCommonDir "..\..")).Path
}

function Get-MerHouseEnvFile {
    <#
    .SYNOPSIS
        Returns the absolute path to the local .env file if present.
    #>

    return Join-Path (Get-MerHouseProjectRoot) ".env"
}

function Get-MerHouseEnvValue {
    <#
    .SYNOPSIS
        Reads a value from the local .env file without importing it into the session.
    .PARAMETER Name
        The environment variable name to read.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Name
    )

    $envFile = Get-MerHouseEnvFile
    if (-not (Test-Path $envFile)) {
        return $null
    }

    # Use a regular foreach loop (not ForEach-Object) so that return exits the
    # function immediately instead of only exiting the current pipeline iteration.
    foreach ($line in Get-Content $envFile) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
            continue
        }
        $parts = $trimmed.Split('=', 2)
        if ($parts.Length -eq 2 -and $parts[0].Trim() -eq $Name) {
            return $parts[1].Trim()
        }
    }

    return $null
}

function Get-MerHouseDefaultApiUrl {
    <#
    .SYNOPSIS
        Returns the default local backend API URL. Reads .env when available,
        then falls back to the host-mapped port MERHOUSE_BACKEND_PORT.
    #>

    $fromEnv = Get-MerHouseEnvValue -Name 'MERHOUSE_BACKEND_PORT'
    if (-not [string]::IsNullOrWhiteSpace($fromEnv)) {
        return "http://localhost:$fromEnv"
    }

    return 'http://localhost:8081'
}

function Get-MerHouseDefaultFrontendUrl {
    <#
    .SYNOPSIS
        Returns the default local frontend URL. Reads .env when available,
        then falls back to MERHOUSE_FRONTEND_PORT.
    #>

    $fromEnv = Get-MerHouseEnvValue -Name 'MERHOUSE_FRONTEND_PORT'
    if (-not [string]::IsNullOrWhiteSpace($fromEnv)) {
        return "http://localhost:$fromEnv"
    }

    return 'http://localhost:3001'
}

function Get-MerHouseDefaultBaseUrl {
    <#
    .SYNOPSIS
        Returns the default local backend base URL for API scripts.
    #>

    $fromEnv = Get-MerHouseEnvValue -Name 'MERHOUSE_BACKEND_PORT'
    if (-not [string]::IsNullOrWhiteSpace($fromEnv)) {
        return "http://localhost:$fromEnv"
    }

    return 'http://localhost:8081'
}
function Resolve-MerHousePath {
    <#
    .SYNOPSIS
        Resolves a path relative to the project root, or returns it unchanged
        if it is already absolute.
    .PARAMETER Path
        The path to resolve. May be absolute or project-relative.
    .PARAMETER ProjectRoot
        Optional explicit project root. When omitted, Get-MerHouseProjectRoot
        is used.
    #>
    param(
        [Parameter(Mandatory = $true)] [string] $Path,
        [string] $ProjectRoot = ""
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    $root = if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
        Get-MerHouseProjectRoot
    } else {
        $ProjectRoot
    }

    return [System.IO.Path]::GetFullPath((Join-Path $root $Path))
}
