param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "11a. Creating V11 service agreement record"
$effectiveDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$renewalDate = (Get-Date).AddMonths(1).ToString("yyyy-MM-dd")
$Context.ServiceAgreement = Invoke-Json -Context $Context -Method Post -Path "/api/v1/service-accountability/agreements" -Headers $Context.MerchantHeaders -Body @{
    relationshipId = $Context.MerchantWarehouseRelationship.id
    title = "Smoke service agreement $($Context.Suffix)"
    effectiveDate = $effectiveDate
    renewalReviewDate = $renewalDate
    cancellationWindowDays = 14
    serviceScopes = @("INBOUND_RECEIVING", "STORAGE", "PICK_PACK", "SHIPMENT_HANDOFF")
    serviceNotes = "Internal service-accountability record only"
    rateCard = @{
        inboundReceivingFeePerUnit = 2.50
        storageFeePerUnitPerDay = 0.10
        freeStorageDays = 5
        minimumMonthlyServiceCharge = 0
        pickFeePerOrder = 1.25
        pickFeePerLine = 0.75
        packFeePerOrder = 1.00
        packagingFeePerPackage = 0.50
        shipmentHandlingFee = 1.50
        returnRestockFee = 1.00
        exceptionHandlingFee = 3.00
        coordinationFeePercent = 5.00
        fixedCoordinationFee = 1.00
        carrierPassThroughNote = "Carrier cost is a note only; MerHouse does not collect payment."
    }
    slaPolicy = @{
        receivingSlaHours = 48
        pickPackSlaHours = 24
        shipmentHandoffSlaHours = 12
        exceptionResponseSlaHours = 8
        pauseRuleNotes = "Agreement hold pauses SLA clocks."
    }
}
Assert-NotBlank -Value $Context.ServiceAgreement.id -Message "Service agreement id was blank."
Assert-Equal -Actual $Context.ServiceAgreement.status -Expected "DRAFT" -Message "Service agreement initial status mismatch."
Assert-Equal -Actual $Context.ServiceAgreement.rateCard.coordinationFeePercent -Expected 5.00 -Message "Service agreement coordination fee percent mismatch."

Write-Host "11b. Proposing and accepting service agreement"
$Context.ServiceAgreement = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/service-accountability/agreements/$($Context.ServiceAgreement.id)/propose" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.ServiceAgreement.status -Expected "PROPOSED" -Message "Service agreement proposed status mismatch."
$Context.ServiceAgreement = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/service-accountability/agreements/$($Context.ServiceAgreement.id)/accept" -Headers $Context.OperatorHeaders
Assert-Equal -Actual $Context.ServiceAgreement.status -Expected "ACTIVE" -Message "Service agreement active status mismatch."

Write-Host "11c. Verifying role-scoped service agreement visibility"
$merchantAgreements = Invoke-Json -Context $Context -Method Get -Path "/api/v1/service-accountability/agreements" -Headers $Context.MerchantHeaders
$Context.MerchantAgreementRows = @($merchantAgreements | Where-Object { $_.id -eq $Context.ServiceAgreement.id })
Assert-Equal -Actual $Context.MerchantAgreementRows.Count -Expected 1 -Message "Merchant could not see own service agreement."
$providerAgreements = Invoke-Json -Context $Context -Method Get -Path "/api/v1/service-accountability/agreements" -Headers $Context.OperatorHeaders
$Context.ProviderAgreementRows = @($providerAgreements | Where-Object { $_.id -eq $Context.ServiceAgreement.id })
Assert-Equal -Actual $Context.ProviderAgreementRows.Count -Expected 1 -Message "Warehouse provider could not see own service agreement."
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/service-accountability/agreements/$($Context.ServiceAgreement.id)" -Headers $Context.OtherMerchantHeaders -ExpectedStatus 403

