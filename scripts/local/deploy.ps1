#!/usr/bin/env pwsh
<#
.SYNOPSIS
    MerHouse Local Deployment Orchestrator

.DESCRIPTION
    Unified local deployment script for MerHouse.
    Orchestrates deployment to both Hugging Face Spaces (backend) and
    Firebase Hosting (frontend) with secure secret handling, monitoring,
    and verbose error reporting.

    Replaces the GitHub CI/CD workflow for local deployment workflows.

.PARAMETER Backend
    Deploy only the backend to Hugging Face Spaces.

.PARAMETER Frontend
    Deploy only the frontend to Firebase Hosting.

.PARAMETER Both
    Deploy both backend and frontend (default if no target specified).

.PARAMETER WipeHf
    For HF: perform a FULL WIPE (delete all code, variables, secrets) before redeploy.
    Use with caution. Implies -Backend.

.PARAMETER SyncEnv
    For HF: sync only environment variables (no code upload). Implies -Backend.

.PARAMETER DeleteOrphans
    For HF: delete remote env vars/secrets that are not present in the local config.
    Use with -SyncEnv or -Both.

.PARAMETER HfTimeout
    Health check timeout in minutes for HF (default: 30).

.PARAMETER WhatIf
    Show what would be done without making changes.

.PARAMETER Verbose
    Extra verbose output (implied by default; use -Quiet to suppress).

.PARAMETER Quiet
    Suppress non-error output. Verbose is the default.

.PARAMETER HfSecretsFile
    Path to HF secrets env file. Default: .secrets/deploy/managed/huggingface.env

.PARAMETER FirebaseSecretsFile
    Path to Firebase secrets env file. Default: .secrets/deploy/firebase/firebase-spark.env

.PARAMETER PythonPath
    Path to Python executable. Auto-detected if not specified.

.PARAMETER SkipBuild
    For Firebase: skip frontend build and deploy existing dist/.

.EXAMPLE
    .\scripts\local\deploy.ps1
    # Deploys both backend and frontend (verbose by default)

.EXAMPLE
    .\scripts\local\deploy.ps1 -Quiet
    # Deploys both with only important messages shown

.EXAMPLE
    .\scripts\local\deploy.ps1
    # Deploys both backend and frontend

.EXAMPLE
    .\scripts\local\deploy.ps1 -Backend -WipeHf
    # Wipe HF space completely and redeploy backend from scratch

.EXAMPLE
    .\scripts\local\deploy.ps1 -SyncEnv -DeleteOrphans
    # Sync only env vars to HF, deleting remote vars not in local config

.EXAMPLE
    .\scripts\local\deploy.ps1 -Frontend -WhatIf
    # Preview what the frontend deploy would do

.EXAMPLE
    .\scripts\local\deploy.ps1 -Both -WipeHf
    # Full wipe + redeploy both backend and frontend (verbose is default)
