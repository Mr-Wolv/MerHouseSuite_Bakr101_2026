param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$ApkPath = ".\frontend\android\app\build\outputs\apk\debug\app-debug.apk",
    [string]$OutputPath = ".\reports\native-android-tour.json",
    [string]$ScreenshotDirectory = ".\reports\native-android-tour",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [string]$PlatformAdminEmail = "",
    [string]$PlatformAdminPassword = "tour-password",
    [string]$MerchantEmail = "",
    [string]$MerchantPassword = "",
    [string]$WarehouseEmail = "",
    [string]$WarehousePassword = "",
    [string]$SupportAdminEmail = "",
    [string]$SupportAdminPassword = "",
    [string]$AuditorEmail = "",
    [string]$AuditorPassword = ""
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\..\lib\common.ps1")
$projectRoot = Get-MerHouseProjectRoot

function Assert-NonBlankPathParameter {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name must be a non-blank path."
    }
}

Assert-NonBlankPathParameter -Name "ApkPath" -Value $ApkPath
Assert-NonBlankPathParameter -Name "OutputPath" -Value $OutputPath
Assert-NonBlankPathParameter -Name "ScreenshotDirectory" -Value $ScreenshotDirectory

$resolvedApkPath = Resolve-MerHousePath -Path $ApkPath -ProjectRoot $projectRoot
$resolvedOutputPath = Resolve-MerHousePath -Path $OutputPath -ProjectRoot $projectRoot
$resolvedScreenshotDirectory = Resolve-MerHousePath -Path $ScreenshotDirectory -ProjectRoot $projectRoot

. (Join-Path $PSScriptRoot "..\lib\url-guard-lib.ps1")
. (Join-Path $PSScriptRoot "..\lib\tour-report-lib.ps1")

$normalizedApiUrl = Assert-AbsoluteHttpUrl -Name "ApiUrl" -Value $ApiUrl
Write-Host "Native Android tour API URL: $normalizedApiUrl"
Write-Host "Native Android tour APK path: $resolvedApkPath"
Write-Host "Native Android tour report: $resolvedOutputPath"
Write-Host "Native Android tour screenshots: $resolvedScreenshotDirectory"

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
if (-not (Test-Path $resolvedApkPath)) {
    throw "APK was not found at $resolvedApkPath. Run native-mobile-check.ps1 -Assemble first."
}

$deviceLines = @(& $adb devices | Where-Object { $_ -match "\tdevice$" })
if ($deviceLines.Count -lt 1) {
    throw "No running Android device or emulator is connected. Start an Android emulator or connect a device with USB debugging, then rerun native-android-tour.ps1."
}
$deviceSerials = @($deviceLines | ForEach-Object { ($_ -split "\s+")[0] })
$deviceSerial = $deviceSerials[0]
Write-Host "Native Android tour device: $deviceSerial"
$apkFile = Get-Item $resolvedApkPath
$apkSha256 = (Get-FileHash -Algorithm SHA256 -Path $resolvedApkPath).Hash.ToLowerInvariant()
$script:nativeOrigin = "http://localhost"

New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
New-Item -ItemType Directory -Force -Path $resolvedScreenshotDirectory | Out-Null
Get-ChildItem -Path $resolvedScreenshotDirectory -Filter "*.png" -ErrorAction SilentlyContinue | Remove-Item -Force

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Arguments)

    & $adb -s $deviceSerial @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "adb command failed: adb -s $deviceSerial $($Arguments -join ' ')"
    }
}

function Get-Token {
    param([string]$Email, [string]$Password)

    $body = @{ email = $Email; password = $Password } | ConvertTo-Json
    $response = Invoke-RestMethod -Method Post -Uri "$normalizedApiUrl/api/v1/auth/login" -ContentType "application/json" -Body $body
    return $response.accessToken
}

function Invoke-ApiJson {
    param(
        [ValidateSet("GET", "POST", "PATCH")] [string]$Method,
        [string]$Path,
        [string]$Token = "",
        [object]$Body = $null
    )

    $headers = @{}
    if ($Token) {
        $headers.Authorization = "Bearer $Token"
    }
    $parameters = @{
        Method = $Method
        Uri = "$normalizedApiUrl$Path"
        Headers = $headers
    }
    if ($null -ne $Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = ($Body | ConvertTo-Json -Depth 12)
    }
    return Invoke-RestMethod @parameters
}