Write-Host "11d. Creating idempotent service statement from operational evidence"
$periodStart = (Get-Date).ToString("yyyy-MM-dd")
$periodEnd = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
$dueDate = (Get-Date).AddDays(14).ToString("yyyy-MM-dd")
$statementBody = @{
    periodStart = $periodStart
    periodEnd = $periodEnd
    dueDate = $dueDate
    idempotencyKey = "statement-$($Context.Suffix)"
    note = "Smoke statement reconciles to received inbound stock."
    inboundStockRequestIds = @($Context.InboundStockRequest.id)
    fulfillmentAllocationIds = @()
    shipmentIds = @()
}
$Context.ServiceStatement = Invoke-Json -Context $Context -Method Post -Path "/api/v1/service-accountability/agreements/$($Context.ServiceAgreement.id)/statements/generate" -Headers $Context.MerchantHeaders -Body $statementBody
Assert-NotBlank -Value $Context.ServiceStatement.id -Message "Service statement id was blank."
Assert-Equal -Actual $Context.ServiceStatement.status -Expected "DRAFT" -Message "Service statement initial status mismatch."
Assert-Equal -Actual ([decimal]$Context.ServiceStatement.subtotalAmount) -Expected ([decimal]10.00) -Message "Service statement subtotal mismatch."
Assert-Equal -Actual ([decimal]$Context.ServiceStatement.coordinationFeeAmount) -Expected ([decimal]1.50) -Message "Service statement coordination fee mismatch."
Assert-Equal -Actual ([decimal]$Context.ServiceStatement.totalAmount) -Expected ([decimal]11.50) -Message "Service statement total mismatch."

$replayedStatement = Invoke-Json -Context $Context -Method Post -Path "/api/v1/service-accountability/agreements/$($Context.ServiceAgreement.id)/statements/generate" -Headers $Context.MerchantHeaders -Body $statementBody
Assert-Equal -Actual $replayedStatement.id -Expected $Context.ServiceStatement.id -Message "Service statement idempotency replay mismatch."

Write-Host "11e. Verifying SLA, disputes, claims, and review approvals"
$Context.ServiceSlaStatuses = Invoke-Json -Context $Context -Method Get -Path "/api/v1/service-accountability/agreements/$($Context.ServiceAgreement.id)/sla-statuses" -Headers $Context.MerchantHeaders
$Context.ServiceInboundSlaRows = @($Context.ServiceSlaStatuses | Where-Object { $_.sourceId -eq $Context.InboundStockRequest.id })
Assert-Equal -Actual $Context.ServiceInboundSlaRows.Count -Expected 1 -Message "Inbound SLA status was not returned."

$Context.ServiceClaim = Invoke-Json -Context $Context -Method Post -Path "/api/v1/service-accountability/agreements/$($Context.ServiceAgreement.id)/claims" -Headers $Context.MerchantHeaders -Body @{
    sourceType = "INBOUND_STOCK_REQUEST"
    sourceId = $Context.InboundStockRequest.id
    claimType = "DAMAGED_STOCK"
    reason = "Damage evidence needs provider review"
    evidenceNote = "Smoke claim evidence note"
}
Assert-Equal -Actual $Context.ServiceClaim.status -Expected "OPEN" -Message "Service claim initial status mismatch."
$Context.ServiceClaim = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/service-accountability/claims/$($Context.ServiceClaim.id)/resolve" -Headers $Context.OperatorHeaders -Body @{
    status = "RESOLVED"
    outcomeNote = "Resolved claim in smoke path"
}
Assert-Equal -Actual $Context.ServiceClaim.status -Expected "RESOLVED" -Message "Service claim resolved status mismatch."

$Context.ServiceReview = Invoke-Json -Context $Context -Method Post -Path "/api/v1/service-accountability/agreements/$($Context.ServiceAgreement.id)/reviews" -Headers $Context.MerchantHeaders -Body @{
    reviewType = "MANUAL_ADJUSTMENT"
    reason = "Manual adjustment approval smoke path"
    evidenceNote = "Adjustment needs provider review"
}
Assert-Equal -Actual $Context.ServiceReview.status -Expected "PENDING" -Message "Service review initial status mismatch."
$Context.ServiceReview = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/service-accountability/reviews/$($Context.ServiceReview.id)/resolve" -Headers $Context.OperatorHeaders -Body @{
    status = "APPROVED"
    outcomeNote = "Approved in smoke path"
}
Assert-Equal -Actual $Context.ServiceReview.status -Expected "APPROVED" -Message "Service review approved status mismatch."

