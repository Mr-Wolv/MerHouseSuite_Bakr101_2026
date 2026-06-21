param(
    [string]$EnvFile = ".secrets/deploy/firebase/firebase-spark.env",
    [switch]$WhatIf,
    [switch]$SkipBuild,
    [switch]$SkipDeploy,
    [switch]$Quiet
)

$VerboseOutput = -not $Quiet
$projectRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName

function Log {
    param([string]$Level, [string]$Msg)
    $ts = [DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss UTC')
    $color = @{OK='Green'; ERROR='Red'; WARN='Yellow'; INFO='Cyan'; PROMPT='Magenta'}
    if ($Level -eq 'DETAIL' -and -not $VerboseOutput) { return }
    $c = $color[$Level]
    if ($c) { Write-Host "[$ts] [$Level] $Msg" -ForegroundColor $c }
    else { Write-Host "[$ts] [$Level] $Msg" }
}

Log INFO 'MerHouse Firebase Hosting Local Deployment'
Log INFO "Project root: $projectRoot"
if ($VerboseOutput) { Log DETAIL 'Verbose output enabled. Use -Quiet to suppress.' }

Log INFO "Loading secrets from: $EnvFile"
$secrets = @{}
$path = Join-Path $projectRoot $EnvFile
if (Test-Path $path) {
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $i = $line.IndexOf('=')
            $k = $line.Substring(0, $i).Trim()
            $v = $line.Substring($i + 1).Trim().Trim('"', "'")
            $secrets[$k] = $v
        }
    }
}

$required = @('VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_APP_ID','VITE_API_BASE_URL')
$missing = @()
foreach ($k in $required) {
    if (-not $secrets[$k]) {
        $envVal = [Environment]::GetEnvironmentVariable($k)
        if ($envVal) { $secrets[$k] = $envVal } else { $missing += $k }
    }
}
if ($missing.Count -gt 0) { Log ERROR "Missing required secrets: $($missing -join ', ')"; exit 1 }
Log OK "All $($required.Count) required secrets present"

try { Log OK "Node.js: $((& node --version 2>$null).Trim())" }
catch { Log ERROR 'Node.js not found'; exit 1 }
try { Log OK "npm: $((& npm --version 2>$null).Trim())" }
catch { Log ERROR 'npm not found'; exit 1 }
try { Log OK "Firebase CLI: $((& firebase --version 2>$null).Trim())" }
catch { Log ERROR 'Firebase CLI not found -- run: npm install -g firebase-tools'; exit 1 }

Log INFO 'Checking Firebase authentication...'
$authed = $false
try {
    $fb = (& firebase projects:list --json 2>&1 | Out-String)
    if ($fb -match $secrets['VITE_FIREBASE_PROJECT_ID']) { $authed = $true }
} catch {}
if (-not $authed) {
    try {
        $fb = (& firebase projects:list 2>&1 | Out-String)
        if ($fb -match $secrets['VITE_FIREBASE_PROJECT_ID']) { $authed = $true }
    } catch {}
}
if ($authed) { Log OK "Firebase authenticated for $($secrets['VITE_FIREBASE_PROJECT_ID'])" }
else { Log WARN 'Firebase auth not verified -- proceeding anyway' }

$projectId = $secrets['VITE_FIREBASE_PROJECT_ID']

if ($WhatIf) {
    Log INFO '=== WHAT-IF MODE ==='
    Log INFO "  Project: $projectId"
    Log INFO "  API: $($secrets['VITE_API_BASE_URL'])"
    Log INFO "  Build: npm run build"
    Log INFO "  Deploy: firebase deploy --only hosting"
    exit 0
}

if (-not $SkipBuild) {
    Log INFO 'Installing frontend dependencies...'
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    } finally { Pop-Location }
    Log OK 'Dependencies installed'

    Log INFO 'Building frontend...'
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        $env:VITE_FIREBASE_API_KEY = $secrets['VITE_FIREBASE_API_KEY']
        $env:VITE_FIREBASE_AUTH_DOMAIN = $secrets['VITE_FIREBASE_AUTH_DOMAIN']
        $env:VITE_FIREBASE_PROJECT_ID = $projectId
        $env:VITE_FIREBASE_STORAGE_BUCKET = $secrets['VITE_FIREBASE_STORAGE_BUCKET']
        $env:VITE_FIREBASE_MESSAGING_SENDER_ID = $secrets['VITE_FIREBASE_MESSAGING_SENDER_ID']
        $env:VITE_FIREBASE_APP_ID = $secrets['VITE_FIREBASE_APP_ID']
        $env:VITE_API_BASE_URL = $secrets['VITE_API_BASE_URL']
        $env:VITE_FIREBASE_EMULATOR_HOST = ''
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
        Log OK 'Build complete'
    } finally { Pop-Location }
}

if (-not $SkipDeploy) {
    Log INFO 'Deploying to Firebase Hosting...'
    Push-Location $projectRoot
    try {
        $out = & firebase deploy --only hosting --project $projectId --debug 2>&1
        $outStr = $out | Out-String
        if ($LASTEXITCODE -ne 0) { throw 'Deploy failed' }
        Log OK 'Deploy complete'
        if ($outStr -match 'https://[^\s]+\.web\.app') { Log OK "Site: $($Matches[0])" }
    } finally { Pop-Location }

    Log INFO 'Verifying frontend...'
    try {
        $r = Invoke-WebRequest -Uri "https://$projectId.web.app" -TimeoutSec 30 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { Log OK 'Frontend live (HTTP 200)' }
        else { Log WARN "HTTP $($r.StatusCode)" }
    } catch { Log WARN 'Verification failed' }
    Log OK "DEPLOYED: https://$projectId.web.app"
} else { Log INFO 'Build only -- deploy skipped' }