function New-TourUser {
    param(
        [string]$OwnerToken,
        [string]$TenantId,
        [string]$Email,
        [string]$Password,
        [string]$Role
    )

    Invoke-ApiJson -Method "POST" -Path "/api/v1/admin/users" -Token $OwnerToken -Body @{
        tenantId = $TenantId
        email = $Email
        password = $Password
        role = $Role
    } | Out-Null
}

function New-NativeTourFixtures {
    param([string]$OwnerToken)

    $suffix = "native-$((Get-Date).ToUniversalTime().Ticks)"
    $password = "tour-password"
    $platformTenant = Invoke-ApiJson -Method "POST" -Path "/api/v1/tenants" -Token $OwnerToken -Body @{
        name = "Native Platform Tour $suffix"
        type = "MERCHANT"
    }
    $emptyMerchantTenant = Invoke-ApiJson -Method "POST" -Path "/api/v1/tenants" -Token $OwnerToken -Body @{
        name = "Native Empty Merchant $suffix"
        type = "MERCHANT"
    }
    $emptyWarehouseTenant = Invoke-ApiJson -Method "POST" -Path "/api/v1/tenants" -Token $OwnerToken -Body @{
        name = "Native Empty Warehouse $suffix"
        type = "WAREHOUSE_PROVIDER"
    }
    $activeMerchantTenant = Invoke-ApiJson -Method "POST" -Path "/api/v1/tenants" -Token $OwnerToken -Body @{
        name = "Native Active Merchant $suffix"
        type = "MERCHANT"
    }
    $activeWarehouseTenant = Invoke-ApiJson -Method "POST" -Path "/api/v1/tenants" -Token $OwnerToken -Body @{
        name = "Native Active Warehouse $suffix"
        type = "WAREHOUSE_PROVIDER"
    }
    Invoke-ApiJson -Method "POST" -Path "/api/v1/warehouses" -Token $OwnerToken -Body @{
        tenantId = $activeWarehouseTenant.id
        name = "Native Hub $suffix"
        address = "Native Tour District"
        capacity = 500
    } | Out-Null

    $createdAdmin = $false
    $adminEmail = $PlatformAdminEmail
    $adminPassword = $PlatformAdminPassword
    if (-not $adminEmail) {
        $adminEmail = "native.admin.$suffix@merhouse.local"
        New-TourUser -OwnerToken $OwnerToken -TenantId $platformTenant.id -Email $adminEmail -Password $adminPassword -Role "ADMIN"
        $createdAdmin = $true
    }

    $supportEmail = $SupportAdminEmail
    $supportPassword = $SupportAdminPassword
    if (-not $supportEmail) {
        $supportEmail = "native.support.$suffix@merhouse.local"
        $supportPassword = $password
        New-TourUser -OwnerToken $OwnerToken -TenantId $platformTenant.id -Email $supportEmail -Password $supportPassword -Role "SUPPORT_ADMIN"
    }

    $auditorEmail = $AuditorEmail
    $auditorPassword = $AuditorPassword
    if (-not $auditorEmail) {
        $auditorEmail = "native.auditor.$suffix@merhouse.local"
        $auditorPassword = $password
        New-TourUser -OwnerToken $OwnerToken -TenantId $platformTenant.id -Email $auditorEmail -Password $auditorPassword -Role "AUDITOR"
    }

    $activeMerchantEmail = $MerchantEmail
    $activeMerchantPassword = $MerchantPassword
    if (-not $activeMerchantEmail) {
        $activeMerchantEmail = "native.merchant.$suffix@merhouse.local"
        $activeMerchantPassword = $password
        New-TourUser -OwnerToken $OwnerToken -TenantId $activeMerchantTenant.id -Email $activeMerchantEmail -Password $activeMerchantPassword -Role "MERCHANT"
    }

    $activeWarehouseEmail = $WarehouseEmail
    $activeWarehousePassword = $WarehousePassword
    if (-not $activeWarehouseEmail) {
        $activeWarehouseEmail = "native.operator.$suffix@merhouse.local"
        $activeWarehousePassword = $password
        New-TourUser -OwnerToken $OwnerToken -TenantId $activeWarehouseTenant.id -Email $activeWarehouseEmail -Password $activeWarehousePassword -Role "WAREHOUSE_OPERATOR"
    }

    $emptyMerchantEmail = "native.empty.merchant.$suffix@merhouse.local"
    $emptyWarehouseEmail = "native.empty.operator.$suffix@merhouse.local"
    New-TourUser -OwnerToken $OwnerToken -TenantId $emptyMerchantTenant.id -Email $emptyMerchantEmail -Password $password -Role "MERCHANT"
    New-TourUser -OwnerToken $OwnerToken -TenantId $emptyWarehouseTenant.id -Email $emptyWarehouseEmail -Password $password -Role "WAREHOUSE_OPERATOR"

    return [pscustomobject]@{
        suffix = $suffix
        password = $password
        adminEmail = $adminEmail
        adminPassword = $adminPassword
        createdAdmin = $createdAdmin
        supportEmail = $supportEmail
        supportPassword = $supportPassword
        auditorEmail = $auditorEmail
        auditorPassword = $auditorPassword
        activeMerchantEmail = $activeMerchantEmail
        activeMerchantPassword = $activeMerchantPassword
        activeWarehouseEmail = $activeWarehouseEmail
        activeWarehousePassword = $activeWarehousePassword
        emptyMerchantEmail = $emptyMerchantEmail
        emptyWarehouseEmail = $emptyWarehouseEmail
    }
}

