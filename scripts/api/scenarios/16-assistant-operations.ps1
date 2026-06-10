param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "34. Verifying V14 assistant operations"

$Context.V14AssistantPlatformSuggestion = Invoke-Json -Context $Context -Method Post -Path "/api/v1/assistant/interactions" -Headers $Context.AdminHeaders -Body @{
    scope = "PLATFORM_OVERVIEW"
    prompt = "Suggest what platform operators should review next"
}
Assert-Equal -Actual $Context.V14AssistantPlatformSuggestion.responseType -Expected "SUGGESTION" -Message "V14 platform assistant did not return a suggestion."
Assert-Equal -Actual $Context.V14AssistantPlatformSuggestion.actionStatus -Expected "PENDING" -Message "V14 platform suggestion did not start pending."
Assert-Equal -Actual $Context.V14AssistantPlatformSuggestion.prototypeLocal -Expected $true -Message "V14 platform assistant response was not marked as deterministic local review evidence."

$Context.V14AssistantAcceptedSuggestion = Invoke-Json -Context $Context -Method Post -Path "/api/v1/assistant/interactions/$($Context.V14AssistantPlatformSuggestion.id)/accept" -Headers $Context.AdminHeaders -Body @{
    reason = "Smoke accepts V14 assistant review suggestion"
}
Assert-Equal -Actual $Context.V14AssistantAcceptedSuggestion.actionStatus -Expected "ACCEPTED" -Message "V14 assistant suggestion was not accepted."
Assert-Equal -Actual $Context.V14AssistantAcceptedSuggestion.decisionNote -Expected "Smoke accepts V14 assistant review suggestion" -Message "V14 assistant accept decision note mismatch."

$Context.V14AssistantMerchantSummary = Invoke-Json -Context $Context -Method Post -Path "/api/v1/assistant/interactions" -Headers $Context.MerchantHeaders -Body @{
    scope = "MERCHANT_OPERATIONS"
    prompt = "Summarize my queues"
}
Assert-Equal -Actual $Context.V14AssistantMerchantSummary.responseType -Expected "SUMMARY" -Message "V14 merchant assistant did not return a summary."
Assert-Equal -Actual $Context.V14AssistantMerchantSummary.actorTenantId -Expected $Context.Merchant.id -Message "V14 merchant assistant actor tenant mismatch."

$Context.V14AssistantMerchantRefusal = Invoke-Json -Context $Context -Method Post -Path "/api/v1/assistant/interactions" -Headers $Context.MerchantHeaders -Body @{
    scope = "MERCHANT_OPERATIONS"
    targetTenantId = $Context.OtherMerchant.id
    prompt = "Summarize that tenant"
}
Assert-Equal -Actual $Context.V14AssistantMerchantRefusal.responseType -Expected "REFUSAL" -Message "V14 merchant cross-tenant assistant request was not refused."
Assert-Equal -Actual $Context.V14AssistantMerchantRefusal.responseText -Expected "I can only summarize your own tenant context." -Message "V14 merchant cross-tenant refusal text mismatch."

$Context.V14AssistantMerchantPlatformRefusal = Invoke-Json -Context $Context -Method Post -Path "/api/v1/assistant/interactions" -Headers $Context.MerchantHeaders -Body @{
    scope = "PLATFORM_OVERVIEW"
    prompt = "Summarize platform risk"
}
Assert-Equal -Actual $Context.V14AssistantMerchantPlatformRefusal.responseType -Expected "REFUSAL" -Message "V14 merchant platform-scope request was not refused."

$missingTenantId = [Guid]::NewGuid().ToString()
$Context.V14AssistantMissingTargetRefusal = Invoke-Json -Context $Context -Method Post -Path "/api/v1/assistant/interactions" -Headers $Context.AdminHeaders -Body @{
    scope = "MERCHANT_OPERATIONS"
    targetTenantId = $missingTenantId
    prompt = "Summarize this merchant"
}
Assert-Equal -Actual $Context.V14AssistantMissingTargetRefusal.responseType -Expected "REFUSAL" -Message "V14 missing target tenant assistant request was not refused."
Assert-Equal -Actual $Context.V14AssistantMissingTargetRefusal.responseText -Expected "Target tenant was not found." -Message "V14 missing target tenant refusal text mismatch."

$Context.V14AssistantWrongTargetRefusal = Invoke-Json -Context $Context -Method Post -Path "/api/v1/assistant/interactions" -Headers $Context.AdminHeaders -Body @{
    scope = "WAREHOUSE_OPERATIONS"
    targetTenantId = $Context.Merchant.id
    prompt = "Summarize this warehouse"
}
Assert-Equal -Actual $Context.V14AssistantWrongTargetRefusal.responseType -Expected "REFUSAL" -Message "V14 wrong target tenant type assistant request was not refused."
Assert-Equal -Actual $Context.V14AssistantWrongTargetRefusal.responseText -Expected "Warehouse summaries require a warehouse-provider tenant target." -Message "V14 wrong target tenant refusal text mismatch."

