param(
    [string]$ConfigPath = "deploy/vps/reverse-proxy.nginx.conf"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$resolvedConfigPath = if ([System.IO.Path]::IsPathRooted($ConfigPath)) {
    [System.IO.Path]::GetFullPath($ConfigPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ConfigPath))
}

if (-not (Test-Path $resolvedConfigPath)) {
    throw "Reverse proxy config was not found: $resolvedConfigPath"
}

$config = Get-Content -Raw -LiteralPath $resolvedConfigPath
$requiredPatterns = @(
    'listen\s+80',
    'return\s+301\s+https://\$host\$request_uri',
    'listen\s+443\s+ssl\s+http2',
    'ssl_protocols\s+TLSv1\.2\s+TLSv1\.3',
    'Strict-Transport-Security',
    'X-Content-Type-Options\s+nosniff',
    'X-Frame-Options\s+DENY',
    'Referrer-Policy\s+strict-origin-when-cross-origin',
    'Permissions-Policy',
    'Content-Security-Policy',
    'frame-ancestors\s+''none''',
    'location\s+~\s+\^/\(swagger-ui\|swagger-ui\\\.html\|v3/api-docs\)',
    'return\s+404',
    'proxy_set_header\s+X-Forwarded-Proto\s+https',
    'proxy_pass\s+http://127\.0\.0\.1:3000'
)

foreach ($pattern in $requiredPatterns) {
    if ($config -notmatch $pattern) {
        throw "Reverse proxy template is missing required public-edge boundary: $pattern"
    }
}

Write-Host "Reverse proxy template check passed: $resolvedConfigPath"

