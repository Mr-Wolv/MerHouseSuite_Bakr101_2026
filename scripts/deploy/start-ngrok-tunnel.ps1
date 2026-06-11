param(
    [string]$EnvFile = ".secrets/deploy/env.production",
    [string]$PublicUrl,
    [string]$Target,
    [string]$NgrokPath = "ngrok",
    [switch]$ConfirmTunnel
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmTunnel) {
    throw "Starting ngrok exposes the local deployment publicly. Re-run with -ConfirmTunnel after checking the env file and target."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    [System.IO.Path]::GetFullPath($EnvFile)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $EnvFile))
}

if (-not (Test-Path $envPath)) {
    throw "Deployment env file was not found: $envPath"
}
if ((Split-Path $envPath -Leaf) -eq "env.production.example") {
    throw "Refusing to expose the example env template. Use an ignored private env file."
}

function Read-EnvValues {
    param([string]$Path)

    $values = @{}
    Get-Content -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith("#")) {
            return
        }
        $separator = $line.IndexOf("=")
        if ($separator -lt 1) {
            return
        }
        $name = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim()
        $values[$name] = $value
    }
    return $values
}

$values = Read-EnvValues -Path $envPath

if ([string]::IsNullOrWhiteSpace($PublicUrl)) {
    $PublicUrl = $values["MERHOUSE_PUBLIC_FRONTEND_URL"]
}
if ([string]::IsNullOrWhiteSpace($Target)) {
    $Target = $values["MERHOUSE_HTTP_BIND"]
}

if ([string]::IsNullOrWhiteSpace($PublicUrl)) {
    throw "Public URL was not provided and MERHOUSE_PUBLIC_FRONTEND_URL is blank."
}
if ([string]::IsNullOrWhiteSpace($Target)) {
    throw "Target was not provided and MERHOUSE_HTTP_BIND is blank."
}

$publicUri = [Uri]$PublicUrl
if ($publicUri.Scheme -ne "https") {
    throw "ngrok deployment URL must be https: $PublicUrl"
}
if (-not $publicUri.Host.EndsWith(".ngrok-free.dev") -and -not $publicUri.Host.EndsWith(".ngrok.app")) {
    throw "Expected an ngrok public hostname, got: $($publicUri.Host)"
}

$targetUri = if ($Target -match "^https?://") {
    [Uri]$Target
} else {
    [Uri]("http://" + $Target)
}
if ($targetUri.Scheme -ne "http") {
    throw "The local frontend target should be an http URL or host:port value: $Target"
}
if ($targetUri.Host -notin @("127.0.0.1", "localhost")) {
    throw "Refusing to tunnel a non-loopback target: $($targetUri.Authority)"
}

$global:LASTEXITCODE = 0
& $NgrokPath version
if ($LASTEXITCODE -ne 0) {
    throw "ngrok was not found or did not run. Install ngrok globally and ensure it is on PATH."
}

Write-Host "Starting ngrok tunnel..."
Write-Host "Public URL: https://$($publicUri.Host)"
Write-Host "Local target: http://$($targetUri.Authority)"
Write-Host "Press Ctrl+C in this terminal to stop the tunnel."

& $NgrokPath http "--url=$($publicUri.Host)" $targetUri.Authority
