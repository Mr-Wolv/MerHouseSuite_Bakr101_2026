param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = "deploy/vps/env.production.example"
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$composePath = if ([System.IO.Path]::IsPathRooted($ComposeFile)) {
    [System.IO.Path]::GetFullPath($ComposeFile)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ComposeFile))
}
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    [System.IO.Path]::GetFullPath($EnvFile)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $EnvFile))
}

if (-not (Test-Path $composePath)) {
    throw "Production compose file was not found: $composePath"
}
if (-not (Test-Path $envPath)) {
    throw "Production env template was not found: $envPath"
}

Write-Host "Validating VPS Compose file: $composePath"
$composeConfig = docker compose --env-file $envPath -f $composePath config
if ($LASTEXITCODE -ne 0) {
    throw "Production Compose validation failed."
}

$composeText = $composeConfig -join "`n"
$requiredPatterns = @(
    'MERHOUSE_DEPLOYMENT_PUBLIC:\s+"?true"?',
    'MERHOUSE_AUTH_RECOVERY_EXPOSE_RESET_TOKEN:\s+"?false"?',
    'MERHOUSE_AUTH_RECOVERY_REQUEST_LIMIT:\s+"?5"?',
    'MERHOUSE_AUTH_RECOVERY_REQUEST_WINDOW_MINUTES:\s+"?60"?',
    'MERHOUSE_AUTH_SEED_ADMIN_ENABLED:\s+"?false"?',
    'MERHOUSE_SWAGGER_ENABLED:\s+"?false"?',
    'SPRING_DATASOURCE_URL:\s+jdbc:postgresql://postgres:5432/',
    'VITE_API_BASE_URL:',
    'curl -fsS http://localhost:8080/api/v1/health',
    'wget -qO- http://localhost/'
)

foreach ($pattern in $requiredPatterns) {
    if ($composeText -notmatch $pattern) {
        throw "Production Compose output is missing required deployment boundary: $pattern"
    }
}

Write-Host "VPS deployment shape check passed."