function Connect-WebView {
    $appPid = (@(& $adb -s $deviceSerial shell pidof com.merhouse.operations) -join "").Trim()
    if (-not $appPid) {
        throw "MerHouse Android app is not running."
    }
    $previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $PSNativeCommandUseErrorActionPreference = $false
        & $adb -s $deviceSerial forward --remove tcp:9222 2>$null | Out-Null
        $global:LASTEXITCODE = 0
    } finally {
        $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
        $ErrorActionPreference = $previousErrorActionPreference
    }
    & $adb -s $deviceSerial forward tcp:9222 "localabstract:webview_devtools_remote_$appPid" | Out-Null

    $target = $null
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        Start-Sleep -Milliseconds 500
        try {
            $targets = @(Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/list")
            $target = $targets | Where-Object { $_.webSocketDebuggerUrl } | Select-Object -First 1
            if ($target) {
                break
            }
        } catch {
            if ($attempt -eq 20) {
                throw "Could not connect to the native WebView devtools endpoint after installing and launching the APK. Last error: $($_.Exception.Message)"
            }
        }
    }

    if (-not $target) {
        throw "Native WebView devtools endpoint did not expose a debuggable target."
    }

    try {
        $targetUri = [Uri]([string]$target.url)
        if ($targetUri.Scheme -and $targetUri.Host) {
            $script:nativeOrigin = $targetUri.GetLeftPart([System.UriPartial]::Authority)
            Write-Host "Native Android WebView origin: $script:nativeOrigin"
        }
    } catch {
        Write-Host "Native Android WebView origin: $script:nativeOrigin"
    }

    $debuggerUrl = @($target.webSocketDebuggerUrl) | Select-Object -First 1
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$debuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    $script:activeSocket = $socket
    return $socket
}

$script:cdpId = 0
function Send-Cdp {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [string]$Method,
        [hashtable]$Params = @{}
    )

    for ($retry = 0; $retry -le 1; $retry++) {
        if (-not $script:activeSocket -or $script:activeSocket.State -ne [System.Net.WebSockets.WebSocketState]::Open) {
            $Socket = Connect-WebView
        } else {
            $Socket = $script:activeSocket
        }

        $script:cdpId += 1
        $requestId = $script:cdpId
        $payload = @{ id = $requestId; method = $Method; params = $Params } | ConvertTo-Json -Compress -Depth 20
        $bytes = [Text.Encoding]::UTF8.GetBytes($payload)

        try {
            $Socket.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

            $buffer = New-Object byte[] 1048576
            while ($true) {
                $messageBuilder = [Text.StringBuilder]::new()
                do {
                    $result = $Socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
                    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
                        throw "CDP WebSocket closed while waiting for $Method."
                    }
                    [void]$messageBuilder.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
                } until ($result.EndOfMessage)

                $text = $messageBuilder.ToString()
                if (-not $text) {
                    continue
                }
                $message = $text | ConvertFrom-Json
                if ($message.id -eq $requestId) {
                    return $message
                }
            }
        } catch {
            if ($retry -eq 1) {
                throw
            }
            try { $script:activeSocket.Abort() } catch {}
            $script:activeSocket = $null
            Start-Sleep -Milliseconds 500
        }
    }
}

