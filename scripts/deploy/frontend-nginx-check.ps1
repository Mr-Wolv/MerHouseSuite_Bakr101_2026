param(
    [string]$ConfigPath = "frontend/nginx.conf",
    [string]$DockerfilePath = "frontend/Dockerfile"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$resolvedConfigPath = if ([System.IO.Path]::IsPathRooted($ConfigPath)) {
    [System.IO.Path]::GetFullPath($ConfigPath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ConfigPath))
}
$resolvedDockerfilePath = if ([System.IO.Path]::IsPathRooted($DockerfilePath)) {
    [System.IO.Path]::GetFullPath($DockerfilePath)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $DockerfilePath))
}

if (-not (Test-Path $resolvedConfigPath)) {
    throw "Frontend nginx config was not found: $resolvedConfigPath"
}
if (-not (Test-Path $resolvedDockerfilePath)) {
    throw "Frontend Dockerfile was not found: $resolvedDockerfilePath"
}

$config = Get-Content -Raw -LiteralPath $resolvedConfigPath
$dockerfile = Get-Content -Raw -LiteralPath $resolvedDockerfilePath

$requiredConfigPatterns = @(
    'listen\s+80',
    'root\s+/usr/share/nginx/html',
    'location\s+/api/',
    'proxy_pass\s+http://backend:8080',
    'proxy_http_version\s+1\.1',
    'proxy_set_header\s+Host\s+\$host',
    'proxy_set_header\s+X-Real-IP\s+\$remote_addr',
    'proxy_set_header\s+X-Forwarded-For\s+\$proxy_add_x_forwarded_for',
    'proxy_set_header\s+X-Forwarded-Proto\s+\$scheme',
    'location\s+/',
    'try_files\s+\$uri\s+\$uri/\s+/index\.html'
)

foreach ($pattern in $requiredConfigPatterns) {
    if ($config -notmatch $pattern) {
        throw "Frontend nginx config is missing required same-origin deployment boundary: $pattern"
    }
}

$requiredDockerfilePatterns = @(
    'FROM\s+nginx:stable-alpine',
    'COPY\s+nginx\.conf\s+/etc/nginx/conf\.d/default\.conf',
    'COPY\s+--from=build\s+/app/dist\s+/usr/share/nginx/html',
    'EXPOSE\s+80'
)

foreach ($pattern in $requiredDockerfilePatterns) {
    if ($dockerfile -notmatch $pattern) {
        throw "Frontend Dockerfile is missing required nginx deployment boundary: $pattern"
    }
}

Write-Host "Frontend nginx same-origin proxy check passed: $resolvedConfigPath"
