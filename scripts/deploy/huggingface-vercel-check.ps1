$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$spaceReadmePath = Join-Path $projectRoot "deploy\managed\huggingface-backend\space-readme-template.md"
$spaceDockerfilePath = Join-Path $projectRoot "deploy\managed\huggingface-backend\Dockerfile"
$backendEnvPath = Join-Path $projectRoot "deploy\managed\huggingface-backend\env.backend.example"
$vercelPath = Join-Path $projectRoot "frontend\vercel.json"
$frontendEnvPath = Join-Path $projectRoot "deploy\managed\vercel-frontend\env.frontend.example"
$applicationPropertiesPath = Join-Path $projectRoot "backend\src\main\resources\application.properties"

foreach ($path in @($spaceReadmePath, $spaceDockerfilePath, $backendEnvPath, $vercelPath, $frontendEnvPath, $applicationPropertiesPath)) {
    if (-not (Test-Path $path)) {
        throw "Required Hugging Face/Vercel deployment file was not found: $path"
    }
}

$spaceReadme = Get-Content -Raw -Path $spaceReadmePath
foreach ($required in @(
    "sdk: docker",
    "app_port: 7860",
    "https://<owner>-<space-name>.hf.space/api/v1/health"
)) {
    if ($spaceReadme -notmatch [regex]::Escape($required)) {
        throw "deploy/managed/huggingface-backend/space-readme-template.md is missing required marker: $required"
    }
}

$dockerfile = Get-Content -Raw -Path $spaceDockerfilePath
foreach ($required in @(
    "FROM eclipse-temurin:21-jdk AS build",
    "WORKDIR /workspace/backend",
    "COPY backend/ /workspace/backend/",
    "./mvnw -B -DskipTests package",
    "FROM eclipse-temurin:21-jre",
    "ENV SERVER_PORT=7860",
    "ENV PORT=7860",
    "COPY --from=build /workspace/backend/target/*.jar /app/app.jar",
    "EXPOSE 7860",
    "java"
)) {
    if ($dockerfile -notmatch [regex]::Escape($required)) {
        throw "deploy/managed/huggingface-backend/Dockerfile is missing required marker: $required"
    }
}

$backendEnv = Get-Content -Raw -Path $backendEnvPath
foreach ($required in @(
    "MERHOUSE_DEPLOYMENT_PUBLIC=true",
    "MERHOUSE_PUBLIC_FRONTEND_URL=https://<vercel-frontend>.vercel.app",
    "MERHOUSE_CORS_ALLOWED_ORIGINS=https://<vercel-frontend>.vercel.app,capacitor://localhost,ionic://localhost",
    "SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-host>/<neon-db>?sslmode=require&channelBinding=require",
    "SPRING_DATASOURCE_PASSWORD=<set as secret>",
    "MERHOUSE_AUTH_JWT_SECRET=<set as secret>",
    "MERHOUSE_EMAIL_ENABLED=false",
    "MERHOUSE_AGENT_MODE=deterministic"
)) {
    if ($backendEnv -notmatch [regex]::Escape($required)) {
        throw "Hugging Face backend env template is missing required marker: $required"
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

$frontendEnv = Get-Content -Raw -Path $frontendEnvPath
if ($frontendEnv -notmatch "VITE_API_BASE_URL=https://<backend-origin>") {
    throw "Vercel frontend env template must document VITE_API_BASE_URL with a generic backend origin."
}

$applicationProperties = Get-Content -Raw -Path $applicationPropertiesPath
if ($applicationProperties -notmatch "server\.port=\$\{PORT:\$\{SERVER_PORT:8080\}\}") {
    throw "Backend must allow platform PORT and SERVER_PORT environment variables."
}

Write-Host "Hugging Face/Vercel deployment shape check passed."
