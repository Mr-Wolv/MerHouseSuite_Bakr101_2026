param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$ApkPath = ".\frontend\android\app\build\outputs\apk\release\app-release.apk",
    [string]$OutputPath = ".\reports\native-android-release-login-proof.json",
    [string]$ScreenshotDirectory = ".\reports\native-android-release-login-proof",
    [Parameter(Mandatory = $true)] [string]$Email,
    [Parameter(Mandatory = $true)] [string]$Password,
    [string]$ExpectedSignedInText = "Admin Overview",
    [switch]$RequireUiAutomatorText
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")

function Resolve-ProjectPath {
    param([Parameter(Mandatory = $true)] [string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $projectRoot $Path))
}

. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")
. (Join-Path $PSScriptRoot "..\lib\tour-report-lib.ps1")

$normalizedApiUrl = Assert-AbsoluteHttpUrl -Name "ApiUrl" -Value $ApiUrl
$resolvedApkPath = Resolve-ProjectPath -Path $ApkPath
$resolvedOutputPath = Resolve-ProjectPath -Path $OutputPath
$resolvedScreenshotDirectory = Resolve-ProjectPath -Path $ScreenshotDirectory

if (-not (Test-Path -LiteralPath $resolvedApkPath)) {
    throw "APK was not found at $resolvedApkPath."
}
if ([string]::IsNullOrWhiteSpace($Email) -or $Email -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
    throw "Email must be a non-blank email address."
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    throw "Password must be non-blank."
}

function Find-AndroidSdk {
    $sdkCandidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
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
            return (Resolve-Path $candidate).Path
        }
    }

    throw "Android SDK was not found. Install Android Studio or set ANDROID_HOME/ANDROID_SDK_ROOT."
}

function Find-Adb {
    param([string]$AndroidSdk)

    $adbName = if ($IsWindows -or $env:OS -eq "Windows_NT") { "adb.exe" } else { "adb" }
    $candidates = @(
        (Join-Path $AndroidSdk "platform-tools\$adbName"),
        (Get-Command $adbName -ErrorAction SilentlyContinue).Source
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    throw "$adbName was not found. Install Android SDK platform-tools or add adb to PATH."
}

$androidSdk = Find-AndroidSdk
$adb = Find-Adb -AndroidSdk $androidSdk
$deviceLines = @(& $adb devices | Where-Object { $_ -match "\tdevice$" })
if ($deviceLines.Count -lt 1) {
    throw "No running Android device or emulator is connected. Start an emulator or connect a device with USB debugging."
}
$deviceSerials = @($deviceLines | ForEach-Object { ($_ -split "\s+")[0] })

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Arguments)

    & $adb @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "adb command failed: adb $($Arguments -join ' ')"
    }
}

function Get-DeviceSize {
    $sizeText = (@(& $adb shell wm size) -join "`n")
    if ($sizeText -notmatch "Physical size:\s*(\d+)x(\d+)") {
        throw "Could not read Android device size from adb wm size."
    }
    return [pscustomobject]@{
        width = [int]$Matches[1]
        height = [int]$Matches[2]
    }
}

function Capture-Screenshot {
    param([string]$Name)

    $localPath = Join-Path $resolvedScreenshotDirectory "$Name.png"
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        $escapedAdb = $adb.Replace('"', '\"')
        $escapedPath = $localPath.Replace('"', '\"')
        cmd /c "`"$escapedAdb`" exec-out screencap -p > `"$escapedPath`""
        if ($LASTEXITCODE -ne 0) {
            throw "adb exec-out screencap failed for $localPath."
        }
    } else {
        & $adb exec-out screencap -p > $localPath
        if ($LASTEXITCODE -ne 0) {
            throw "adb exec-out screencap failed for $localPath."
        }
    }
    if (-not (Test-PngScreenshotFile -Path $localPath)) {
        throw "Native screenshot is not valid PNG evidence with positive dimensions: $localPath"
    }
    return $localPath
}

