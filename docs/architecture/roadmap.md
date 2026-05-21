# MerHouse Roadmap

## Document Role

This tracked roadmap is the project planning and quality source of truth for agent work and human maintenance. The public repository should remain understandable from tracked source, `README.md`, `docs/index.md`, this roadmap, and the scripts under `scripts/`.

## Current Baseline

MerHouse is public-source and local-development ready. It is not SaaS-production ready yet.

The repository baseline now has:

- Spring Boot backend under `backend/`
- React/Vite frontend under `frontend/`
- public engineering documentation under `docs/`
- local runtime helpers under `scripts/local/`
- quality and proof helpers under `scripts/quality/`
- maintenance helpers under `scripts/maintenance/`
- tracked roadmap guidance under `docs/architecture/roadmap.md`

Public documentation describes the actual codebase and local development workflow.

## Completed Product Scope

V1-V6 completed the backend foundation:

- order creation and allocation
- inventory reservation and optimistic locking
- shipment lifecycle
- idempotency and partial allocation
- authentication, roles, tenants, and admin users
- outbox processing and local carrier-dispatch records

V7-V12 completed the current local product surface:

- role-aware React operations console
- merchant inventory, orders, inbound stock, and operational detail workflows
- warehouse receiving, fulfillment, shipment, and exception workflows
- merchant-warehouse relationship governance
- account recovery and access-request workflows
- service agreements, service statements, disputes, claims, reviews, and order import records
- admin platform control plane, user management, tenant governance, audit review, and outbox diagnostics
- public-source repository cleanup and local-development quality scripts

## Next Roadmap

### V13: Notifications, Live Updates, And Account Lifecycle Delivery

Planned scope:

- notification preferences
- delivery history
- event-driven UI refresh paths
- role-appropriate notification visibility
- production-shaped access-request delivery flow
- production-shaped password-reset delivery flow
- explicit prototype labeling for any account lifecycle behavior that is not production-ready in V13
- browser proof for multi-role state changes

Any V13 prototype touching access requests, password reset, notification delivery, recovery delivery, or account lifecycle status must be carried forward as an explicit Pre-V16 and V16 certification item.

### V14: Agentic Operations Assistance

Planned scope:

- scoped assistant behavior for MerHouse operations
- auditable suggestions and summaries
- strict role and tenant boundaries
- refusal paths for unsupported or unsafe requests
- proof that assistant behavior cannot cross tenant, role, or operational authority boundaries

### V15: Frontend Finish

Planned scope:

- cohesive visual system
- light/dark theme support
- responsive layout polish
- clearer dense operational states
- accessibility and screenshot proof for the main workflows
- role-aware UX polish for agentic operations added in V14

### Pre-V16 Professionalization, Reliability, Stress, And Safety Gate

Planned scope:

- full-project gap review across backend, frontend, database, scripts, docs, containers, and repository boundaries
- professional repository and documentation review against the actual code
- quality-control proof for every supported local workflow
- maximum practical load and stress testing for the current architecture
- degraded-dependency behavior
- backup and restore proof
- dependency and container review
- public-source and deployment-leakage review
- verification that prototype account lifecycle behavior from V13 is either production-ready or still blocked from production claims
- software-engineering review for maintainability, testability, observability, data integrity, role boundaries, tenant isolation, error handling, and operational proof
- release-blocker tracking before productionization

Pre-V16 is a hard gate. V16 cannot honestly begin until this phase has closed known documentation gaps, proof gaps, safety gaps, and release blockers.

Pre-V16 CI todo:

- Add release-gate automation for maximum practical load and stress testing.
- Add backup and restore proof automation.
- Add dependency and container review automation.
- Add final public-source and deployment-leakage certification.
- Keep this release gate separate from the normal CI route until the project is ready to make it a blocking productionization requirement.

### V16: SaaS Productionization

Planned scope:

- production deployment architecture
- secret management
- public-facing operational runbooks
- monitoring and alerting
- backup and rollback procedures
- production-shaped authentication and recovery flows
- production certification for access-request and password-reset delivery
- final open-source-without-leakage deployment review
- final release validation

V16 is the first phase where MerHouse can be treated as a SaaS deployment candidate.

## Roadmap QC Rules

These standing rules apply to every future phase, roadmap revision, and VInfinite backlog item.

- Keep public source safe: do not commit real secrets, production credentials, private keys, provider tokens, customer data, database dumps, generated sensitive reports, local `.env` files, or misleading production-readiness claims.
- Keep open-source readiness and deployability aligned: tracked source may document real behavior and local development, but deployment must rely on externalized secrets and environment-specific configuration.
- Any prototype touching authentication, authorization, password reset, access requests, notification delivery, tenant boundaries, data isolation, operational automation, payments, or production deployment must be labeled as prototype-local until Pre-V16 and V16 certify it as production-ready.
- Every phase must close documentation gaps against the actual code before being marked complete.
- Every phase must include proof matching its risk: backend tests, frontend tests, Playwright evidence, migration proof, script validation, stress/load proof, backup/restore proof, dependency/container review, or public-readiness checks as appropriate.
- Pre-V16 is the hard gate for full-system professionalization, stress testing, safety review, dependency/container review, backup/restore proof, public-source leakage review, and release-blocker closure.
- VInfinite may collect future ideas, but backlog items do not override QC rules and do not imply production readiness.

## Change Quality Rule

Every meaningful change needs matching proof:

- backend changes: run backend tests and add focused tests when behavior changes
- frontend changes: run lint, build, Vitest, and Playwright when routed workflows change
- database changes: prove Flyway migrations from an empty database
- script changes: parse scripts and update script documentation
- documentation changes: keep `README.md`, `docs/index.md`, and affected docs aligned
- publication-facing changes: run the public-readiness script and review ignored boundaries

Use:

```powershell
.\scripts\quality\check.ps1
```

Use Playwright E2E proof when the local stack is running and seeded:

```powershell
.\scripts\quality\frontend-check.ps1 -IncludeE2E
```

## VInfinite: Continuous Backlog

Future expansion ideas belong here only when they have a named owner, future phase, or accepted backlog reason. Advanced payments, banking, tax, accounting, carrier integrations, marketplace features, and compliance-heavy workflows remain outside V1-V16 unless the roadmap is deliberately revised.

VInfinite is continuous backlog, not hidden scope. Items parked here must still obey the Roadmap QC Rules before they can move into a numbered phase or production plan.