function Invoke-NativeLogin {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [string]$Role
    )

    $credentials = $roleCredentials[$Role]
    if (-not $credentials) {
        throw "No native tour credentials configured for role $Role."
    }

    Send-Cdp $Socket "Runtime.evaluate" @{ expression = "localStorage.removeItem('warehouse-console-token')"; returnByValue = $true } | Out-Null
    Send-Cdp $Socket "Page.navigate" @{ url = "$script:nativeOrigin/login" } | Out-Null
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        Start-Sleep -Milliseconds 500
        $ready = Send-Cdp $Socket "Runtime.evaluate" @{
            expression = "Boolean(document.querySelector('input[type=email], input[name=email]') && document.querySelector('input[type=password], input[name=password]'))"
            returnByValue = $true
        }
        if ($ready.result.result.value) {
            break
        }
        if ($attempt -eq 20) {
            throw "Native Android login form did not become ready for role $Role."
        }
    }

    $fields = Send-Cdp $Socket "Runtime.evaluate" @{
        expression = @"
(() => {
  const email = document.querySelector('input[type=email], input[name=email]');
  const password = document.querySelector('input[type=password], input[name=password]');
  const submit = [...document.querySelectorAll('button')].find((button) => /sign in/i.test(button.textContent || ''));
  const center = (element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  return JSON.stringify({ email: center(email), password: center(password), submit: center(submit) });
})()
"@
        returnByValue = $true
    }
    $points = $fields.result.result.value | ConvertFrom-Json

    $emailJson = $credentials.Email | ConvertTo-Json -Compress
    $passwordJson = $credentials.Password | ConvertTo-Json -Compress
    Send-Cdp $Socket "Runtime.evaluate" @{
        expression = @"
(() => {
  const email = document.querySelector('input[type=email], input[name=email]');
  const password = document.querySelector('input[type=password], input[name=password]');
  const setValue = (element, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor.set.call(element, value);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  setValue(email, $emailJson);
  setValue(password, $passwordJson);
  return JSON.stringify({ email: email.value, passwordLength: password.value.length });
})()
"@
        returnByValue = $true
    } | Out-Null

    Send-Cdp $Socket "Input.dispatchMouseEvent" @{ type = "mousePressed"; x = [double]$points.submit.x; y = [double]$points.submit.y; button = "left"; clickCount = 1 } | Out-Null
    Send-Cdp $Socket "Input.dispatchMouseEvent" @{ type = "mouseReleased"; x = [double]$points.submit.x; y = [double]$points.submit.y; button = "left"; clickCount = 1 } | Out-Null

    for ($attempt = 1; $attempt -le 30; $attempt++) {
        Start-Sleep -Seconds 1
        $state = Send-Cdp $Socket "Runtime.evaluate" @{
            expression = "JSON.stringify({ href: location.href, heading: document.querySelector('h1')?.textContent?.trim() ?? '', text: document.body.innerText.slice(0, 700), tokenLength: localStorage.getItem('warehouse-console-token')?.length || 0 })"
            returnByValue = $true
        }
        $value = $state.result.result.value | ConvertFrom-Json
        $onLogin = $value.href -match "/login" -or $value.heading -eq "Operations Console" -or $value.text -match "Sign in with an enabled"
        if (-not $onLogin -and $value.tokenLength -gt 0) {
            return
        }
        if ($attempt -eq 30) {
            throw "Native Android login did not leave the login screen for role $Role."
        }
    }
}

function Set-NativeHttpOriginToken {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [AllowEmptyString()] [string]$Token
    )

    Send-Cdp $Socket "Page.navigate" @{ url = "$script:nativeOrigin/login" } | Out-Null
    Start-Sleep -Seconds 1
    if ($Token) {
        $tokenJson = $Token | ConvertTo-Json -Compress
        Send-Cdp $Socket "Runtime.evaluate" @{ expression = "localStorage.setItem('warehouse-console-token', $tokenJson)"; returnByValue = $true } | Out-Null
    } else {
        Send-Cdp $Socket "Runtime.evaluate" @{ expression = "localStorage.removeItem('warehouse-console-token')"; returnByValue = $true } | Out-Null
    }
    Send-Cdp $Socket "Page.reload" @{ ignoreCache = $true } | Out-Null
    Start-Sleep -Seconds 2
}

function Capture-Screenshot {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [string]$Name
    )

    $localPath = Join-Path $resolvedScreenshotDirectory "$Name.png"
    $screenshot = Send-Cdp $Socket "Page.captureScreenshot" @{ format = "png"; captureBeyondViewport = $false }
    [System.IO.File]::WriteAllBytes($localPath, [Convert]::FromBase64String($screenshot.result.data))
    if (-not (Test-PngScreenshotFile -Path $localPath)) {
        throw "Native screenshot is not valid PNG evidence with positive dimensions: $localPath"
    }
    return $localPath
}

