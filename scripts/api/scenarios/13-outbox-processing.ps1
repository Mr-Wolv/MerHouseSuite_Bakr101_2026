param([Parameter(Mandatory = $true)] [hashtable] $Context)

Write-Host "29. Processing outbox events"
$Context.V6OutboxProcess = Invoke-Json -Context $Context -Method Post -Path "/api/v1/admin/outbox/process?limit=500"
Assert-Equal -Actual $Context.V6OutboxProcess.failed -Expected 0 -Message "Outbox processing reported failures."

$Context.V6OutboxRows = Invoke-PostgresTableQuery -Sql @"
SELECT id, event_type, aggregate_type, aggregate_id, status, attempts, processed_at, last_error
FROM outbox_events
WHERE aggregate_id IN (
    '$($Context.Order.id)'::uuid,
    '$($Context.V4IdempotentOrder.id)'::uuid,
    '$($Context.V4PartialOrder.id)'::uuid,
    '$($Context.DeliveredOrder.id)'::uuid,
    '$($Context.Shipment.id)'::uuid
)
ORDER BY created_at
"@

Assert-Equal -Actual (@($Context.V6OutboxRows).Count -gt 0) -Expected $true -Message "No V6 outbox rows were found for the smoke run."
foreach ($row in @($Context.V6OutboxRows)) {
    Assert-Equal -Actual $row.status -Expected "PROCESSED" -Message "Outbox row $($row.id) was not processed."
    Assert-Equal -Actual ([int]$row.attempts -ge 1) -Expected $true -Message "Outbox row $($row.id) did not record an attempt."
    Assert-NotBlank -Value $row.processed_at -Message "Outbox row $($row.id) did not record processed_at."
}

Write-Host "30. Verifying carrier dispatch adapter"
$Context.V6CarrierDispatchRows = Invoke-PostgresTableQuery -Sql @"
SELECT id, outbox_event_id, shipment_id, event_type, carrier, tracking_number, status, attempts, external_reference
FROM carrier_dispatches
WHERE shipment_id = '$($Context.Shipment.id)'::uuid
ORDER BY created_at
"@

Assert-Equal -Actual (@($Context.V6CarrierDispatchRows).Count -ge 2) -Expected $true -Message "Expected carrier dispatch rows for shipment lifecycle events."
foreach ($row in @($Context.V6CarrierDispatchRows)) {
    Assert-Equal -Actual $row.status -Expected "DISPATCHED" -Message "Carrier dispatch $($row.id) status mismatch."
    Assert-Equal -Actual ([int]$row.attempts -ge 1) -Expected $true -Message "Carrier dispatch $($row.id) did not record attempts."
    Assert-NotBlank -Value $row.external_reference -Message "Carrier dispatch $($row.id) did not record an external reference."
}

Write-Host "31. Verifying admin outbox read APIs"
$Context.V7OutboxSummary = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/outbox/summary"
$Context.V7OutboxEvents = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/outbox/events?limit=10"
$Context.V7CarrierDispatches = Invoke-Json -Context $Context -Method Get -Path "/api/v1/admin/outbox/carrier-dispatches?limit=10"

Assert-Equal -Actual ([int64]$Context.V7OutboxSummary.failed) -Expected 0 -Message "Outbox summary reported failures."
Assert-Equal -Actual ([int64]$Context.V7OutboxSummary.pending) -Expected 0 -Message "Outbox summary reported pending events after processing."
Assert-Equal -Actual ([int64]$Context.V7OutboxSummary.processed -ge @($Context.V6OutboxRows).Count) -Expected $true -Message "Outbox summary processed count was too low."
Assert-Equal -Actual (@($Context.V7OutboxEvents).Count -gt 0) -Expected $true -Message "Outbox events read API returned no rows."
Assert-Equal -Actual (@($Context.V7CarrierDispatches).Count -gt 0) -Expected $true -Message "Carrier dispatch read API returned no rows."
