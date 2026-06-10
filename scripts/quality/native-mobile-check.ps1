param(
    [string]$ApiBaseUrl = "http://10.0.2.2:8080",
    [switch]$Sync,
    [switch]$Assemble
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "url-guard-lib.ps1")

if ($Assemble) {
    $Sync = $true
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$frontendRoot = Join-Path $repoRoot "frontend"
$androidRoot = Join-Path $frontendRoot "android"
$manifestPath = Join-Path $androidRoot "app\src\main\AndroidManifest.xml"
$capacitorConfigPath = Join-Path $frontendRoot "capacitor.config.ts"
$packagePath = Join-Path $frontendRoot "package.json"
$appIconPath = Join-Path $frontendRoot "public\app-icon.svg"
$adaptiveIconPath = Join-Path $androidRoot "app\src\main\res\mipmap-anydpi-v26\ic_launcher.xml"
$adaptiveRoundIconPath = Join-Path $androidRoot "app\src\main\res\mipmap-anydpi-v26\ic_launcher_round.xml"
$launcherBackgroundColorPath = Join-Path $androidRoot "app\src\main\res\values\ic_launcher_background.xml"

function Assert-File {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Expected file was not found: $Path"
    }
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Script
    )

    Write-Host ""
    Write-Host $Name
    & $Script
}

function Assert-ApiBaseUrl {
    param([string]$Value)

    if ($null -ne $Value -and $Value.EndsWith("/")) {
        throw "ApiBaseUrl must not end with a slash because frontend API paths already start with /api."
    }

    return Assert-AbsoluteHttpUrl -Name "ApiBaseUrl" -Value $Value
}

function Get-JavaMajorVersion {
    param([string]$JavaCommand = "java")

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $JavaCommand
    $startInfo.Arguments = "-version"
    $startInfo.RedirectStandardError = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.UseShellExecute = $false

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stderr = $process.StandardError.ReadToEnd()
    $stdout = $process.StandardOutput.ReadToEnd()
    $process.WaitForExit()

    $javaOutput = "$stderr`n$stdout".Trim()
    if (-not $javaOutput -or $javaOutput -notmatch 'version "([^"]+)"') {
        throw "Could not determine Java version from: $javaOutput"
    }

    $version = $Matches[1]
    if ($version.StartsWith("1.")) {
        return [int]($version.Split(".")[1])
    }

    return [int]($version.Split(".")[0])
}

function Test-CompatibleJavaCommand {
    param([string]$JavaCommand)

    try {
        $major = Get-JavaMajorVersion -JavaCommand $JavaCommand
        return ($major -ge 17 -and $major -le 21)
    } catch {
        return $false
    }
}

function Use-CompatibleJava {
    $java = Get-Command java -ErrorAction SilentlyContinue
    if ($java) {
        if (Test-CompatibleJavaCommand -JavaCommand $java.Source) {
            return
        }
    }

    if ($env:JAVA_HOME) {
        $javaHomeCommand = Join-Path $env:JAVA_HOME "bin\java"
        if ($IsWindows -or $env:OS -eq "Windows_NT") {
            $javaHomeCommand = Join-Path $env:JAVA_HOME "bin\java.exe"
        }
        if (-not (Test-Path $javaHomeCommand)) {
            $javaHomeCommand = Join-Path $env:JAVA_HOME "bin/java"
        }
        if ((Test-Path $javaHomeCommand) -and (Test-CompatibleJavaCommand -JavaCommand $javaHomeCommand)) {
            $env:PATH = "$(Split-Path $javaHomeCommand -Parent)$([System.IO.Path]::PathSeparator)$env:PATH"
            return
        }
    }

    $jdkCandidates = @(
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Java",
        "$env:USERPROFILE\.jdks",
        "$HOME/.jdks",
        "/usr/lib/jvm",
        "/Library/Java/JavaVirtualMachines"
    ) | Where-Object { $_ -and (Test-Path $_) }

    foreach ($root in $jdkCandidates) {
        $candidate = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match "(jdk|temurin|java).*(17|21)" } |
            Sort-Object Name -Descending |
            Select-Object -First 1
        if ($candidate) {
            $javaCandidate = Join-Path $candidate.FullName "bin\java"
            if ($IsWindows -or $env:OS -eq "Windows_NT") {
                $javaCandidate = Join-Path $candidate.FullName "bin\java.exe"
            }
            if (-not (Test-Path $javaCandidate)) {
                $javaCandidate = Join-Path $candidate.FullName "Contents/Home/bin/java"
            }
            if ((Test-Path $javaCandidate) -and (Test-CompatibleJavaCommand -JavaCommand $javaCandidate)) {
                $javaHome = Split-Path (Split-Path $javaCandidate -Parent) -Parent
                $env:JAVA_HOME = $javaHome
                $env:PATH = "$(Split-Path $javaCandidate -Parent)$([System.IO.Path]::PathSeparator)$env:PATH"
                return
            }
        }
    }

    if (-not $java) {
        throw "Java was not found on PATH. Install JDK 17 or 21, then rerun this script with -Assemble."
    }

    $major = Get-JavaMajorVersion
    throw "Java $major is not supported by this Android Gradle build. Install JDK 17 or 21, or set JAVA_HOME to a compatible JDK, then rerun this script with -Assemble."
}