function Visit-NativeRoute {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [string]$Role,
        [string]$Route,
        [AllowEmptyString()] [string]$ExpectedText,
        [int]$Index
    )

    $value = $null
    $hasExpectedText = $false
    $routeTimer = [System.Diagnostics.Stopwatch]::new()
    for ($navigationAttempt = 1; $navigationAttempt -le 2; $navigationAttempt++) {
        $routeTimer.Restart()
        Send-Cdp $Socket "Page.navigate" @{ url = "$script:nativeOrigin$Route" } | Out-Null
        for ($attempt = 1; $attempt -le 20; $attempt++) {
            Start-Sleep -Seconds 1
            $evaluation = Send-Cdp $Socket "Runtime.evaluate" @{
                expression = @'
JSON.stringify((() => {
  const visible = (element) => {
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    if (element instanceof HTMLInputElement && element.type === 'hidden') return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return element.offsetParent !== null || style.position === 'fixed';
  };
  const controlName = (element) => {
    const id = element.id;
    const labelByFor = id ? [...document.querySelectorAll('label')].find((label) => label.htmlFor === id)?.textContent?.trim() : '';
    const labelledBy = element.getAttribute('aria-labelledby')?.split(/\s+/).map((labelId) => document.getElementById(labelId)?.textContent?.trim() ?? '').filter(Boolean).join(' ');
    const wrappingLabel = element.closest('label')?.textContent?.trim();
    const title = element.getAttribute('title');
    const aria = element.getAttribute('aria-label');
    const placeholder = element.getAttribute('placeholder');
    const text = element.textContent?.trim();
    const name = element.getAttribute('name');
    return [aria, labelledBy, labelByFor, wrappingLabel, text, placeholder, title, name].map((candidate) => candidate?.trim() ?? '').find((candidate) => candidate.length > 0) ?? '';
  };
  const controls = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="checkbox"], [role="switch"], [role="combobox"], [role="tab"]')].filter(visible);
  const formControls = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
  return {
    href: location.href,
    title: document.title,
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    text: document.body.innerText.slice(0, 2200),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    interactionUnitCount: controls.length,
    emptyControlLabels: controls.filter((control) => controlName(control).length === 0).map((control) => `${control.tagName.toLowerCase()}${control.id ? `#${control.id}` : ''}${control.getAttribute('role') ? `[role=${control.getAttribute('role')}]` : ''}`),
    unlabeledFormControls: formControls.filter((control) => {
      const id = control.id;
      const hasHtmlFor = Boolean(id && [...document.querySelectorAll('label')].some((label) => label.htmlFor === id));
      const hasExplicitAria = Boolean(control.getAttribute('aria-label')?.trim() || control.getAttribute('aria-labelledby')?.trim());
      return !hasHtmlFor && !hasExplicitAria;
    }).map((control) => `${control.tagName.toLowerCase()}${control.id ? `#${control.id}` : ''} ${controlName(control) || '(unnamed)'}`),
  };
})())
'@
                returnByValue = $true
            }
            $json = $evaluation.result.result.value
            if (-not $json) {
                continue
            }
            $value = $json | ConvertFrom-Json
            $hasExpectedText = if ($ExpectedText) {
                $value.text -and $value.text.Contains($ExpectedText)
            } else {
                -not [string]::IsNullOrWhiteSpace($value.heading)
            }
            $hasPageLoading = $value.text -match "(?m)^\s*Loading(?:\s+[A-Za-z ]+)?\s*$"
            $hasRestoringSession = $value.text -match "^\s*Restoring session\s*$"
            if ($hasExpectedText -and -not $hasPageLoading -and -not $hasRestoringSession) {
                break
            }
        }
        $routeTimer.Stop()
        $landedOnLogin = $Token -and $value -and $value.href -match "/login/?$"
        if (-not $landedOnLogin -or $navigationAttempt -eq 2) {
            break
        }
    }
    if (-not $value) {
        $value = [pscustomobject]@{
            href = ""
            title = ""
            heading = ""
            text = ""
            overflow = $false
            interactionUnitCount = 0
            emptyControlLabels = @()
            unlabeledFormControls = @()
        }
    }
    $safeRoute = ($Route.Trim("/") -replace "[^A-Za-z0-9]+", "-")
    if (-not $safeRoute) {
        $safeRoute = "root"
    }
    $screenshotTimer = [System.Diagnostics.Stopwatch]::StartNew()
    $screenshot = Capture-Screenshot -Socket $Socket -Name ("{0:D2}-{1}-{2}" -f $Index, $Role.ToLowerInvariant(), $safeRoute)
    $screenshotTimer.Stop()

    [pscustomobject]@{
        role = $Role
        stakeholderState = Get-NativeStakeholderState -Role $Role
        route = $Route
        href = $value.href
        title = $value.title
        routeReadyMs = [Math]::Round($routeTimer.Elapsed.TotalMilliseconds, 0)
        screenshotMs = [Math]::Round($screenshotTimer.Elapsed.TotalMilliseconds, 0)
        expectedText = $ExpectedText
        heading = $value.heading
        textPreview = $value.text
        screenshot = $screenshot
        hasExpectedText = $hasExpectedText
        hasOverflow = [bool]$value.overflow
        interactionUnitCount = [int]$value.interactionUnitCount
        emptyControlLabels = @($value.emptyControlLabels)
        unlabeledFormControls = @($value.unlabeledFormControls)
        hasUnableToSignIn = $value.text -match "Unable to sign in"
        landedOnLogin = [bool]($Token -and $value.href -match "/login/?$")
        hasLoading = $value.text -match "(?m)^\s*Loading(?:\s+[A-Za-z ]+)?\s*$"
        hasRestoringSession = $value.text -match "^\s*Restoring session\s*$"
        hasBlankBody = [string]::IsNullOrWhiteSpace($value.text)
    }
}