function Read-WindowDump {
    param([string]$Name)

    $devicePath = "/sdcard/merhouse-$Name.xml"
    $localPath = Join-Path $resolvedScreenshotDirectory "$Name.xml"
    Invoke-Adb shell uiautomator dump $devicePath | Out-Null
    Invoke-Adb pull $devicePath $localPath | Out-Null
    Invoke-Adb shell rm $devicePath | Out-Null
    return [xml](Get-Content -LiteralPath $localPath -Raw)
}

function Get-NodeCenter {
    param(
        [Parameter(Mandatory = $true)] [xml]$WindowDump,
        [Parameter(Mandatory = $true)] [string]$ClassName,
        [string]$Text = "",
        [string]$ResourceId = ""
    )

    $nodes = @($WindowDump.SelectNodes("//node[@class='$ClassName']"))
    foreach ($node in $nodes) {
        $matchesText = [string]::IsNullOrWhiteSpace($Text) -or $node.text -eq $Text
        $matchesResource = [string]::IsNullOrWhiteSpace($ResourceId) -or $node.'resource-id' -eq $ResourceId
        if ($matchesText -and $matchesResource) {
            if ($node.bounds -notmatch '^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$') {
                throw "Could not parse Android node bounds for $ClassName $Text $ResourceId."
            }
            return [pscustomobject]@{
                x = [Math]::Round(([int]$Matches[1] + [int]$Matches[3]) / 2)
                y = [Math]::Round(([int]$Matches[2] + [int]$Matches[4]) / 2)
                bounds = $node.bounds
            }
        }
    }
    throw "Could not find Android UI node class=$ClassName text=$Text resource-id=$ResourceId."
}

function Wait-LoginControls {
    $deadline = (Get-Date).AddSeconds(30)
    $lastError = ""
    while ((Get-Date) -lt $deadline) {
        $dump = Read-WindowDump -Name "01-login-launch-window"
        try {
            $email = Get-NodeCenter -WindowDump $dump -ClassName "android.widget.EditText" -ResourceId "login-email"
            $password = Get-NodeCenter -WindowDump $dump -ClassName "android.widget.EditText" -ResourceId "login-password"
            $button = Get-NodeCenter -WindowDump $dump -ClassName "android.widget.Button" -Text "Sign in"
            return [pscustomobject]@{
                email = $email
                password = $password
                signIn = $button
            }
        } catch {
            $lastError = $_.Exception.Message
            Start-Sleep -Seconds 2
        }
    }
    throw "Timed out waiting for Android login controls. Last UI lookup error: $lastError"
}

function Send-AdbText {
    param([Parameter(Mandatory = $true)] [string]$Text)

    foreach ($char in $Text.ToCharArray()) {
        switch ($char) {
            "@" {
                Invoke-Adb shell input keyevent KEYCODE_AT | Out-Null
            }
            " " {
                Invoke-Adb shell input text "%s" | Out-Null
            }
            default {
                $literal = [string]$char
                if ($literal -match "^[A-Za-z0-9._-]$") {
                    Invoke-Adb shell input text $literal | Out-Null
                } else {
                    throw "Text contains a character that this release proof cannot inject safely through adb input: '$literal'"
                }
            }
        }
        Start-Sleep -Milliseconds 35
    }
}

function Invoke-LoginApi {
    param([string]$LoginEmail, [string]$LoginPassword)

    $body = @{ email = $LoginEmail; password = $LoginPassword } | ConvertTo-Json
    return Invoke-RestMethod -Method Post -Uri "$normalizedApiUrl/api/v1/auth/login" -ContentType "application/json" -Body $body
}

New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
New-Item -ItemType Directory -Force -Path $resolvedScreenshotDirectory | Out-Null
Get-ChildItem -Path $resolvedScreenshotDirectory -Filter "*.png" -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host "Checking backend login for supplied APK proof account..."
Invoke-LoginApi -LoginEmail $Email -LoginPassword $Password | Out-Null