function Use-AndroidSdk {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
        $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
        return
    }

    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
        $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
        return
    }

    $sdkCandidates = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk",
        "C:\Android\Sdk",
        "$HOME/Android/Sdk",
        "$HOME/Library/Android/sdk",
        "/opt/android-sdk",
        "/usr/local/lib/android/sdk"
    )

    foreach ($candidate in $sdkCandidates) {
        if ($candidate -and (Test-Path $candidate)) {
            $env:ANDROID_HOME = $candidate
            $env:ANDROID_SDK_ROOT = $candidate
            $env:PATH = "$(Join-Path $candidate "platform-tools")$([System.IO.Path]::PathSeparator)$(Join-Path $candidate "cmdline-tools\latest\bin")$([System.IO.Path]::PathSeparator)$(Join-Path $candidate "emulator")$([System.IO.Path]::PathSeparator)$env:PATH"
            return
        }
    }

    throw "Android SDK was not found. Install Android Studio or set ANDROID_HOME/ANDROID_SDK_ROOT, then rerun this script with -Assemble."
}

$normalizedApiBaseUrl = Assert-ApiBaseUrl -Value $ApiBaseUrl
Write-Host "Native Android API base URL: $normalizedApiBaseUrl"

Invoke-Step "Checking native mobile wrapper files..." {
    Assert-File $packagePath
    Assert-File $appIconPath
    Assert-File $capacitorConfigPath
    Assert-File $manifestPath
    Assert-File (Join-Path $androidRoot "gradlew")
    Assert-File (Join-Path $androidRoot "gradlew.bat")
    Assert-File (Join-Path $androidRoot "app\build.gradle")
}

Invoke-Step "Checking native launcher icon identity..." {
    Assert-File $adaptiveIconPath
    Assert-File $adaptiveRoundIconPath
    Assert-File $launcherBackgroundColorPath

    $appIcon = Get-Content $appIconPath -Raw
    foreach ($expected in @("#10261f", "#d9f99d")) {
        if (-not $appIcon.Contains($expected)) {
            throw "Shared mobile shell icon is missing MerHouse identity color: $expected"
        }
    }

    foreach ($path in @($adaptiveIconPath, $adaptiveRoundIconPath)) {
        $adaptiveIcon = Get-Content $path -Raw
        if (-not $adaptiveIcon.Contains('@mipmap/ic_launcher_foreground')) {
            throw "Android adaptive icon must use the MerHouse launcher foreground: $path"
        }
        if (-not $adaptiveIcon.Contains('@color/ic_launcher_background')) {
            throw "Android adaptive icon must use the MerHouse launcher background color: $path"
        }
    }

    $background = Get-Content $launcherBackgroundColorPath -Raw
    if (-not $background.Contains("#10261F")) {
        throw "Android launcher background color must match the shared mobile shell icon background."
    }

    foreach ($density in @("mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi")) {
        $foregroundPng = Join-Path $androidRoot "app\src\main\res\$density\ic_launcher_foreground.png"
        Assert-File $foregroundPng
    }

    $templateIconMatches = Get-ChildItem (Join-Path $androidRoot "app\src\main\res") -Recurse -File |
        Select-String -Pattern "#26A69A|#33FFFFFF|drawable/ic_launcher_foreground|drawable\\ic_launcher_foreground|ic_launcher_background\.xml" -List
    if ($templateIconMatches) {
        $paths = $templateIconMatches | ForEach-Object { $_.Path }
        throw "Stale Android template launcher asset remains: $($paths -join ', ')"
    }
}

Invoke-Step "Checking Capacitor dependencies and scripts..." {
    $package = Get-Content $packagePath -Raw | ConvertFrom-Json
    foreach ($dependency in @("@capacitor/core", "@capacitor/android")) {
        if (-not $package.dependencies.$dependency) {
            throw "Missing frontend dependency: $dependency"
        }
    }
    if (-not $package.devDependencies."@capacitor/cli") {
        throw "Missing frontend dev dependency: @capacitor/cli"
    }
    foreach ($scriptName in @("mobile:sync", "mobile:open")) {
        if (-not $package.scripts.$scriptName) {
            throw "Missing frontend script: $scriptName"
        }
    }
}

Invoke-Step "Checking Capacitor configuration..." {
    $config = Get-Content $capacitorConfigPath -Raw
    foreach ($expected in @(
        "appId: 'com.merhouse.operations'",
        "appName: 'MerHouse'",
        "webDir: 'dist'",
        "androidScheme: 'http'",
        "cleartext: true"
    )) {
        if (-not $config.Contains($expected)) {
            throw "Capacitor config is missing: $expected"
        }
    }
}

Invoke-Step "Checking Android manifest local-runtime boundary..." {
    $manifest = Get-Content $manifestPath -Raw
    foreach ($expected in @(
        'android:allowBackup="false"',
        'android:usesCleartextTraffic="${usesCleartextTraffic}"',
        'android.permission.INTERNET',
        'android.intent.category.LAUNCHER'
    )) {
        if (-not $manifest.Contains($expected)) {
            throw "Android manifest is missing: $expected"
        }
    }
}