function Get-NativeStakeholderState {
    param([string]$Role)

    switch ($Role) {
        "MERCHANT_ACTIVE" { return "active" }
        "MERCHANT_EMPTY" { return "empty" }
        "WAREHOUSE_ACTIVE" { return "active" }
        "WAREHOUSE_EMPTY" { return "empty" }
        default { return $null }
    }
}

function Get-NativeDetailRoutes {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [string[]]$Routes
    )

    $pathsByKind = @{}
    $detailKinds = @(
        "orders",
        "shipments",
        "fulfillment-allocations",
        "inbound-stock-requests",
        "inventory/items",
        "merchant-warehouse/relationships"
    )
    foreach ($route in $Routes) {
        Send-Cdp $Socket "Page.navigate" @{ url = "$script:nativeOrigin$route" } | Out-Null
        for ($attempt = 1; $attempt -le 45; $attempt++) {
            Start-Sleep -Seconds 1
            $ready = Send-Cdp $Socket "Runtime.evaluate" @{
                expression = "(() => { const text = document.body?.innerText ?? ''; return Boolean(document.querySelector('h1')?.textContent?.trim()) && !/(^|\n)\s*Loading(?:\s+[A-Za-z ]+)?\s*(\n|$)/.test(text) && !/(^|\n)\s*Restoring session\s*(\n|$)/.test(text); })()"
                returnByValue = $true
            }
            if ($ready.result.result.value) {
                break
            }
        }
        $evaluation = Send-Cdp $Socket "Runtime.evaluate" @{
            expression = "JSON.stringify([...document.querySelectorAll('a[href]')].map((a) => new URL(a.href).pathname).filter((path) => /^\/(orders|shipments|fulfillment-allocations|inbound-stock-requests|inventory\/items|merchant-warehouse\/relationships)\//.test(path)))"
            returnByValue = $true
        }
        $paths = @($evaluation.result.result.value | ConvertFrom-Json)
        foreach ($path in @($paths | ForEach-Object { $_ })) {
            foreach ($kind in $detailKinds) {
                if ($path.StartsWith("/$kind/") -and -not $pathsByKind.ContainsKey($kind)) {
                    $pathsByKind[$kind] = $path
                }
            }
        }
    }

    return @($pathsByKind.Values)
}

Write-Host "Checking backend at $normalizedApiUrl..."
Invoke-RestMethod -Uri "$normalizedApiUrl/api/v1/health" | Out-Null

Write-Host "Installing APK..."
Invoke-Adb install -r $resolvedApkPath | Out-Null
Invoke-Adb shell pm clear com.merhouse.operations | Out-Null
Invoke-Adb shell am start -n com.merhouse.operations/.MainActivity | Out-Null
Start-Sleep -Seconds 4

