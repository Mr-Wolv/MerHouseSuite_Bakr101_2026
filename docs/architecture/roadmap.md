# MerHouse Roadmap

## Document Role

This tracked roadmap is the project planning and quality source of truth for agent work and human maintenance. The private working repository should remain understandable from tracked source, `README.md`, `docs/index.md`, this roadmap, and the scripts under `scripts/`.

## Current Baseline

MerHouse is private-workspace and local-development ready. It is not SaaS-production ready yet.

The intended future publication boundary is a separate repository containing only the `backend/` and `frontend/` application folders. Private operational material and sensitive information may be tracked in this private repo, but they must remain outside `backend/` and `frontend/` and be referenced by path, environment variable, or template instead of being embedded in the future public app source. Sensitive information includes credentials, API keys, tokens, private prompts, customer data, vendor account details, internal endpoints, generated sensitive reports, private planning files, and environment-specific values.

This roadmap also owns the gap-closure rule for the private workspace: before the project moves deeper into product work, contradictions between code, docs, scripts, notes, CI, and the future publication boundary must be resolved or recorded as explicit blockers with proof needed.

The repository baseline now has:

- Spring Boot backend under `backend/`
- React/Vite frontend under `frontend/`
- engineering documentation under `docs/`
- local runtime helpers under `scripts/local/`
- quality and proof helpers under `scripts/quality/`
- maintenance helpers under `scripts/maintenance/`
- tracked roadmap guidance under `docs/architecture/roadmap.md`
- private Obsidian notes under `.notes/`
- private reference material under `private/`

Tracked documentation describes the actual codebase and local development workflow.

## Knowledge And Documentation Model

MerHouse has three knowledge layers:

- Durable tracked truth: `README.md`, `docs/index.md`, this roadmap, affected pages under `docs/`, scripts, migrations, code, and tests.
- Agent guidance: `AGENTS.md`, which converts this roadmap into day-to-day working rules.
- Private working notes: `.notes/` and `private/`, which are useful for active thinking, Obsidian dashboards, QC notes, decisions, and external references but must not become the only place where project truth exists.

Obsidian notes are allowed and encouraged in this private workspace. They must stay productive by linking to durable docs, naming current proof, and promoting cleaned decisions into tracked documentation when they affect project scope, architecture, setup, quality rules, or future agents. Private notes may contain sensitive context only outside `backend/` and `frontend/`.

## Publication Boundary Model

The future public app repository is intentionally smaller than this private workspace. It should contain `backend/` and `frontend/` only after a publication-boundary review confirms that:

- no sensitive files live under either app folder
- app code consumes secrets through environment variables, external files, or templates
- local/demo credentials are clearly fake and cannot be confused with real operational secrets
- generated reports, screenshots, logs, database dumps, private notes, and private references stay outside the public app boundary
- docs inside the app folders do not depend on private context for safe setup or operation
- CI names, logs, and artifacts expose only non-sensitive proof identifiers

Private repository material outside `backend/` and `frontend/` may still be tracked here when it is useful to the project, but it must not leak into the later public app source.

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
- repository cleanup and local-development quality scripts

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

Completion proof expected for V13:

- backend tests for notification preferences, delivery records, and account lifecycle state transitions
- frontend tests for notification visibility and account lifecycle flows
- browser proof for multi-role updates across platform, merchant, and warehouse contexts
- publication-boundary proof that delivery prototypes do not embed provider credentials or private endpoints in app source
- documentation updates for any prototype-local behavior that remains below production readiness

### V14: Agentic Operations Assistance

Planned scope:

- scoped assistant behavior for MerHouse operations
- auditable suggestions and summaries
- strict role and tenant boundaries
- refusal paths for unsupported or unsafe requests
- proof that assistant behavior cannot cross tenant, role, or operational authority boundaries

Completion proof expected for V14:

- role and tenant boundary tests for every assistant-visible operation
- audit trail proof for suggestions, summaries, refusals, and accepted actions
- refusal tests for unsupported, unsafe, cross-tenant, or over-authority requests
- documentation of supported assistant scope and explicit non-goals
- publication-boundary proof that private prompts, provider keys, customer data, and internal endpoints are not hard-coded in `backend/` or `frontend/`

### V15: Frontend Finish

Planned scope:

- cohesive visual system
- light/dark theme support
- responsive layout polish
- clearer dense operational states
- accessibility and screenshot proof for the main workflows
- role-aware UX polish for agentic operations added in V14

Completion proof expected for V15:

- lint, build, Vitest, and Playwright proof for the main routed workflows
- responsive screenshots or browser evidence for platform, merchant, warehouse, and service-accountability surfaces
- accessibility review for navigation, forms, status text, contrast, and keyboard reachability
- documentation updates for any changed routes, workflows, or runtime assumptions
- publication-boundary proof that UI copy and frontend configuration remain safe for later public release

### Pre-V16 Professionalization, Reliability, Stress, And Safety Gate

Planned scope:

- full-project gap review across backend, frontend, database, scripts, docs, containers, and repository boundaries
- professional repository and documentation review against the actual code
- quality-control proof for every supported local workflow
- maximum practical load and stress testing for the current architecture
- degraded-dependency behavior
- backup and restore proof
- dependency and container review
- publication-boundary and deployment-leakage review
- verification that prototype account lifecycle behavior from V13 is either production-ready or still blocked from production claims
- software-engineering review for maintainability, testability, observability, data integrity, role boundaries, tenant isolation, error handling, and operational proof
- release-blocker tracking before productionization

Pre-V16 is a hard gate. V16 cannot honestly begin until this phase has closed known documentation gaps, proof gaps, safety gaps, and release blockers.

Pre-V16 exit criteria:

- repository gap review completed across code, docs, scripts, CI, database, Docker, and publication boundaries
- `README.md`, `docs/index.md`, `AGENTS.md`, and this roadmap agree with the actual codebase
- all markdown files intended for active use have valid local links or documented exceptions
- backend, frontend, database, script, API smoke, browser, and publication-boundary proof are current
- load/stress limits are measured for the current local architecture and documented without overstating production capacity
- backup and restore proof exists for the supported local data model
- dependency and container risks are reviewed and documented
- prototype-local account lifecycle behavior from V13 is either production-ready or explicitly blocked from production claims
- release blockers are tracked with owner, risk, and required proof

Pre-V16 CI todo:

- Add release-gate automation for maximum practical load and stress testing.
- Add backup and restore proof automation.
- Add dependency and container review automation.
- Add final publication-boundary and deployment-leakage certification for the future `backend/` and `frontend/` public repository.
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
- final publication-without-leakage deployment review
- final release validation

V16 is the first phase where MerHouse can be treated as a SaaS deployment candidate.

V16 exit criteria:

- production deployment architecture is documented and matched by deployable configuration
- secrets are managed by production-grade secret infrastructure, not app-source files
- monitoring, alerting, logging, backups, rollback, incident response, and access recovery have runbooks and proof
- public-facing documentation accurately describes production behavior
- final publication-boundary certification passes for the separate public `backend/` and `frontend/` repository
- final release validation passes without unresolved production blockers

## Roadmap QC Rules

These standing rules apply to every future phase, roadmap revision, and VInfinite backlog item.

- Keep the future public app source safe: do not place sensitive information inside `backend/` or `frontend/`. This includes real secrets, production credentials, private keys, provider tokens, customer data, database dumps, private prompts, vendor account details, internal endpoints, generated sensitive reports, local `.env` files, or misleading production-readiness claims.
- Keep publication readiness and deployability aligned: `backend/` and `frontend/` may document real behavior and local development, but deployment must rely on externalized secrets and environment-specific configuration.
- Keep private material external to the app folders: anything that should remain private must live outside `backend/` and `frontend/` and be referenced by path, environment variable, or template. Sensitive material must never be hard-coded in app source. It may be tracked elsewhere in this private repository when appropriate.
- Keep Obsidian notes useful but subordinate: `.notes/` can hold active thinking, but lasting architecture, roadmap, setup, and QC truth must be promoted into tracked docs.
- Keep markdown connected: new or changed markdown should have a clear purpose, useful links, and passing local link proof unless it is intentionally isolated and the reason is documented.
- Close gaps before expanding scope: when work reveals stale docs, weak proof, boundary risk, inconsistent terminology, or conflicting behavior, fix it in the same change when practical. Otherwise record the blocker with owner, risk, and required proof before moving on.
- Any prototype touching authentication, authorization, password reset, access requests, notification delivery, tenant boundaries, data isolation, operational automation, payments, or production deployment must be labeled as prototype-local until Pre-V16 and V16 certify it as production-ready.
- Every phase must close documentation gaps against the actual code before being marked complete.
- Every phase must include proof matching its risk: backend tests, frontend tests, Playwright evidence, migration proof, script validation, stress/load proof, backup/restore proof, dependency/container review, or public-readiness checks as appropriate.
- CI intended for publication must be treated as production-shaped proof. The GitHub Actions workflow and visible run title must use the stable name `MerHouse Quality Gate`, not commit-message-as-process naming; CI must use generated masked credentials, keep password-reset token echo disabled, redact auth material from generated reports, avoid publishing raw proof artifacts, and expose only non-sensitive job flow, status, and proof identifiers in logs.
- Pre-V16 is the hard gate for full-system professionalization, stress testing, safety review, dependency/container review, backup/restore proof, publication-boundary leakage review, and release-blocker closure.
- VInfinite may collect future ideas, but backlog items do not override QC rules and do not imply production readiness.

## Change Quality Rule

Every meaningful change needs matching proof:

- backend changes: run backend tests and add focused tests when behavior changes
- frontend changes: run lint, build, Vitest, and Playwright when routed workflows change
- database changes: prove Flyway migrations from an empty database
- script changes: parse scripts and update script documentation
- documentation changes: keep `README.md`, `docs/index.md`, affected docs, and active Obsidian notes aligned; run markdown link proof
- publication-facing changes: run the public-readiness script and review the `backend/` and `frontend/` boundary
- guidance changes: update `AGENTS.md`, this roadmap, and any matching QC checklist together
- gap-closure changes: document what contradiction or proof gap was closed and what evidence now prevents it from reopening

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
