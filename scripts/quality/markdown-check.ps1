param()

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot
$excludedPathPattern = "[\\/](\.git|node_modules|target|dist|reports|playwright-report|test-results)[\\/]"
$missingLinks = New-Object System.Collections.Generic.List[string]

function Test-ExternalLink {
    param([Parameter(Mandatory = $true)][string]$Target)

    return $Target -match '^(?i)(https?://|mailto:|app://)' -or
        $Target.StartsWith("#") -or
        [string]::IsNullOrWhiteSpace($Target)
}

function Resolve-MarkdownTarget {
    param(
        [Parameter(Mandatory = $true)][string]$BaseDirectory,
        [Parameter(Mandatory = $true)][string]$Target
    )

    $cleanTarget = ($Target -split "#", 2)[0].Trim()
    if (Test-ExternalLink $cleanTarget) {
        return $null
    }

    $cleanTarget = $cleanTarget.Trim("<", ">")
    $cleanTarget = [Uri]::UnescapeDataString($cleanTarget)
    $candidate = Join-Path $BaseDirectory $cleanTarget

    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }

    if ([string]::IsNullOrWhiteSpace([IO.Path]::GetExtension($candidate))) {
        $markdownCandidate = "$candidate.md"
        if (Test-Path -LiteralPath $markdownCandidate) {
            return $markdownCandidate
        }
    }

    return $candidate
}

function Resolve-WikiTarget {
    param([Parameter(Mandatory = $true)][string]$Target)

    $cleanTarget = ($Target -split "#", 2)[0].Trim()
    if ([string]::IsNullOrWhiteSpace($cleanTarget)) {
        return $null
    }

    $candidate = Join-Path $projectRoot $cleanTarget
    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }

    if ([string]::IsNullOrWhiteSpace([IO.Path]::GetExtension($candidate))) {
        $markdownCandidate = "$candidate.md"
        if (Test-Path -LiteralPath $markdownCandidate) {
            return $markdownCandidate
        }
    }

    return $candidate
}

Push-Location $projectRoot
try {
    Write-Host "Checking markdown links..."
    $markdownFiles = Get-ChildItem -Path $projectRoot -Recurse -Filter *.md -File -Force |
        Where-Object { $_.FullName -notmatch $excludedPathPattern }

    foreach ($file in $markdownFiles) {
        $relativeFile = Resolve-Path -LiteralPath $file.FullName -Relative
        $lines = Get-Content -LiteralPath $file.FullName

        for ($lineIndex = 0; $lineIndex -lt $lines.Count; $lineIndex++) {
            $line = $lines[$lineIndex]

            foreach ($match in [regex]::Matches($line, '(?<!\!)\[[^\]]+\]\(([^)]+)\)')) {
                $target = $match.Groups[1].Value.Trim()
                if (Test-ExternalLink $target) {
                    continue
                }

                $resolved = Resolve-MarkdownTarget -BaseDirectory $file.DirectoryName -Target $target
                if ($null -ne $resolved -and -not (Test-Path -LiteralPath $resolved)) {
                    $missingLinks.Add("$($relativeFile):$($lineIndex + 1) missing markdown link target: $target")
                }
            }

            foreach ($match in [regex]::Matches($line, '\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]')) {
                $target = $match.Groups[1].Value.Trim()
                $resolved = Resolve-WikiTarget -Target $target
                if ($null -ne $resolved -and -not (Test-Path -LiteralPath $resolved)) {
                    $missingLinks.Add("$($relativeFile):$($lineIndex + 1) missing wiki link target: $target")
                }
            }
        }
    }

    if ($missingLinks.Count -gt 0) {
        $missingLinks | Sort-Object
        throw "Markdown link check failed."
    }

    Write-Host "Markdown link check passed."
} finally {
    Pop-Location
}

exit 0
