# MerHouse Documentation

This directory contains engineering documentation for the current MerHouse local-development codebase.

This repository is prepared as a public local-development project. It includes the application source, documentation, scripts, CI, Docker Compose setup, and root guidance needed to understand and run MerHouse. Local-only working files stay outside Git.

## Start Here

- [Root README](../README.md): product summary, stack, setup, commands, and runtime configuration.
- [Roadmap](architecture/roadmap.md): phase plan, QC rules, and continuous backlog policy.
- [Backend guide](development/backend.md): backend runtime, testing, persistence, and API modules.
- [Frontend guide](development/frontend.md): frontend routes, runtime behavior, and tests.
- [Scripts guide](development/scripts.md): local helper scripts and when to use them.
- [Knowledge system](development/knowledge-system.md): tracked docs, repo shape, and markdown proof.

MerHouse is prepared here as a local-development stack and public-readable project. V16.2 local certification is complete through mocks, dry-run proof, cross-surface V&V/QC/QA evidence, repository checks, and a recorded final live browser/installed-APK walkthrough; actual production deployment is deferred to a later optional phase.

## Architecture

- [Account lifecycle](architecture/account-lifecycle.md)
- [Agentic operations assistance](architecture/agentic-operations-assistance.md): current deterministic assistant behavior and later model/provider-backed activation boundaries.
- [Admin and authentication model](architecture/admin-auth.md)
- [Allocation strategy](architecture/allocation-strategy.md)
- [API documentation](architecture/api-documentation.md)
- [Cancellation workflow](architecture/cancellation-workflow.md)
- [Cross-surface V&V convergence](architecture/cross-surface-convergence.md): evidence ledger, final live walkthrough checklist, and manual walkthrough evidence template.
- [Deployment-ready local certification](architecture/deployment-ready-local-certification.md)
- [Idempotency](architecture/idempotency.md)
- [Inventory locking](architecture/inventory-locking.md)
- [Merchant-warehouse operating loop](architecture/merchant-warehouse-operating-loop.md)
- [Native Android local certification](architecture/native-android-local-certification.md)
- [Notifications](architecture/notifications.md)
- [Operational details and timelines](architecture/operational-details-timelines.md)
- [Partial allocation and backorders](architecture/partial-allocation.md)
- [Roadmap](architecture/roadmap.md)
- [Role and tenant boundaries](architecture/role-tenant-boundaries.md)
- [Service accountability](architecture/service-accountability.md)
- [Shipment state machine](architecture/shipment-state-machine.md)
- [System diagrams](architecture/system-diagrams.html)
- [Transactional outbox](architecture/outbox.md)
- [V17 external service activation](architecture/v17-service-activation.md)

## Working Notes

Durable project truth belongs in tracked documentation. When local working notes produce lasting decisions, promote those decisions into `README.md`, this docs index, the roadmap, or the affected architecture/development document.
