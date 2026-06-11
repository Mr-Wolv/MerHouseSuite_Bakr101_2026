param(
    [string]$ComposeFile = "deploy/vps/compose.production.yml",
    [string]$EnvFile = ".secrets/deploy/env.production",
    [Parameter(Mandatory = $true)] [string]$OwnerEmail,
    [Parameter(Mandatory = $true)] [string]$OwnerPassword,
    [string]$TenantName = "Platform Admin",
    [switch]$ConfirmBootstrap
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmBootstrap) {
    throw "Owner bootstrap creates the first deployed owner account. Re-run with -ConfirmBootstrap only against the intended staging or production environment."
}
if ([string]::IsNullOrWhiteSpace($OwnerEmail) -or $OwnerEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    throw "OwnerEmail must be a non-blank email address."
}
if ([string]::IsNullOrWhiteSpace($OwnerPassword) -or $OwnerPassword.Length -lt 16) {
    throw "OwnerPassword must be at least 16 characters."
}
if ([string]::IsNullOrWhiteSpace($TenantName)) {
    throw "TenantName must be non-blank."
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Resolve-ProjectPath {
    param([Parameter(Mandatory = $true)] [string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $projectRoot $Path))
}

function Read-EnvValue {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }
        if ($trimmed -match "^$([regex]::Escape($Name))=(.*)$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    throw "$Name was not found in $Path."
}

function ConvertTo-PostgresLiteral {
    param([Parameter(Mandatory = $true)] [string]$Value)

    return "'" + $Value.Replace("'", "''") + "'"
}

$composePath = Resolve-ProjectPath -Path $ComposeFile
$envPath = Resolve-ProjectPath -Path $EnvFile
if (-not (Test-Path -LiteralPath $composePath)) {
    throw "Compose file was not found: $composePath"
}
if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Deployment env file was not found: $envPath"
}
if ((Split-Path $envPath -Leaf) -eq "env.production.example") {
    throw "Refusing to bootstrap owner with the example env template. Use an ignored private env file."
}

$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "env-audit.ps1") -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Owner bootstrap env audit failed."
}
$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot "vps-check.ps1") -ComposeFile $composePath -EnvFile $envPath
if ($LASTEXITCODE -ne 0) {
    throw "Owner bootstrap VPS shape check failed."
}

$postgresUser = Read-EnvValue -Path $envPath -Name "MERHOUSE_POSTGRES_USER"
$postgresDb = Read-EnvValue -Path $envPath -Name "MERHOUSE_POSTGRES_DB"
$ownerCount = docker compose --env-file $envPath -f $composePath exec -T postgres psql `
    -t `
    -A `
    -v "ON_ERROR_STOP=1" `
    -U $postgresUser `
    -d $postgresDb `
    -c "SELECT COUNT(*) FROM app_users WHERE role = 'OWNER' AND enabled = true;"
if ($LASTEXITCODE -ne 0) {
    throw "Owner bootstrap preflight query failed."
}
if ([int]$ownerCount -gt 0) {
    throw "Enabled owner already exists; bootstrap refused."
}

$tenantNameLiteral = ConvertTo-PostgresLiteral -Value $TenantName
$ownerEmailLiteral = ConvertTo-PostgresLiteral -Value $OwnerEmail
$ownerPasswordLiteral = ConvertTo-PostgresLiteral -Value $OwnerPassword

$sql = @"
WITH tenant_insert AS (
    INSERT INTO tenants(name, type, active)
    VALUES ($tenantNameLiteral, 'WAREHOUSE_PROVIDER', true)
    RETURNING id
),
owner_insert AS (
    INSERT INTO app_users(tenant_id, email, password_hash, role, enabled)
    SELECT id, lower($ownerEmailLiteral), crypt($ownerPasswordLiteral, gen_salt('bf', 12)), 'OWNER', true
    FROM tenant_insert
    RETURNING id, tenant_id
)
INSERT INTO admin_audit_events(actor_user_id, action, aggregate_type, aggregate_id, reason, metadata)
SELECT
    id,
    'OWNER_BOOTSTRAPPED',
    'APP_USER',
    id,
    'V17 deployment owner bootstrap',
    jsonb_build_object('tenantId', tenant_id, 'seedAdminEnabled', false)
FROM owner_insert;
"@

Write-Host "Bootstrapping first owner through postgres service for env file: $(Split-Path $envPath -Leaf)"
$sql | docker compose --env-file $envPath -f $composePath exec -T postgres psql `
    -v "ON_ERROR_STOP=1" `
    -U $postgresUser `
    -d $postgresDb
if ($LASTEXITCODE -ne 0) {
    throw "Owner bootstrap failed."
}

Write-Host "Owner bootstrap completed for $OwnerEmail. Store the credential privately and run deployed proof next."
