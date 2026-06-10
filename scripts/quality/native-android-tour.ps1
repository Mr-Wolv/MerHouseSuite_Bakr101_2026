param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$ApkPath = ".\frontend\android\app\build\outputs\apk\debug\app-debug.apk",
    [string]$OutputPath = ".\reports\native-android-tour.json",
    [string]$ScreenshotDirectory = ".\reports\native-android-tour",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [string]$PlatformAdminEmail = "",
    [string]$PlatformAdminPassword = "tour-password",
    [string]$MerchantEmail = "review.merchant@merhouse.local",
    [string]$MerchantPassword = "review-password",
    [string]$WarehouseEmail = "review.operator@merhouse.local",
    [string]$WarehousePassword = "review-password",
    [string]$SupportAdminEmail = "review.support@merhouse.local",
    [string]$SupportAdminPassword = "review-password",
    [string]$AuditorEmail = "review.auditor@merhouse.local",
    [string]$AuditorPassword = "review-password"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

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

$resolvedApkPath = if ([System.IO.Path]::IsPathRooted($ApkPath)) { [System.IO.Path]::GetFullPath($ApkPath) } else { [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ApkPath)) }
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) { [System.IO.Path]::GetFullPath($OutputPath) } else { [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath)) }
$resolvedScreenshotDirectory = if ([System.IO.Path]::IsPathRooted($ScreenshotDirectory)) { [System.IO.Path]::GetFullPath($ScreenshotDirectory) } else { [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ScreenshotDirectory)) }

. (Join-Path $PSScriptRoot "url-guard-lib.ps1")
. (Join-Path $PSScriptRoot "tour-report-lib.ps1")

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
$apkFile = Get-Item $resolvedApkPath
$apkSha256 = (Get-FileHash -Algorithm SHA256 -Path $resolvedApkPath).Hash.ToLowerInvariant()

New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
New-Item -ItemType Directory -Force -Path $resolvedScreenshotDirectory | Out-Null

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Arguments)

    & $adb @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "adb command failed: adb $($Arguments -join ' ')"
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

    $createdAdmin = $false
    $adminEmail = $PlatformAdminEmail
    $adminPassword = $PlatformAdminPassword
    if (-not $adminEmail) {
        $adminEmail = "native.admin.$suffix@merhouse.local"
        New-TourUser -OwnerToken $OwnerToken -TenantId $platformTenant.id -Email $adminEmail -Password $adminPassword -Role "ADMIN"
        $createdAdmin = $true
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
        emptyMerchantEmail = $emptyMerchantEmail
        emptyWarehouseEmail = $emptyWarehouseEmail
    }
}

function Connect-WebView {
    $appPid = (@(& $adb shell pidof com.merhouse.operations) -join "").Trim()
    if (-not $appPid) {
        throw "MerHouse Android app is not running."
    }
    $previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $PSNativeCommandUseErrorActionPreference = $false
        & $adb forward --remove tcp:9222 2>$null | Out-Null
        $global:LASTEXITCODE = 0
    } finally {
        $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
        $ErrorActionPreference = $previousErrorActionPreference
    }
    & $adb forward tcp:9222 "localabstract:webview_devtools_remote_$appPid" | Out-Null

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

    $debuggerUrl = @($target.webSocketDebuggerUrl) | Select-Object -First 1
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$debuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    return $socket
}

$script:cdpId = 0
function Send-Cdp {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [string]$Method,
        [hashtable]$Params = @{}
    )

    $script:cdpId += 1
    $requestId = $script:cdpId
    $payload = @{ id = $requestId; method = $Method; params = $Params } | ConvertTo-Json -Compress -Depth 20
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $Socket.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

    $buffer = New-Object byte[] 1048576
    while ($true) {
        $result = $Socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
            throw "CDP WebSocket closed while waiting for $Method."
        }
        $text = [Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
        if (-not $text) {
            continue
        }
        $message = $text | ConvertFrom-Json
        if ($message.id -eq $requestId) {
            return $message
        }
    }
}

