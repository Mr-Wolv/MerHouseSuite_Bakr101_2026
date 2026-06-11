# Architecture Docs

Architecture docs describe what MerHouse is and how its current product/system behavior is supposed to work. Certification ledgers live under `docs/quality/`; deployment and provider activation live under `docs/operations/`.

## Core

- [Roadmap](roadmap.md)
- [System diagrams](system-diagrams.html)
- [API documentation](api-documentation.md)
- [Role and tenant boundaries](role-tenant-boundaries.md)
- [Admin and authentication model](admin-auth.md)
- [Account lifecycle](account-lifecycle.md)

## Fulfillment Domain

- [Merchant-warehouse operating loop](merchant-warehouse-operating-loop.md)
- [Allocation strategy](allocation-strategy.md)
- [Partial allocation and backorders](partial-allocation.md)
- [Shipment state machine](shipment-state-machine.md)
- [Cancellation workflow](cancellation-workflow.md)
- [Inventory locking](inventory-locking.md)
- [Operational details and timelines](operational-details-timelines.md)

## Reliability And Experience

- [Transactional outbox](outbox.md)
- [Idempotency](idempotency.md)
- [Notifications](notifications.md)
- [Service accountability](service-accountability.md)
- [Agentic operations assistance](agentic-operations-assistance.md)