$ownerToken = Get-Token -Email $AdminEmail -Password $AdminPassword
$fixtures = New-NativeTourFixtures -OwnerToken $ownerToken
$roleCredentials = @{
    OWNER = @{ Email = $AdminEmail; Password = $AdminPassword }
    ADMIN = @{ Email = $fixtures.adminEmail; Password = $fixtures.adminPassword }
    SUPPORT = @{ Email = $fixtures.supportEmail; Password = $fixtures.supportPassword }
    AUDITOR = @{ Email = $fixtures.auditorEmail; Password = $fixtures.auditorPassword }
    MERCHANT_ACTIVE = @{ Email = $fixtures.activeMerchantEmail; Password = $fixtures.activeMerchantPassword }
    MERCHANT_EMPTY = @{ Email = $fixtures.emptyMerchantEmail; Password = $fixtures.password }
    WAREHOUSE_ACTIVE = @{ Email = $fixtures.activeWarehouseEmail; Password = $fixtures.activeWarehousePassword }
    WAREHOUSE_EMPTY = @{ Email = $fixtures.emptyWarehouseEmail; Password = $fixtures.password }
}

function Get-RoleToken {
    param([string]$Role)

    if ($Role -eq "PUBLIC") {
        return ""
    }

    $credentials = $roleCredentials[$Role]
    if (-not $credentials) {
        throw "No native tour credentials configured for role $Role."
    }

    return Get-Token -Email $credentials.Email -Password $credentials.Password
}

$expectedByRoute = @{
    "/login" = "Operations Console"
    "/forgot-password" = "Password Recovery"
    "/reset-password" = "Set New Password"
    "/sign-up" = "Sign Up"
    "/admin" = "Admin Overview"
    "/admin/tenants" = "Tenants"
    "/admin/users" = "Users"
    "/admin/access-requests" = "Access Requests"
    "/admin/outbox" = "Outbox"
    "/admin/relationships" = "Relationships"
    "/admin/audit" = "Admin Audit"
    "/merchant" = "Merchant Overview"
    "/merchant/inventory" = "Inventory"
    "/merchant/orders" = "Orders"
    "/warehouse" = "Warehouse Console"
    "/service-accountability" = "Service Accountability"
    "/assistant" = "Operational Review Assistant"
    "/notifications" = "Notifications"
    "/account" = "Your MerHouse account"
}

$rolePaths = @{
    PUBLIC = @("/login", "/forgot-password", "/reset-password", "/sign-up")
    OWNER = @("/admin", "/admin/tenants", "/admin/users", "/admin/access-requests", "/admin/outbox", "/admin/relationships", "/admin/audit", "/service-accountability", "/assistant", "/notifications", "/account")
    ADMIN = @("/admin", "/admin/tenants", "/admin/users", "/admin/access-requests", "/admin/outbox", "/admin/relationships", "/admin/audit", "/service-accountability", "/assistant", "/notifications", "/account")
    SUPPORT = @("/admin", "/admin/users", "/admin/access-requests", "/admin/outbox", "/admin/relationships", "/admin/audit", "/service-accountability", "/assistant", "/notifications", "/account")
    AUDITOR = @("/admin", "/admin/outbox", "/admin/relationships", "/admin/audit", "/service-accountability", "/assistant", "/notifications", "/account")
    MERCHANT_ACTIVE = @("/merchant", "/merchant/inventory", "/merchant/orders", "/service-accountability", "/assistant", "/notifications", "/account")
    MERCHANT_EMPTY = @("/merchant", "/merchant/inventory", "/merchant/orders", "/service-accountability", "/assistant", "/notifications", "/account")
    WAREHOUSE_ACTIVE = @("/warehouse", "/service-accountability", "/assistant", "/notifications", "/account")
    WAREHOUSE_EMPTY = @("/warehouse", "/service-accountability", "/assistant", "/notifications", "/account")
}

$platformRelationships = @(Invoke-ApiJson -Method GET -Path "/api/v1/merchant-warehouse/relationships" -Token $ownerToken)
$platformRelationshipId = @($platformRelationships.id) | Select-Object -First 1
if ($platformRelationshipId) {
    $relationshipDetailPath = "/merchant-warehouse/relationships/$platformRelationshipId"
    foreach ($role in @("OWNER", "ADMIN", "SUPPORT", "AUDITOR")) {
        if (-not $rolePaths[$role].Contains($relationshipDetailPath)) {
            $rolePaths[$role] = @($rolePaths[$role]) + $relationshipDetailPath
        }
    }
}