function Capture-Screenshot {
    param([string]$Name)

    $devicePath = "/sdcard/$Name.png"
    $localPath = Join-Path $resolvedScreenshotDirectory "$Name.png"
    & $adb shell screencap -p $devicePath
    if ($LASTEXITCODE -ne 0) {
        throw "adb screencap failed for $devicePath."
    }
    Start-Sleep -Milliseconds 500
    $exists = (@(& $adb shell "if [ -f '$devicePath' ]; then echo yes; else echo no; fi") -join "").Trim()
    if ($exists -ne "yes") {
        throw "Native screenshot was not created on the emulator at $devicePath."
    }
    & $adb pull $devicePath $localPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "adb pull failed for $devicePath."
    }
    if (-not (Test-PngScreenshotFile -Path $localPath)) {
        throw "Native screenshot is not valid PNG evidence with positive dimensions: $localPath"
    }
    & $adb shell rm $devicePath | Out-Null
    return $localPath
}

function Visit-NativeRoute {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [string]$Role,
        [AllowEmptyString()] [string]$Token,
        [string]$Route,
        [AllowEmptyString()] [string]$ExpectedText,
        [int]$Index
    )

    if ($Token) {
        $tokenJson = $Token | ConvertTo-Json -Compress
        Send-Cdp $Socket "Runtime.evaluate" @{ expression = "localStorage.setItem('warehouse-console-token', $tokenJson)"; returnByValue = $true } | Out-Null
    } else {
        Send-Cdp $Socket "Runtime.evaluate" @{ expression = "localStorage.removeItem('warehouse-console-token')"; returnByValue = $true } | Out-Null
    }
    $value = $null
    $hasExpectedText = $false
    $routeTimer = [System.Diagnostics.Stopwatch]::new()
    for ($navigationAttempt = 1; $navigationAttempt -le 2; $navigationAttempt++) {
        if ($Token) {
            $tokenJson = $Token | ConvertTo-Json -Compress
            Send-Cdp $Socket "Runtime.evaluate" @{ expression = "localStorage.setItem('warehouse-console-token', $tokenJson)"; returnByValue = $true } | Out-Null
        }
        $routeTimer.Restart()
        Send-Cdp $Socket "Page.navigate" @{ url = "http://localhost$Route" } | Out-Null
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
    $screenshot = Capture-Screenshot -Name ("{0:D2}-{1}-{2}" -f $Index, $Role.ToLowerInvariant(), $safeRoute)
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
        [string]$Token,
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
    $tokenJson = $Token | ConvertTo-Json -Compress
    Send-Cdp $Socket "Runtime.evaluate" @{ expression = "localStorage.setItem('warehouse-console-token', $tokenJson)"; returnByValue = $true } | Out-Null

    foreach ($route in $Routes) {
        Send-Cdp $Socket "Page.navigate" @{ url = "http://localhost$route" } | Out-Null
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
    SUPPORT = @{ Email = $SupportAdminEmail; Password = $SupportAdminPassword }
    AUDITOR = @{ Email = $AuditorEmail; Password = $AuditorPassword }
    MERCHANT_ACTIVE = @{ Email = $MerchantEmail; Password = $MerchantPassword }
    MERCHANT_EMPTY = @{ Email = $fixtures.emptyMerchantEmail; Password = $fixtures.password }
    WAREHOUSE_ACTIVE = @{ Email = $WarehouseEmail; Password = $WarehousePassword }
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
    "/request-access" = "Request Access"
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
    PUBLIC = @("/login", "/forgot-password", "/reset-password", "/request-access")
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
        $detailRoutes = Get-NativeDetailRoutes -Socket $socket -Token (Get-RoleToken -Role $role) -Routes $rolePaths[$role]
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
    for ($i = 0; $i -lt $routes.Count; $i++) {
        $entry = $routes[$i]
        Write-Host ("Touring {0} {1}" -f $entry.role, $entry.route)
        $records += Visit-NativeRoute -Socket $socket -Role $entry.role -Token (Get-RoleToken -Role $entry.role) -Route $entry.route -ExpectedText $entry.expectedText -Index ($i + 1)
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