Invoke-Step "Checking Android wrapper source is project-specific..." {
    $badTemplateMatches = Get-ChildItem $androidRoot -Recurse -File |
        Where-Object {
            $_.FullName -notmatch "\\.gradle\\" -and
            $_.FullName -notmatch "\\build\\"
        } |
        Select-String -Pattern "com\.getcapacitor\.myapp|ExampleUnitTest|ExampleInstrumentedTest" -List

    if ($badTemplateMatches) {
        $paths = $badTemplateMatches | ForEach-Object { $_.Path }
        throw "Capacitor template sample files or package names remain in the Android wrapper: $($paths -join ', ')"
    }
}

Invoke-Step "Checking Android wrapper stays shell-only..." {
    $duplicatedProductMatches = Get-ChildItem $androidRoot -Recurse -File |
        Where-Object {
            $_.FullName -notmatch "\\.gradle\\" -and
            $_.FullName -notmatch "\\build\\" -and
            $_.FullName -notmatch "\\app\\src\\main\\assets\\" -and
            $_.Extension -in @(".java", ".kt", ".xml", ".gradle", ".properties", ".json", ".ts", ".tsx", ".js", ".jsx")
        } |
        Select-String -Pattern "/api/v1|createBrowserRouter|react-router-dom|VITE_API_BASE_URL|fetch\(" -List

    if ($duplicatedProductMatches) {
        $paths = $duplicatedProductMatches | ForEach-Object { $_.Path }
        throw "Android wrapper must stay shell-only; product routes and API client code belong in the shared frontend: $($paths -join ', ')"
    }
}

if ($Sync) {
    Invoke-Step "Building web assets for native shell..." {
        Push-Location $frontendRoot
        try {
            $previousApiBaseUrl = $env:VITE_API_BASE_URL
            $env:VITE_API_BASE_URL = $normalizedApiBaseUrl
            npm run build
            if ($LASTEXITCODE -ne 0) {
                throw "Frontend build failed."
            }
        } finally {
            if ($null -eq $previousApiBaseUrl) {
                Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
            } else {
                $env:VITE_API_BASE_URL = $previousApiBaseUrl
            }
            Pop-Location
        }
    }

    Invoke-Step "Checking native frontend API base..." {
        $assetRoot = Join-Path $frontendRoot "dist\assets"
        Assert-File (Join-Path $frontendRoot "dist\index.html")
        if (-not (Test-Path $assetRoot)) {
            throw "Native frontend build did not produce asset directory: $assetRoot"
        }

        $compiledApiBase = Get-ChildItem $assetRoot -Recurse -File -Include "*.js" |
            Select-String -SimpleMatch $normalizedApiBaseUrl -List
        if (-not $compiledApiBase) {
            throw "Native frontend build did not compile VITE_API_BASE_URL=$normalizedApiBaseUrl into the JavaScript assets."
        }
        Write-Host "Native frontend API base compiled into: $($compiledApiBase.Path)"
    }

    Invoke-Step "Syncing web assets into Android wrapper..." {
        Push-Location $frontendRoot
        try {
            npm exec cap sync android
            if ($LASTEXITCODE -ne 0) {
                throw "Capacitor Android sync failed."
            }
        } finally {
            Pop-Location
        }
    }
}

if (-not $Assemble) {
    Write-Host ""
    if ($Sync) {
        Write-Host "Native Android API base URL: $normalizedApiBaseUrl"
        Write-Host "Native mobile sync check passed. Run with -Assemble to build the debug APK when Android SDK is installed."
    } else {
        Write-Host "Native Android API base URL: $normalizedApiBaseUrl"
        Write-Host "Native mobile structural check passed. Run with -Sync to build and sync web assets, or -Assemble to build the debug APK."
    }
    exit 0
}

Invoke-Step "Checking Android SDK toolchain..." {
    Use-AndroidSdk
    Use-CompatibleJava
}

Invoke-Step "Assembling Android debug APK..." {
    Push-Location $androidRoot
    try {
        if ($IsWindows -or $env:OS -eq "Windows_NT") {
            & ".\gradlew.bat" assembleDebug
        } else {
            chmod +x "./gradlew"
            & "./gradlew" assembleDebug
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Android debug APK build failed."
        }
    } finally {
        Pop-Location
    }
}

$apkPath = Join-Path $androidRoot "app\build\outputs\apk\debug\app-debug.apk"
Assert-File $apkPath
$apkFile = Get-Item $apkPath
$apkSha256 = (Get-FileHash -Algorithm SHA256 -Path $apkPath).Hash.ToLowerInvariant()
Write-Host ""
Write-Host "Native Android debug APK built: $apkPath"
Write-Host "Native Android API base URL: $normalizedApiBaseUrl"
Write-Host "Native Android debug APK SHA-256: $apkSha256"
Write-Host "Native Android debug APK bytes: $($apkFile.Length)"