$platformInboundRequests = @(Invoke-ApiJson -Method GET -Path "/api/v1/merchant-warehouse/inbound-stock-requests" -Token $ownerToken)
$platformInboundRequestId = @($platformInboundRequests.id) | Select-Object -First 1
if ($platformInboundRequestId) {
    $inboundDetailPath = "/inbound-stock-requests/$platformInboundRequestId"
    foreach ($role in @("OWNER", "ADMIN", "SUPPORT", "AUDITOR")) {
        if (-not $rolePaths[$role].Contains($inboundDetailPath)) {
            $rolePaths[$role] = @($rolePaths[$role]) + $inboundDetailPath
        }
    }
}

$socket = Connect-WebView
try {
    Send-Cdp $socket "Runtime.enable" | Out-Null
    Send-Cdp $socket "Page.enable" | Out-Null
    foreach ($role in @("OWNER", "ADMIN", "SUPPORT", "AUDITOR", "MERCHANT_ACTIVE", "WAREHOUSE_ACTIVE")) {
        Write-Host ("Discovering native detail routes as {0}" -f $role)
        Invoke-NativeLogin -Socket $socket -Role $role
        $detailRoutes = Get-NativeDetailRoutes -Socket $socket -Routes $rolePaths[$role]
        foreach ($detailRoute in $detailRoutes) {
            if (-not $rolePaths[$role].Contains($detailRoute)) {
                $rolePaths[$role] = @($rolePaths[$role]) + $detailRoute
            }
        }
    }

    $routes = @()
    foreach ($role in @("PUBLIC", "OWNER", "ADMIN", "SUPPORT", "AUDITOR", "MERCHANT_ACTIVE", "MERCHANT_EMPTY", "WAREHOUSE_ACTIVE", "WAREHOUSE_EMPTY")) {
        foreach ($route in $rolePaths[$role]) {
            $routes += @{
                role = $role
                route = $route
                expectedText = if ($expectedByRoute.ContainsKey($route)) { $expectedByRoute[$route] } else { "" }
            }
        }
    }

    $records = @()
    $currentRole = ""
    for ($i = 0; $i -lt $routes.Count; $i++) {
        $entry = $routes[$i]
        if ($entry.role -eq "PUBLIC") {
            if ($currentRole -ne "PUBLIC") {
                Set-NativeHttpOriginToken -Socket $socket -Token ""
                $currentRole = "PUBLIC"
            }
        } elseif ($currentRole -ne $entry.role) {
            Invoke-NativeLogin -Socket $socket -Role $entry.role
            $currentRole = $entry.role
        }
        Write-Host ("Touring {0} {1}" -f $entry.role, $entry.route)
        $record = Visit-NativeRoute -Socket $socket -Role $entry.role -Route $entry.route -ExpectedText $entry.expectedText -Index ($i + 1)
        if ($entry.role -ne "PUBLIC" -and ($record.landedOnLogin -or $record.heading -eq "Operations Console" -or $record.textPreview -match "Sign in with an enabled local MerHouse account")) {
            throw "Native Android tour reached the login screen for authenticated route $($entry.role) $($entry.route). Screenshot: $($record.screenshot)"
        }
        $records += $record
    }
} finally {
    if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        try {
            $socket.CloseOutputAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
        } catch {
            $socket.Abort()
        }
    }
}

$badRecords = @($records | Where-Object {
    -not $_.hasExpectedText -or
    $_.hasUnableToSignIn -or
    $_.landedOnLogin -or
    $_.hasLoading -or
    $_.hasRestoringSession -or
    $_.hasBlankBody -or
    $_.hasOverflow -or
    @($_.emptyControlLabels).Count -gt 0 -or
    @($_.unlabeledFormControls).Count -gt 0
})
$checkedAt = (Get-Date).ToUniversalTime().ToString("o")
$report = [pscustomobject]@{
    schema = "merhouse.native-android-tour.report.v1"
    generatedAt = $checkedAt
    checkedAt = $checkedAt
    apiUrl = $normalizedApiUrl
    apkPath = $resolvedApkPath
    apkSha256 = $apkSha256
    apkBytes = $apkFile.Length
    deviceSerials = $deviceSerials
    checkedRoutes = @($records).Count
    fixture = $fixtures
    rolePaths = $rolePaths
    records = $records
    badRecords = $badRecords
}

$report | ConvertTo-Json -Depth 8 | Set-Content -Path $resolvedOutputPath -Encoding utf8
Write-Host "Native Android tour report: $resolvedOutputPath"

if ($badRecords.Count -gt 0) {
    throw "Native Android tour found $($badRecords.Count) bad route record(s)."
}

Write-Host "Native Android tour passed."
