# MerHouse Documentation

This directory contains engineering documentation for the current MerHouse local-development codebase.

The working repository is private. The intended future public release boundary is a separate repository containing only `backend/` and `frontend/`; private operational material and sensitive information should remain outside those folders and be referenced rather than embedded in publishable app source.

## Start Here

- [Root README](../README.md): product summary, stack, setup, commands, and runtime configuration.
- [Roadmap](architecture/roadmap.md): phase plan, QC rules, and continuous backlog policy.
- [Backend guide](development/backend.md): backend runtime, testing, persistence, and API modules.
- [Frontend guide](development/frontend.md): frontend routes, runtime behavior, and tests.
- [Scripts guide](development/scripts.md): local helper scripts and when to use them.
- [Knowledge system](development/knowledge-system.md): tracked docs, private Obsidian notes, publication boundary, and markdown proof.

MerHouse is prepared here as a private local development stack. Production SaaS deployment is intentionally reserved for the V16 productionization phase.

## Architecture

- [Account lifecycle](architecture/account-lifecycle.md)
- [Agentic operations assistance](architecture/agentic-operations-assistance.md): current deterministic assistant behavior and the V15.2 local AI-agent direction.
- [Admin and authentication model](architecture/admin-auth.md)
- [Allocation strategy](architecture/allocation-strategy.md)
- [API documentation](architecture/api-documentation.md)
- [Cancellation workflow](architecture/cancellation-workflow.md)
- [Frontend V15 audit](architecture/frontend-v15-audit.md)
- [Idempotency](architecture/idempotency.md)
- [Inventory locking](architecture/inventory-locking.md)
- [Merchant-warehouse operating loop](architecture/merchant-warehouse-operating-loop.md)
- [Notifications](architecture/notifications.md)
- [Operational details and timelines](architecture/operational-details-timelines.md)
- [Partial allocation and backorders](architecture/partial-allocation.md)
- [Roadmap](architecture/roadmap.md)
- [Role and tenant boundaries](architecture/role-tenant-boundaries.md)
- [Service accountability](architecture/service-accountability.md)
- [Shipment state machine](architecture/shipment-state-machine.md)
- [System diagrams](architecture/system-diagrams.html)
- [Transactional outbox](architecture/outbox.md)

## Working Notes

Private Obsidian notes live under `.notes/` and private references live under `private/`. They are useful for active work, but durable project truth should be promoted into tracked documentation when it affects code behavior, roadmap scope, quality rules, setup, or future agent guidance.
