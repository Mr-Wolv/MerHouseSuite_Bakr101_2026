$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$renderPath = Join-Path $projectRoot "render.yaml"
$vercelPath = Join-Path $projectRoot "frontend\vercel.json"
$backendEnvPath = Join-Path $projectRoot "deploy\render\env.backend.example"
$frontendEnvPath = Join-Path $projectRoot "deploy\vercel\env.frontend.example"
$applicationPropertiesPath = Join-Path $projectRoot "backend\src\main\resources\application.properties"

foreach ($path in @($renderPath, $vercelPath, $backendEnvPath, $frontendEnvPath, $applicationPropertiesPath)) {
    if (-not (Test-Path $path)) {
        throw "Required Render/Vercel deployment file was not found: $path"
    }
}

$render = Get-Content -Raw -Path $renderPath
foreach ($required in @(
    "name: merhouse-backend",
    "env: docker",
    "rootDir: backend",
    "healthCheckPath: /api/v1/health",
    "MERHOUSE_DEPLOYMENT_PUBLIC",
    "MERHOUSE_PUBLIC_FRONTEND_URL",
    "MERHOUSE_CORS_ALLOWED_ORIGINS",
    "SPRING_DATASOURCE_URL",
    "SPRING_DATASOURCE_USERNAME",
    "SPRING_DATASOURCE_PASSWORD",
    "MERHOUSE_AUTH_JWT_SECRET",
    "MERHOUSE_SWAGGER_ENABLED"
)) {
    if ($render -notmatch [regex]::Escape($required)) {
        throw "render.yaml is missing required marker: $required"
    }
}

$vercel = Get-Content -Raw -Path $vercelPath | ConvertFrom-Json
if ($vercel.buildCommand -ne "npm run build") {
    throw "frontend/vercel.json must set buildCommand to npm run build."
}
if ($vercel.outputDirectory -ne "dist") {
    throw "frontend/vercel.json must set outputDirectory to dist."
}
if (-not ($vercel.rewrites | Where-Object { $_.source -eq "/(.*)" -and $_.destination -eq "/index.html" })) {
    throw "frontend/vercel.json must keep the SPA rewrite to /index.html."
}

$backendEnv = Get-Content -Raw -Path $backendEnvPath
foreach ($required in @(
    "MERHOUSE_DEPLOYMENT_PUBLIC=true",
    "SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-host>/<neon-db>?sslmode=require",
    "MERHOUSE_EMAIL_ENABLED=false",
    "MERHOUSE_AGENT_MODE=deterministic"
)) {
    if ($backendEnv -notmatch [regex]::Escape($required)) {
        throw "Render backend env template is missing required marker: $required"
    }
}

$frontendEnv = Get-Content -Raw -Path $frontendEnvPath
if ($frontendEnv -notmatch "VITE_API_BASE_URL=https://<render-backend>\.onrender\.com") {
    throw "Vercel frontend env template must document VITE_API_BASE_URL."
}

$applicationProperties = Get-Content -Raw -Path $applicationPropertiesPath
if ($applicationProperties -notmatch "server\.port=\$\{PORT:\$\{SERVER_PORT:8080\}\}") {
    throw "Backend must allow Render's PORT environment variable."
}

Write-Host "Render/Vercel deployment shape check passed."