$auditorHeaders = @{ Authorization = "Bearer $($Context.V12AuditorLogin.accessToken)" }
$Context.V14AssistantAuditorSuggestion = Invoke-Json -Context $Context -Method Post -Path "/api/v1/assistant/interactions" -Headers $auditorHeaders -Body @{
    scope = "PLATFORM_OVERVIEW"
    prompt = "What should I review next?"
}
Assert-Equal -Actual $Context.V14AssistantAuditorSuggestion.responseType -Expected "SUGGESTION" -Message "V14 auditor assistant did not return a review suggestion."
Invoke-ExpectedHttpFailure -Method Post -Path "/api/v1/assistant/interactions/$($Context.V14AssistantAuditorSuggestion.id)/accept" -Headers $auditorHeaders -ExpectedStatus 403 -Body @{
    reason = "Auditor should stay read-only"
}

$Context.V14AssistantMerchantHistory = Invoke-Json -Context $Context -Method Get -Path "/api/v1/assistant/interactions?limit=200" -Headers $Context.MerchantHeaders
Assert-Equal -Actual (@($Context.V14AssistantMerchantHistory).Count -le 50) -Expected $true -Message "V14 assistant history was not bounded to 50 rows."
$merchantHistoryIds = @($Context.V14AssistantMerchantHistory | ForEach-Object { $_.id })
Assert-Equal -Actual ($merchantHistoryIds -contains $Context.V14AssistantMerchantSummary.id) -Expected $true -Message "V14 assistant merchant history did not include the merchant's own summary."
Assert-Equal -Actual ($merchantHistoryIds -contains $Context.V14AssistantPlatformSuggestion.id) -Expected $false -Message "V14 assistant merchant history included another user's platform suggestion."

$assistantAudit = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/control/audit-events?limit=50" -Headers $Context.AdminHeaders
$assistantAuditActions = @($assistantAudit | Where-Object { $_.action -like "ASSISTANT_*" } | ForEach-Object { $_.action })
foreach ($expectedAction in @("ASSISTANT_SUMMARY", "ASSISTANT_SUGGESTION", "ASSISTANT_REFUSAL", "ASSISTANT_SUGGESTION_ACCEPTED")) {
    if ($assistantAuditActions -notcontains $expectedAction) {
        throw "V14 assistant audit events did not include $expectedAction."
    }
}

Write-Host "35. Running V14 assistant concurrent smoke requests"
$jobs = foreach ($index in 1..12) {
    Start-Job -ScriptBlock {
        param($JobBaseUrl, $Authorization, $Index)

        try {
            $body = @{
                scope = "MERCHANT_OPERATIONS"
                prompt = "Summarize concurrent assistant smoke $Index"
            } | ConvertTo-Json -Depth 4
            $response = Invoke-RestMethod `
                -Method Post `
                -Uri "$JobBaseUrl/api/v1/assistant/interactions" `
                -Headers @{ Authorization = $Authorization } `
                -ContentType "application/json" `
                -Body $body
            [pscustomobject]@{
                success = $true
                responseType = $response.responseType
                actionStatus = $response.actionStatus
                id = $response.id
                message = ""
            }
        } catch {
            $statusCode = 0
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }

            [pscustomobject]@{
                success = $false
                responseType = ""
                actionStatus = ""
                id = ""
                message = "$statusCode $($_.Exception.Message)"
            }
        }
    } -ArgumentList $Context.BaseUrl, $Context.MerchantHeaders.Authorization, $index
}

$Context.V14AssistantConcurrentResults = @($jobs | Wait-Job | Receive-Job)
$jobs | Remove-Job
$Context.V14AssistantConcurrentSucceeded = @($Context.V14AssistantConcurrentResults | Where-Object { $_.success -and $_.responseType -eq "SUMMARY" })
$Context.V14AssistantConcurrentFailed = @($Context.V14AssistantConcurrentResults | Where-Object { -not $_.success })
Assert-Equal -Actual @($Context.V14AssistantConcurrentResults).Count -Expected 12 -Message "V14 assistant concurrent response count mismatch."
Assert-Equal -Actual @($Context.V14AssistantConcurrentSucceeded).Count -Expected 12 -Message "V14 assistant concurrent summaries did not all succeed."
Assert-Equal -Actual @($Context.V14AssistantConcurrentFailed).Count -Expected 0 -Message "V14 assistant concurrent smoke had HTTP failures."
