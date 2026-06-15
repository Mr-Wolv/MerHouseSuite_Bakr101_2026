# Quick syntax check for all PowerShell scripts in the project.
# Usage: pwsh -NoProfile -File scripts/maintenance/syntax-check.ps1

$ErrorActionPreference = "Continue"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$scripts = Get-ChildItem -Path $root -Filter "*.ps1" -Recurse -File |
    Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*.git*" }

$total = $scripts.Count
$errorCount = 0
$okCount = 0
$errors = @()

foreach ($file in $scripts) {
    $relativePath = $file.FullName.Substring($root.Path.Length + 1)
    $parseErrors = $null
    $tokens = [System.Management.Automation.Language.Parser]::ParseFile(
        $file.FullName,
        [ref]$null,
        [ref]$parseErrors
    )

    if ($parseErrors.Count -gt 0) {
        $errorCount++
        foreach ($err in $parseErrors) {
            $errors += [ordered]@{
                file = $relativePath
                line = $err.Extent.StartLineNumber
                message = $err.Message
            }
            Write-Host "ERROR  ${relativePath}:$($err.Extent.StartLineNumber)  $($err.Message)"
        }
    } else {
        $okCount++
    }
}

Write-Host ""
Write-Host "Checked $total scripts: $okCount OK, $errorCount with errors"

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "=== Errors ==="
    foreach ($e in $errors) {
        Write-Host "  $($e.file):$($e.line) - $($e.message)"
    }
    exit 1
}