#>
param(
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$Both,
    [switch]$WipeHf,
    [switch]$WipeOnlyHf,
    [switch]$WipeCodeOnlyHf,
    [switch]$WipeEnvOnlyHf,
    [switch]$SyncEnv,
    [switch]$DeleteOrphans,
    [int]$HfTimeout = 30,
    [switch]$WhatIf,
    [switch]$Verbose,
    [string]$HfSecretsFile = ".secrets/deploy/managed/huggingface.env",
    [string]$FirebaseSecretsFile = ".secrets/deploy/firebase/firebase-spark.env",
    [string]$PythonPath = "",
    [switch]$SkipBuild,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

# ── Import common helpers ───────────────────────────────────────────────────
. (Join-Path $PSScriptRoot "..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot

# Verbose is the default. DETAIL output shows unless -Quiet is used.
$ShowDetail = -not $Quiet -or $Verbose

# ── Logging helpers (verbose-by-default) ────────────────────────────────────
function Write-DeployLog {
    param([string]$Level, [string]$Message)
    $ts = [DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC")
    switch ($Level) {
        "OK"      { Write-Host "[$ts] [OK]    $Message" -ForegroundColor Green }
        "ERROR"   { Write-Host "[$ts] [ERROR] $Message" -ForegroundColor Red }
        "WARN"    { Write-Host "[$ts] [WARN]  $Message" -ForegroundColor Yellow }
        "INFO"    { Write-Host "[$ts] [INFO]  $Message" -ForegroundColor Cyan }
        "DETAIL"  { if ($ShowDetail) { Write-Host "[$ts] [DETAIL] $Message" -ForegroundColor Gray } }
        "STEP"    { Write-Host "`n[$ts] [STEP]  $Message" -ForegroundColor Magenta; Write-Host ("-" * 60) }
        "PROMPT"  { Write-Host "[$ts] [PROMPT] $Message" -ForegroundColor Magenta }
        default   { Write-Host "[$ts] [$Level] $Message" }
    }
}

# ── Determine deployment targets ────────────────────────────────────────────
if (-not $Backend -and -not $Frontend -and -not $Both -and -not $WipeHf -and -not $SyncEnv -and -not $WipeOnlyHf -and -not $WipeCodeOnlyHf -and -not $WipeEnvOnlyHf) {
    $Both = $true  # Default: deploy both
}

if ($WipeHf -or $WipeOnlyHf -or $WipeCodeOnlyHf -or $WipeEnvOnlyHf) {
    $Backend = $true
}
if ($SyncEnv) {
    $Backend = $true
}
if ($Both) {
    $Backend = $true
    $Frontend = $true
}

Write-DeployLog "INFO" "=" * 60
Write-DeployLog "INFO" "MerHouse Local Deployment Orchestrator"
Write-DeployLog "INFO" "=" * 60
Write-DeployLog "INFO" "Targets: Backend=$Backend, Frontend=$Frontend"
Write-DeployLog "INFO" "Project root: $projectRoot"

if (-not $Quiet) {
    Write-DeployLog "INFO" "Verbose output enabled. Use -Quiet to suppress."
}

if ($WhatIf) {
    Write-DeployLog "INFO" "WHAT-IF MODE: No changes will be made"
}

# ── Resolve Python path ─────────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($PythonPath)) {
    # Try common Python paths on Windows
    $pythonCandidates = @(
        "python"
        "python3"
        "py"
        "python.exe"
        "python3.exe"
        "C:\Python314\python.exe"
        "C:\Python313\python.exe"
        "C:\Python312\python.exe"
        "C:\Python311\python.exe"
        "C:\Python310\python.exe"
        "C:\Program Files\Python314\python.exe"
        "C:\Program Files\Python313\python.exe"
        "C:\Program Files\Python312\python.exe"
        "C:\Program Files\Python311\python.exe"
        "C:\Program Files\Python310\python.exe"
    )
    
    foreach ($candidate in $pythonCandidates) {
        try {
            $testVersion = (& $candidate --version 2>&1).ToString()
            if ($testVersion -match "Python") {
                $PythonPath = $candidate
                Write-DeployLog "DETAIL" "Found Python: $PythonPath ($testVersion)"
                break
            }
        } catch {
            continue
        }
    }
    
    if ([string]::IsNullOrWhiteSpace($PythonPath)) {
        Write-DeployLog "ERROR" "Python not found. Please install Python or specify -PythonPath"
        exit 1
    }
}

# Verify Python works
try {
    $pyVersion = (& $PythonPath --version 2>&1).ToString()
    Write-DeployLog "OK" "Python: $pyVersion"
} catch {
    Write-DeployLog "ERROR" "Cannot execute Python at: $PythonPath"
    exit 1
}

# Check required Python packages
Write-DeployLog "INFO" "Checking Python dependencies..."
try {
    $hfCheck = & $PythonPath -c "import huggingface_hub; print(huggingface_hub.__version__)" 2>&1
    if ($hfCheck -match "^\d") {
        Write-DeployLog "OK" "huggingface_hub: $hfCheck"
    } else {
        Write-DeployLog "ERROR" "huggingface_hub check failed: $hfCheck"
    }
} catch {
    Write-DeployLog "ERROR" "huggingface_hub is not installed. Run: pip install huggingface_hub"
}

try {
    $reqCheck = & $PythonPath -c "import requests; print('ok')" 2>&1
    if ($reqCheck -eq "ok") {
        Write-DeployLog "OK" "requests: installed"
    } else {
        Write-DeployLog "ERROR" "requests check failed: $reqCheck"
    }
} catch {
    Write-DeployLog "ERROR" "requests is not installed. Run: pip install requests"
}

# ── Backend Deployment (Hugging Face) ───────────────────────────────────────
if ($Backend) {
    Write-DeployLog "STEP" "BACKEND DEPLOYMENT (Hugging Face Spaces)"
    
    $hfDeployScript = Join-Path $PSScriptRoot "hf-deploy.py"
    if (-not (Test-Path $hfDeployScript)) {
        Write-DeployLog "ERROR" "HF deploy script not found: $hfDeployScript"
        exit 1
    }
    
    # Resolve secrets file path
    $hfEnvPath = Resolve-MerHousePath -Path $HfSecretsFile -ProjectRoot $projectRoot
    if (-not (Test-Path $hfEnvPath)) {
        Write-DeployLog "ERROR" "HF secrets file not found: $hfEnvPath"
        Write-DeployLog "ERROR" "Create it with: .secrets/deploy/managed/huggingface.env"
        exit 1
    }
    Write-DeployLog "DETAIL" "HF secrets: $hfEnvPath"
    
    # Check git ignore
    try {
        git -C $projectRoot check-ignore -q -- ($hfEnvPath.Substring($projectRoot.Length).TrimStart("\", "/")) 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-DeployLog "WARN" "HF secrets file is NOT git-ignored. Ensure .secrets/ is in .gitignore."
        } else {
            Write-DeployLog "DETAIL" "HF secrets file is properly git-ignored."
        }
        $global:LASTEXITCODE = 0
    } catch {
        Write-DeployLog "DETAIL" "Git ignore check skipped."
    }
    
    # Build Python command arguments
    $pyArgs = @($hfDeployScript)
    
    if ($WipeHf) {
        Write-DeployLog "WARN" "WIPE MODE: ALL code, variables, and secrets will be deleted!"
        $pyArgs += "--wipe-full"
    } elseif ($WipeOnlyHf) {
        Write-DeployLog "WARN" "WIPE ONLY MODE: ALL remote files, variables, and secrets will be deleted!"
        $pyArgs += "--wipe-only"
    } elseif ($WipeCodeOnlyHf) {
        Write-DeployLog "WARN" "WIPE CODE ONLY MODE: ALL remote files will be deleted!"
        $pyArgs += "--wipe-code-only"
    } elseif ($WipeEnvOnlyHf) {
        Write-DeployLog "WARN" "WIPE ENV ONLY MODE: ALL remote variables and secrets will be deleted!"
        $pyArgs += "--wipe-env-only"
    } elseif ($SyncEnv) {
        $pyArgs += "--sync-env"
        if ($DeleteOrphans) {
            $pyArgs += "--delete-orphans"
        }
    } else {
        $pyArgs += "--sync-both"
        if ($DeleteOrphans) {
            $pyArgs += "--delete-orphans"
        }
    }
    
    $pyArgs += "--timeout"
    $pyArgs += $HfTimeout
    $pyArgs += "--secrets-file"
    $pyArgs += $hfEnvPath
    
    if ($Quiet) {
        $pyArgs += "--quiet"
    }
    
    Write-DeployLog "INFO" "Executing HF deploy script..."
    Write-DeployLog "DETAIL" "Command: $PythonPath $($pyArgs -join ' ')"
    
    if ($WhatIf) {
        Write-DeployLog "INFO" "WHAT-IF: Would run: $PythonPath $($pyArgs -join ' ')"
    } else {
        # Execute Python script with output streaming
        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = $PythonPath
        $processInfo.Arguments = ($pyArgs -join " ")
        $processInfo.WorkingDirectory = $projectRoot
        $processInfo.UseShellExecute = $false
        $processInfo.RedirectStandardOutput = $true
        $processInfo.RedirectStandardError = $true
        
        # Pass HF_TOKEN from env if available
        $hfToken = [System.Environment]::GetEnvironmentVariable("HF_TOKEN")
        if (-not [string]::IsNullOrWhiteSpace($hfToken)) {
            $processInfo.EnvironmentVariables["HF_TOKEN"] = $hfToken
            Write-DeployLog "DETAIL" "HF_TOKEN passed from environment"
        }
        
        $process = [System.Diagnostics.Process]::Start($processInfo)
        
        # Stream stdout and stderr in real-time
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        
        # Wait for completion
        $process.WaitForExit()
        
        $stdout = $stdoutTask.Result
        $stderr = $stderrTask.Result
        
        # Display output with proper color coding
        if ($stdout) {
            foreach ($line in $stdout -split "`r?`n") {
                if ($line -match "ERROR") {
                    Write-DeployLog "ERROR" $line
                } elseif ($line -match "OK" -or $line -match "SUCCESSFUL") {
                    Write-DeployLog "OK" $line
                } elseif ($line -match "WARN") {
                    Write-DeployLog "WARN" $line
                } elseif ($line -match "STEP" -or $line -match "===") {
                    Write-DeployLog "INFO" $line
                } else {
                    Write-DeployLog "DETAIL" $line
                }
            }
        }
        
        if ($stderr) {
            foreach ($line in $stderr -split "`r?`n") {
                if (-not [string]::IsNullOrWhiteSpace($line)) {
                    Write-DeployLog "ERROR" $line
                }
            }
        }
        
        if ($process.ExitCode -ne 0) {
            Write-DeployLog "ERROR" "Backend deployment failed with exit code $($process.ExitCode)"
            Write-DeployLog "ERROR" "Check the output above for the specific error."
            Write-DeployLog "ERROR" "Common issues:"
            Write-DeployLog "ERROR" "  - HF_TOKEN is invalid or expired"
            Write-DeployLog "ERROR" "  - Space is out of build hours"
            Write-DeployLog "ERROR" "  - Dockerfile has a build error"
            Write-DeployLog "ERROR" "  - Missing database credentials"
            Write-DeployLog "ERROR" "  - Space stuck in 'STARTING' for > 5 minutes (silent failure loop)"
            exit 1
        }
        
        Write-DeployLog "OK" "Backend deployment completed successfully"
    }
}

# ── Find PowerShell executable ─────────────────────────────────────────────
$PwshExe = $null
foreach ($candidate in @("pwsh", "pwsh.exe", "powershell", "powershell.exe")) {
    try {
        $testVersion = (& $candidate -Command "Get-Host" 2>$null | Out-String)
        if ($testVersion -match "PowerShell") {
            $PwshExe = $candidate
            Write-DeployLog "DETAIL" "PowerShell found: $PwshExe"
            break
        }
    } catch {
        continue
    }
}
if (-not $PwshExe) {
    Write-DeployLog "ERROR" "PowerShell (pwsh or powershell) not found in PATH."
    Write-DeployLog "ERROR" "Install PowerShell 7+ from: https://docs.microsoft.com/powershell/scripting/install/installing-powershell"
    exit 1
}

# ── Frontend Deployment (Firebase) ──────────────────────────────────────────
if ($Frontend) {
    Write-DeployLog "STEP" "FRONTEND DEPLOYMENT (Firebase Hosting)"
    
    $fbDeployScript = Join-Path $PSScriptRoot "firebase-deploy.ps1"
    if (-not (Test-Path $fbDeployScript)) {
        Write-DeployLog "ERROR" "Firebase deploy script not found: $fbDeployScript"
        exit 1
    }
    
    # Build PowerShell arguments
    $fbArgs = @()
    $fbArgs += "-EnvFile"
    $fbArgs += $FirebaseSecretsFile
    
    if ($WhatIf) {
        $fbArgs += "-WhatIf"
    }
    if ($Quiet) {
        $fbArgs += "-Quiet"
    }
    if ($SkipBuild) {
        $fbArgs += "-SkipBuild"
    }
    
    Write-DeployLog "INFO" "Executing Firebase deploy script..."
    Write-DeployLog "DETAIL" "Command: $fbDeployScript $($fbArgs -join ' ')"
    
    if ($WhatIf) {
        Write-DeployLog "INFO" "WHAT-IF: Would run: $fbDeployScript $($fbArgs -join ' ')"
    } else {
        # Execute with output streaming
        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = $PwshExe
        $processInfo.Arguments = "-ExecutionPolicy Bypass -File `"$fbDeployScript`" $($fbArgs -join ' ')"
        $processInfo.WorkingDirectory = $projectRoot
        $processInfo.UseShellExecute = $false
        $processInfo.RedirectStandardOutput = $true
        $processInfo.RedirectStandardError = $true
        
        $process = [System.Diagnostics.Process]::Start($processInfo)
        
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        
        $process.WaitForExit()
        
        $stdout = $stdoutTask.Result
        $stderr = $stderrTask.Result
        
        if ($stdout) {
            foreach ($line in $stdout -split "`r?`n") {
                if ($line -match "ERROR") {
                    Write-DeployLog "ERROR" $line
                } elseif ($line -match "OK" -or $line -match "SUCCESSFUL") {
                    Write-DeployLog "OK" $line
                } elseif ($line -match "WARN") {
                    Write-DeployLog "WARN" $line
                } else {
                    Write-DeployLog "DETAIL" $line
                }
            }
        }
        
        if ($stderr) {
            foreach ($line in $stderr -split "`r?`n") {
                if (-not [string]::IsNullOrWhiteSpace($line)) {
                    Write-DeployLog "ERROR" $line
                }
            }
        }
        
        if ($process.ExitCode -ne 0) {
            Write-DeployLog "ERROR" "Frontend deployment failed with exit code $($process.ExitCode)"
            Write-DeployLog "ERROR" "Check the output above for the specific error."
            Write-DeployLog "ERROR" "Common issues:"
            Write-DeployLog "ERROR" "  - Firebase CLI not authenticated (run: firebase login)"
            Write-DeployLog "ERROR" "  - Missing required VITE_* env vars"
            Write-DeployLog "ERROR" "  - Build error (check npm output)"
            Write-DeployLog "ERROR" "  - firebase.json misconfigured"
            exit 1
        }
        
        Write-DeployLog "OK" "Frontend deployment completed successfully"
    }
}

# ── Final Summary ───────────────────────────────────────────────────────────
Write-DeployLog "INFO" ""
Write-DeployLog "INFO" "=" * 60
Write-DeployLog "INFO" "DEPLOYMENT SUMMARY"
Write-DeployLog "INFO" "=" * 60

if ($Backend) {
    Write-DeployLog "OK" "Backend (HF): DEPLOYED"
    if ($WipeHf) {
        Write-DeployLog "OK" "  - Full wipe and redeploy performed"
    }
    if ($WipeOnlyHf) {
        Write-DeployLog "OK" "  - Full wipe only performed"
    }
    if ($WipeCodeOnlyHf) {
        Write-DeployLog "OK" "  - Code wipe only performed"
    }
    if ($WipeEnvOnlyHf) {
        Write-DeployLog "OK" "  - Env variables/secrets wipe only performed"
    }
    if ($SyncEnv) {
        Write-DeployLog "OK" "  - Env vars synced only"
    }
}
if ($Frontend) {
    Write-DeployLog "OK" "Frontend (Firebase): DEPLOYED"
}

Write-DeployLog "INFO" ""
Write-DeployLog "INFO" "Next steps:"
Write-DeployLog "INFO" "  - Verify backend: https://m7mdhbkr-merhouse-backend.hf.space/api/v1/health"
Write-DeployLog "INFO" "  - Verify frontend: https://merhouse-354e7.web.app"
Write-DeployLog "INFO" "  - Check HF logs: https://huggingface.co/spaces/M7mdHBkr/merhouse-backend/logs"
Write-DeployLog "INFO" ""
Write-DeployLog "OK" "All done!"