Write-Host "11f. Finalizing and marking settlement status without payment collection"
$Context.ServiceStatement = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/service-accountability/statements/$($Context.ServiceStatement.id)/finalize" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $Context.ServiceStatement.status -Expected "FINALIZED" -Message "Service statement finalized status mismatch."
$Context.ServiceStatement = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/service-accountability/statements/$($Context.ServiceStatement.id)/mark-settled" -Headers $Context.OperatorHeaders
Assert-Equal -Actual $Context.ServiceStatement.status -Expected "MARKED_SETTLED" -Message "Service statement settlement-status mismatch."
Invoke-ExpectedHttpFailure -Method Patch -Path "/api/v1/service-accountability/statements/$($Context.ServiceStatement.id)/mark-settled" -Headers $Context.OperatorHeaders -ExpectedStatus 409

$Context.ServiceDispute = Invoke-Json -Context $Context -Method Post -Path "/api/v1/service-accountability/statements/$($Context.ServiceStatement.id)/disputes" -Headers $Context.MerchantHeaders -Body @{
    statementLineId = $Context.ServiceStatement.lines[0].id
    reason = "Receiving line needs review"
    evidenceNote = "Smoke dispute evidence note"
}
Assert-Equal -Actual $Context.ServiceDispute.status -Expected "OPEN" -Message "Service dispute initial status mismatch."
$Context.ServiceDispute = Invoke-Json -Context $Context -Method Patch -Path "/api/v1/service-accountability/disputes/$($Context.ServiceDispute.id)/resolve" -Headers $Context.OperatorHeaders -Body @{
    status = "RESOLVED"
    outcomeNote = "Resolved in smoke path"
}
Assert-Equal -Actual $Context.ServiceDispute.status -Expected "RESOLVED" -Message "Service dispute resolved status mismatch."

Write-Host "11g. Verifying deployment-shaped local order import validation"
$Context.OrderImport = Invoke-Json -Context $Context -Method Post -Path "/api/v1/orders/imports" -Headers $Context.MerchantHeaders -Body @{
    merchantId = $Context.Merchant.id
    mode = "PARTIAL_ACCEPT"
    sourceLabel = "Smoke import $($Context.Suffix)"
    rows = @(
        @{
            merchantOrderReference = "IMPORT-$($Context.Suffix)-1"
            sku = $Context.Item.sku
            quantity = 1
            customerAddress = "Import customer address"
            customerName = "Import Customer"
            customerPhone = "+100000000"
        },
        @{
            merchantOrderReference = "IMPORT-$($Context.Suffix)-1"
            sku = $Context.Item.sku
            quantity = 1
            customerAddress = "Duplicate reference address"
            customerName = "Duplicate Customer"
        },
        @{
            merchantOrderReference = "IMPORT-$($Context.Suffix)-2"
            sku = "UNKNOWN-$($Context.Suffix)"
            quantity = 1
            customerAddress = "Unknown SKU address"
        }
    )
}
Assert-Equal -Actual $Context.OrderImport.status -Expected "PARTIAL_ACCEPTED" -Message "Order import partial status mismatch."
Assert-Equal -Actual $Context.OrderImport.createdRows -Expected 1 -Message "Order import created row count mismatch."
Assert-Equal -Actual $Context.OrderImport.rejectedRows -Expected 2 -Message "Order import rejected row count mismatch."
$importRows = Invoke-Json -Context $Context -Method Get -Path "/api/v1/orders/imports/$($Context.OrderImport.id)" -Headers $Context.MerchantHeaders
Assert-Equal -Actual $importRows.rows.Count -Expected 3 -Message "Order import detail row count mismatch."
Invoke-ExpectedHttpFailure -Method Get -Path "/api/v1/orders/imports/$($Context.OrderImport.id)" -Headers $Context.OtherMerchantHeaders -ExpectedStatus 403
