param(
    [switch]$SkipCompose
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

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
    Write-Host "Repository shape check passed."

    Write-Host ""
    Write-Host "Checking public CI naming..."
    $workflowPath = Join-Path $projectRoot ".github\workflows\ci.yml"
    if (Test-Path -LiteralPath $workflowPath) {
        $workflowText = Get-Content -Raw -LiteralPath $workflowPath
        if ($workflowText -notmatch '(?m)^name:\s*MerHouse Quality Gate\s*$') {
            throw "GitHub Actions workflow name must be 'MerHouse Quality Gate'."
        }
        if ($workflowText -notmatch '(?m)^run-name:\s*MerHouse Quality Gate\b') {
            throw "GitHub Actions visible run title must begin with 'MerHouse Quality Gate'."
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
    $matches = @()
    foreach ($pattern in $patterns) {
        $result = rg -n --pcre2 `
            --glob '!/.git/**' `
            --glob '!node_modules/**' `
            --glob '!frontend/node_modules/**' `
            --glob '!frontend/dist/**' `
            --glob '!frontend/test-results/**' `
            --glob '!frontend/playwright-report/**' `
            --glob '!backend/target/**' `
            --glob '!reports/**' `
            --glob '!private/**' `
            --glob '!.secrets/**' `
            --glob '!deploy/private/**' `
            --glob '!package-lock.json' `
            --glob '!frontend/package-lock.json' `
            -- $pattern . 2>$null
        if ($LASTEXITCODE -eq 0) {
            $matches += $result
        } elseif ($LASTEXITCODE -eq 1) {
            $global:LASTEXITCODE = 0
        } else {
            throw "Sensitive-pattern scan failed while checking pattern: $pattern"
        }
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
