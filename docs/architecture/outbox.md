# Transactional Outbox

The transactional outbox records side effects in the same database transaction as domain changes, then processes them after commit.

## Current Behavior

- Domain actions persist `outbox_events`.
- Events start as `PENDING`.
- A scheduled processor drains processable rows.
- Successful rows move to `PROCESSED`.
- Failed rows move to `FAILED`, increment `attempts`, and receive `next_attempt_at`.
- Retryable failed rows are picked up again until the configured maximum attempt count.
- Shipment events are recorded through a local carrier dispatch adapter in `carrier_dispatches`.

## Admin Surface

The admin outbox API exposes summary, event, carrier-dispatch, process, retry, and dead-letter operations under `/api/v1/admin/outbox`.

Outbox diagnostics are visible to platform roles. Owner/admin users can process, retry, and dead-letter events. Support-admin and auditor users receive review/escalation attention language and read-only diagnostics instead of retry or dead-letter calls to action.

## Event Examples

- `OrderCreated`
- `OrderAllocated`
- `OrderCancelled`
- `FulfillmentAllocationAdvanced`
- `ShipmentCreated`
- `ShipmentDelivered`
- `ShipmentFailed`
- `ShipmentReturned`
- `BackorderFulfilled`
- `BackorderCancelled`
