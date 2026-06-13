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

function Resolve-MerHousePath {
    <#
    .SYNOPSIS
        Resolves a path relative to the project root, or returns it unchanged
        if it is already absolute.
    .PARAMETER Path
        The path to resolve.  May be absolute or project-relative.
    .PARAMETER ProjectRoot
        Optional explicit project root.  When omitted, Get-MerHouseProjectRoot
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
