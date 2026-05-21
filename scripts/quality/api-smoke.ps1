param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$OutputPath = ""
)

& (Join-Path $PSScriptRoot "..\api\run-all.ps1") -BaseUrl $BaseUrl -OutputPath $OutputPath
