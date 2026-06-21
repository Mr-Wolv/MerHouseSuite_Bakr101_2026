param(
    [switch]$SkipCompose
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host ""
    Write-Host $Label
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed."
    }
}

function Assert-IgnoredLocalPath {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $absolutePath = Join-Path $projectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $absolutePath)) {
        return
    }

    git check-ignore -q $RelativePath 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "$RelativePath exists but is not ignored. Local deployment secrets must stay out of Git."
    }
}

function Get-RepoRelativePath {
    param([Parameter(Mandatory = $true)][string]$FullName)

    return $FullName.Substring($projectRoot.Length).TrimStart("\", "/") -replace "\\", "/"
}

Push-Location $projectRoot
try {
    Invoke-Checked "Checking diff whitespace..." { git diff --check }

    Write-Host ""
    Write-Host "Checking repository shape..."
    $ignoreOutput = git check-ignore -v frontend/tests/e2e/full-tour.spec.ts frontend/playwright.config.ts 2>$null
    $frontendIgnored = $ignoreOutput | Where-Object { $_ -match "frontend/(tests/e2e|playwright\.config\.ts)" }
    if ($frontendIgnored) {
        throw "Frontend Playwright tests or config are still ignored."
    }
    foreach ($obsoleteDockerfile in @("backend/Dockerfile", "frontend/Dockerfile", "backend/Dockerfile.local", "frontend/Dockerfile.local")) {
        if (Test-Path -LiteralPath (Join-Path $projectRoot $obsoleteDockerfile)) {
            throw "$obsoleteDockerfile is ambiguous. Use service-specific Compose Dockerfiles or deploy/managed/* for managed deployment templates."
        }
    }
    foreach ($requiredLocalDockerfile in @("backend/backend-compose.Dockerfile", "frontend/frontend-compose.Dockerfile")) {
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $requiredLocalDockerfile))) {
            throw "$requiredLocalDockerfile is required for the local Docker Compose stack."
        }
    }
    $composePath = Join-Path $projectRoot "docker-compose.yml"
    $composeText = Get-Content -Raw -LiteralPath $composePath
    foreach ($requiredComposeMarker in @("dockerfile: backend-compose.Dockerfile", "dockerfile: frontend-compose.Dockerfile", "context: ./backend", "context: ./frontend")) {
        if ($composeText -notmatch [regex]::Escape($requiredComposeMarker)) {
            throw "docker-compose.yml must keep local backend/frontend builds explicit with marker: $requiredComposeMarker"
        }
    }
    Write-Host "Repository shape check passed."

    Write-Host ""
    Write-Host "Checking public CI naming..."
    $workflowPath = Join-Path $projectRoot ".github\workflows\merhouse-quality-gate.yml"
    if (Test-Path -LiteralPath $workflowPath) {
        $workflowText = Get-Content -Raw -LiteralPath $workflowPath
        if ($workflowText -notmatch '(?m)^name:\s*MerHouse Quality Gate\s*$') {
            throw "GitHub Actions workflow name must be 'MerHouse Quality Gate'."
        }
        if ($workflowText -notmatch '(?m)^run-name:\s*MerHouse Quality Gate\b') {
            throw "GitHub Actions visible run title must begin with 'MerHouse Quality Gate'."
        }
    }
    $workflowFiles = Get-ChildItem -Path (Join-Path $projectRoot ".github\workflows") -Filter *.yml -File
    foreach ($workflowFile in $workflowFiles) {
        $workflowText = Get-Content -Raw -LiteralPath $workflowFile.FullName
        if ($workflowText -match 'actions/upload-artifact') {
            throw "$($workflowFile.Name) must not publish GitHub Actions artifacts. Use pass/fail logs for CI and GitHub Releases only for deliberate public APK assets."
        }
    }
    Write-Host "CI naming check passed."

    $publicPathOutput = git ls-files --cached --others --exclude-standard
    $publicFiles = $publicPathOutput |
        Where-Object { $_ } |
        ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) -ErrorAction SilentlyContinue } |
        Where-Object {
            $_ -and -not $_.PSIsContainer
        }

    Write-Host ""
    Write-Host "Checking public file names for ambiguity..."
    $allowedDuplicateNames = @(
        ".dockerignore",
        ".gitattributes",
        ".gitignore",
        "application.properties",
        "build.gradle",
        "ic_launcher.png",
        "ic_launcher_foreground.png",
        "ic_launcher_round.png",
        "pom.xml",
        "splash.png"
    )
    $ambiguousGroups = $publicFiles |
        Group-Object Name |
        Where-Object {
            $_.Count -gt 1 -and
            $allowedDuplicateNames -notcontains $_.Name
        }
    if ($ambiguousGroups) {
        foreach ($group in $ambiguousGroups | Sort-Object Name) {
            Write-Host "Ambiguous file name: $($group.Name)"
            $group.Group |
                Sort-Object FullName |
                ForEach-Object { Write-Host ("  " + (Get-RepoRelativePath -FullName $_.FullName)) }
        }
        throw "Ambiguous project-owned file names found. Rename public files with purpose-bearing names or add a narrow generated/framework exception."
    }
    Write-Host "File-name ambiguity check passed."

    Write-Host ""
    Write-Host "Checking repository tree for local-only folders..."
    if (Test-Path -LiteralPath (Join-Path $projectRoot ".notes")) {
        Join-Path $projectRoot ".notes"
        throw "Local working notes must not be present in the repository tree."
    }
    foreach ($relativePath in @("private", ".secrets", "deploy/private")) {
        Assert-IgnoredLocalPath -RelativePath $relativePath
    }
    Write-Host "Local-folder boundary check passed. Ignored private deployment workspaces are allowed."

    Write-Host ""
    Write-Host "Checking repository tree for unsafe runtime files..."
    $forbiddenFiles = $publicFiles |
        Where-Object {
            (
                $_.Name -match '^\.env(\..*)?$' -or
                $_.Extension -in @(".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".kubeconfig", ".apk", ".aab")
            )
        }
    $forbiddenFiles = $forbiddenFiles | Where-Object { $_.Name -ne ".env.example" }
    if ($forbiddenFiles) {
        $forbiddenFiles | ForEach-Object { $_.FullName }
        throw "Unsafe runtime files found in the repository tree."
    }
    Write-Host "Runtime-file boundary check passed."

    Write-Host ""
    Write-Host "Scanning repository tree for token-shaped values..."
    $patterns = @(
        'AKIA[0-9A-Z]{16}',
        'AIza[0-9A-Za-z_-]{35}',
        'ghp_[0-9A-Za-z]{36,}',
        'github_pat_[0-9A-Za-z_]{80,}',
        'glpat-[0-9A-Za-z_-]{20,}',
        'sk-[A-Za-z0-9_-]{24,}',
        'sk-ant-api[0-9A-Za-z_-]{20,}',
        'xai-[A-Za-z0-9_-]{20,}',
        'gsk_[A-Za-z0-9_-]{20,}',
        'hf_[A-Za-z0-9]{30,}',
        'sk_live_[0-9A-Za-z]{20,}',
        'rk_live_[0-9A-Za-z]{20,}',
        'SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}',
        'xox[baprs]-[0-9A-Za-z-]{20,}',
        'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
        '-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----',
        '(?i)(mongodb(\+srv)?|mysql|mariadb|sqlserver|redis|amqp|kafka|postgres(ql)?)://[^\s''"]+:[^\s''"]+@',
        'postgres(ql)?://[^\s]+:[^\s]+@',
        '(?i)(OPENAI|ANTHROPIC|GEMINI|GOOGLE_AI|GROQ|MISTRAL|COHERE|HUGGINGFACE|HF|XAI|AZURE_OPENAI|STRIPE|PAYPAL|TWILIO|SENDGRID|MAILGUN|SLACK|AWS|AZURE|GCP|GOOGLE|SENTRY|DATADOG)[A-Z0-9_.-]*(API[_-]?KEY|TOKEN|SECRET|KEY|PASSWORD)\s*[:=]\s*[''"][^''"]{8,}[''"]',
        '(?i)(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|webhook[_-]?secret|private[_-]?key|signing[_-]?secret)\s*[:=]\s*[''"][A-Za-z0-9_./+=:-]{16,}[''"]',
        '\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b',
        '\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b'
    )
    $excludedDirSegments = @(
        '.git', 'node_modules', 'target', 'dist',
        'test-results', 'playwright-report',
        'reports', '.secrets'
    )
    $excludedDirPaths = @('private', 'deploy/private')
    $excludedFileNames = @('package-lock.json')
    $excludedExtensions = @(
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp',
        '.jar', '.class', '.dll', '.exe', '.so',
        '.zip', '.tar', '.gz', '.7z',
        '.woff', '.woff2', '.ttf', '.eot',
        '.keystore', '.jks', '.p12', '.pfx', '.pem', '.key'
    )
    $scanFiles = Get-ChildItem -Path $projectRoot -File -Recurse -Force |
        Where-Object {
            $relPath = $_.FullName.Substring($projectRoot.Length + 1)
            $pathSegments = $relPath -split '[\\/]'
            $hitExcluded = $false
            foreach ($seg in $pathSegments) {
                if ($excludedDirSegments -contains $seg) { $hitExcluded = $true; break }
            }
            if (-not $hitExcluded) {
                $relPathForward = $relPath -replace '\\', '/'
                foreach ($dp in $excludedDirPaths) {
                    $dpForward = $dp -replace '\\', '/'
                    if ($relPathForward.StartsWith("$dpForward/") -or $relPathForward -eq $dpForward) {
                        $hitExcluded = $true; break
                    }
                }
            }
            -not $hitExcluded -and
                $excludedFileNames -notcontains $_.Name -and
                $excludedExtensions -notcontains $_.Extension.ToLower()
        }
    $matches = @()
    foreach ($pattern in $patterns) {
        try {
            $hits = $scanFiles | Select-String -Pattern $pattern -ErrorAction SilentlyContinue
            if ($hits) {
                foreach ($hit in $hits) {
                    $relPath = $hit.Path.Substring($projectRoot.Length + 1) -replace '\\', '/'
                    $matches += "$relPath`:$($hit.LineNumber):$($hit.Line.Trim())"
                }
            }
        } catch {
            throw "Sensitive-pattern scan failed while checking pattern: $pattern -- $($_.Exception.Message)"
        }
    }
    # Known false-positive values that are intentionally committed (local-dev / demo
    # values that look like tokens but are not real secrets).
    $falsePositivePatterns = @(
        'emulator-api-key'   # Fake API key for local Firebase Auth emulator only
        'hf_your_token'      # Placeholder used in local deployment documentation
    )
    $matches = $matches | Where-Object {
        $line = $_ -replace '^[^:]+:[^:]+:', ''
        $isFp = $falsePositivePatterns | Where-Object { $line -match [regex]::Escape($_) } | Select-Object -First 1
        -not $isFp
    }
    if ($matches.Count -gt 0) {
        $matches | Sort-Object -Unique
        throw "Token-shaped value scan found matches that need review."
    }
    Write-Host "Token-shaped value scan passed."

    if (-not $SkipCompose) {
        Invoke-Checked "Validating Docker Compose config..." { docker compose --env-file .env.example config --quiet }
    }
} finally {
    Pop-Location
}

exit 0
