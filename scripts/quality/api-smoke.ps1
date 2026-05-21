param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$OutputPath = "",
    [string]$AdminEmail = "admin@merhouse.local",
    [string]$AdminPassword = "local-owner-password",
    [switch]$ExpectRecoveryToken
)

& (Join-Path $PSScriptRoot "..\api\run-all.ps1") -BaseUrl $BaseUrl -OutputPath $OutputPath -AdminEmail $AdminEmail -AdminPassword $AdminPassword -ExpectRecoveryToken:$ExpectRecoveryToken
