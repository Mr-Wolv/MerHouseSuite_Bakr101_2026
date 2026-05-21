param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$smokeScript = Join-Path $PSScriptRoot "api-smoke.ps1"

if (-not (Test-Path $smokeScript)) {
    throw "API smoke wrapper was not found at $smokeScript."
}

Write-Host "Checking deployed frontend at $BaseUrl"

try {
    $response = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing
} catch {
    throw "Frontend did not respond at $BaseUrl. Start the Docker stack and try again. $($_.Exception.Message)"
}

if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "Frontend returned unexpected status $($response.StatusCode)."
}

if ($response.Content -notmatch '<div id="root"></div>') {
    throw "Frontend response did not look like the React app shell."
}

Write-Host "Frontend shell responded. Running API smoke test through frontend proxy..."

$smokeArgs = @{
    BaseUrl = $BaseUrl
}
if ($OutputPath) {
    $resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
        $OutputPath
    } else {
        Join-Path $projectRoot $OutputPath
    }
    $smokeArgs.OutputPath = $resolvedOutputPath
}

& $smokeScript @smokeArgs
if ($LASTEXITCODE -ne 0) {
    throw "API smoke test through frontend proxy failed."
}

Write-Host "Frontend deployment check passed for $BaseUrl"
