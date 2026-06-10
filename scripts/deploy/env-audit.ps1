param(
    [string]$EnvFile = "deploy/vps/env.production.example",
    [switch]$AllowTemplate
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    [System.IO.Path]::GetFullPath($EnvFile)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $EnvFile))
}

if (-not (Test-Path $envPath)) {
    throw "Deployment env file was not found: $envPath"
}

. (Join-Path $projectRoot "scripts\quality\url-guard-lib.ps1")

function Read-EnvFile {
    param([string]$Path)

    $values = @{}
    $lineNumber = 0
    foreach ($line in Get-Content -LiteralPath $Path) {
        $lineNumber += 1
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }
        if ($trimmed -notmatch '^[A-Za-z_][A-Za-z0-9_]*=') {
            throw "Invalid env assignment at $Path line ${lineNumber}."
        }
        $parts = $trimmed -split "=", 2
        $values[$parts[0]] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

function Test-Truthy {
    param([string]$Value)
    return $Value -match '^(?i:true|1|yes|on)$'
}

function Test-PlaceholderValue {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $true
    }
    $normalized = $Value.ToLowerInvariant()
    return $normalized.Contains("replace") `
        -or $normalized.Contains("change") `
        -or $normalized.Contains("example") `
        -or $normalized.Contains("local") `
        -or $normalized.Contains("dev") `
        -or $normalized.Contains("password")
}

function Assert-Required {
    param(
        [hashtable]$Values,
        [string]$Name
    )

    if (-not $Values.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Values[$Name])) {
        throw "$Name must be present and non-blank in the deployment env file."
    }
}

function Assert-PrivateValue {
    param(
        [hashtable]$Values,
        [string]$Name
    )

    Assert-Required -Values $Values -Name $Name
    if (-not $AllowTemplate -and (Test-PlaceholderValue $Values[$Name])) {
        throw "$Name must be a private deployment value, not a placeholder."
    }
}

function Assert-IntegerRange {
    param(
        [hashtable]$Values,
        [string]$Name,
        [int]$Minimum,
        [int]$Maximum
    )

    Assert-Required -Values $Values -Name $Name
    $parsed = 0
    if (-not [int]::TryParse($Values[$Name], [ref]$parsed)) {
        throw "$Name must be an integer."
    }
    if ($parsed -lt $Minimum -or $parsed -gt $Maximum) {
        throw "$Name must be between $Minimum and $Maximum."
    }
}

$values = Read-EnvFile -Path $envPath

foreach ($required in @(
    "MERHOUSE_POSTGRES_DB",
    "MERHOUSE_POSTGRES_USER",
    "MERHOUSE_POSTGRES_PASSWORD",
    "MERHOUSE_AUTH_JWT_SECRET",
    "MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT",
    "MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES",
    "MERHOUSE_ACCESS_REQUEST_LIMIT",
    "MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS",
    "MERHOUSE_PUBLIC_FRONTEND_URL",
    "MERHOUSE_CORS_ALLOWED_ORIGINS",
    "MERHOUSE_HTTP_BIND",
    "MERHOUSE_BACKUP_HOST_DIR",
    "MERHOUSE_EMAIL_ENABLED",
    "MERHOUSE_AGENT_MODE",
    "MERHOUSE_AGENT_TIMEOUT_SECONDS"
)) {
    Assert-Required -Values $values -Name $required
}

Assert-PrivateValue -Values $values -Name "MERHOUSE_POSTGRES_PASSWORD"
Assert-PrivateValue -Values $values -Name "MERHOUSE_AUTH_JWT_SECRET"
if (-not $AllowTemplate -and [Text.Encoding]::UTF8.GetByteCount($values["MERHOUSE_AUTH_JWT_SECRET"]) -lt 32) {
    throw "MERHOUSE_AUTH_JWT_SECRET must be at least 32 bytes."
}
Assert-IntegerRange -Values $values -Name "MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT" -Minimum 1 -Maximum 20
Assert-IntegerRange -Values $values -Name "MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES" -Minimum 5 -Maximum 1440
Assert-IntegerRange -Values $values -Name "MERHOUSE_ACCESS_REQUEST_LIMIT" -Minimum 1 -Maximum 20
Assert-IntegerRange -Values $values -Name "MERHOUSE_ACCESS_REQUEST_WINDOW_HOURS" -Minimum 1 -Maximum 168

$frontendUrl = Assert-AbsoluteHttpUrl -Name "MERHOUSE_PUBLIC_FRONTEND_URL" -Value $values["MERHOUSE_PUBLIC_FRONTEND_URL"]
if (-not $frontendUrl.StartsWith("https://")) {
    throw "MERHOUSE_PUBLIC_FRONTEND_URL must be an https URL for V17 deployment."
}

if ($values.ContainsKey("MERHOUSE_FRONTEND_PUBLIC_API_URL") -and -not [string]::IsNullOrWhiteSpace($values["MERHOUSE_FRONTEND_PUBLIC_API_URL"])) {
    $frontendApiUrl = Assert-AbsoluteHttpUrl -Name "MERHOUSE_FRONTEND_PUBLIC_API_URL" -Value $values["MERHOUSE_FRONTEND_PUBLIC_API_URL"]
    if (-not $frontendApiUrl.StartsWith("https://")) {
        throw "MERHOUSE_FRONTEND_PUBLIC_API_URL must be blank for same-origin proxy or an https URL for split-origin deployment."
    }
}

$allowedOrigins = @($values["MERHOUSE_CORS_ALLOWED_ORIGINS"].Split(",") | ForEach-Object { $_.Trim().TrimEnd("/") } | Where-Object { $_ })
if ($allowedOrigins -notcontains $frontendUrl) {
    throw "MERHOUSE_CORS_ALLOWED_ORIGINS must include MERHOUSE_PUBLIC_FRONTEND_URL."
}

if ($values["MERHOUSE_HTTP_BIND"] -notmatch '^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$') {
    throw "MERHOUSE_HTTP_BIND should bind to loopback behind the reverse proxy, for example 127.0.0.1:3000."
}

if (-not [System.IO.Path]::IsPathRooted($values["MERHOUSE_BACKUP_HOST_DIR"])) {
    throw "MERHOUSE_BACKUP_HOST_DIR must be an absolute host path."
}

if (Test-Truthy $values["MERHOUSE_EMAIL_ENABLED"]) {
    Assert-Required -Values $values -Name "MERHOUSE_EMAIL_FROM"
    Assert-Required -Values $values -Name "MERHOUSE_SMTP_HOST"
    Assert-Required -Values $values -Name "MERHOUSE_SMTP_USERNAME"
    Assert-PrivateValue -Values $values -Name "MERHOUSE_SMTP_PASSWORD"
    if ($values["MERHOUSE_SMTP_HOST"] -match '^(?i:localhost|127\.0\.0\.1)$') {
        throw "MERHOUSE_SMTP_HOST must point to an external provider when email is enabled."
    }
}

if ($values["MERHOUSE_AGENT_MODE"].Trim().ToLowerInvariant() -ne "deterministic") {
    throw "MERHOUSE_AGENT_MODE must remain deterministic until a provider-backed agent runtime is implemented and proven."
}
Assert-IntegerRange -Values $values -Name "MERHOUSE_AGENT_TIMEOUT_SECONDS" -Minimum 1 -Maximum 60

Write-Host "Deployment env audit passed for $envPath"