Write-Host "Installing release APK..."
Invoke-Adb install -r $resolvedApkPath | Out-Null
Invoke-Adb shell pm clear com.merhouse.operations | Out-Null
Invoke-Adb shell am start -n com.merhouse.operations/.MainActivity | Out-Null
Start-Sleep -Seconds 6

$deviceSize = Get-DeviceSize
$tapX = [Math]::Round($deviceSize.width * 0.5)
$emailY = [Math]::Round($deviceSize.height * 0.60)
$signInY = [Math]::Round($deviceSize.height * 0.79)

$launchScreenshot = Capture-Screenshot -Name "01-login-launch"
$loginControls = Wait-LoginControls
$emailCenter = $loginControls.email
$passwordCenter = $loginControls.password
$signInCenter = $loginControls.signIn

Write-Host "Entering credentials through adb input..."
Invoke-Adb shell input tap $emailCenter.x $emailCenter.y | Out-Null
Start-Sleep -Milliseconds 500
Send-AdbText -Text $Email
Invoke-Adb shell input tap $passwordCenter.x $passwordCenter.y | Out-Null
Start-Sleep -Milliseconds 500
Send-AdbText -Text $Password
Invoke-Adb shell input keyevent KEYCODE_BACK | Out-Null
Start-Sleep -Milliseconds 700

$enteredScreenshot = Capture-Screenshot -Name "02-login-entered"
Invoke-Adb shell input tap $signInCenter.x $signInCenter.y | Out-Null
Start-Sleep -Seconds 20
$signedInScreenshot = Capture-Screenshot -Name "03-after-sign-in"

$afterSignInDump = Read-WindowDump -Name "03-after-sign-in-window"
$windowLocalPath = Join-Path $resolvedScreenshotDirectory "03-after-sign-in-window.xml"
$windowText = $afterSignInDump.OuterXml
if ($windowText -match 'text="Sign in"' -and $windowText -match 'resource-id="login-email"') {
    throw "Signed release APK login proof remained on the login form after tapping the Sign in button. Inspect screenshot: $signedInScreenshot"
}

$checkedAt = (Get-Date).ToUniversalTime().ToString("o")
$report = [pscustomobject]@{
    schema = "merhouse.native-android-release-login-proof.report.v1"
    checkedAt = $checkedAt
    apiUrl = $normalizedApiUrl
    apkPath = $resolvedApkPath
    apkSha256 = (Get-FileHash -Algorithm SHA256 -Path $resolvedApkPath).Hash.ToLowerInvariant()
    deviceSerials = $deviceSerials
    deviceSize = $deviceSize
    launchScreenshot = $launchScreenshot
    enteredScreenshot = $enteredScreenshot
    signedInScreenshot = $signedInScreenshot
    expectedSignedInText = $ExpectedSignedInText
    uiAutomatorTextContainsExpected = $windowText.Contains($ExpectedSignedInText)
    visualEvidenceRequiresReview = -not $windowText.Contains($ExpectedSignedInText)
    windowDump = $windowLocalPath
}

$report | ConvertTo-Json -Depth 8 | Set-Content -Path $resolvedOutputPath -Encoding utf8
Write-Host "Native Android release login proof report: $resolvedOutputPath"

if ($RequireUiAutomatorText -and -not $report.uiAutomatorTextContainsExpected) {
    throw "Signed release APK login proof did not find expected text '$ExpectedSignedInText' in the Android UI dump. Inspect screenshot: $signedInScreenshot"
}
if (-not $report.uiAutomatorTextContainsExpected) {
    Write-Warning "Signed release WebView text was not visible to UIAutomator. Treat the dashboard screenshot as the release APK evidence: $signedInScreenshot"
}

Write-Host "Native Android release login proof passed."
