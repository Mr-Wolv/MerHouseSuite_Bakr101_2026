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

Current progress:

- local notification preference model and API added
- local delivery-history model and API added
- account lifecycle hooks now record prototype-local password-reset and access-request delivery history
- `/notifications` route added for authenticated roles
- lightweight polling added for notification summary, app-shell unread count, and notification page delivery refresh
- production-shaped delivery fields added for local delivery stage and provider status
- browser proof added for multi-role notification preference and delivery-state changes across merchant and warehouse contexts
- provider-backed delivery remains intentionally out of scope until Pre-V16 and V16

Delivered V13 scope:

- notification preferences
- delivery history
- lightweight polling refresh paths
- role-appropriate notification visibility
- production-shaped access-request delivery flow
- production-shaped password-reset delivery flow
- explicit prototype labeling for any account lifecycle behavior that is not production-ready in V13
- browser proof for multi-role state changes

Any V13 prototype touching access requests, password reset, notification delivery, recovery delivery, or account lifecycle status must be carried forward as an explicit Pre-V16 and V16 certification item.

V13 completion proof:

- backend tests for notification preferences, delivery records, and account lifecycle state transitions
- frontend tests for notification visibility and account lifecycle flows
- browser proof for multi-role updates across platform, merchant, and warehouse contexts
- publication-boundary proof that delivery prototypes do not embed provider credentials or private endpoints in app source
- documentation updates for any prototype-local behavior that remains below production readiness

### V14: Agentic Operations Assistance

Delivered V14 scope:

- prototype-local assistant interaction ledger and API added
- deterministic scoped summaries and risk-ranked review-only suggestions added for platform, merchant, and warehouse contexts
- refusal paths added for unsupported mutations, missing or unknown target tenant scope, wrong target tenant type, cross-tenant requests, and over-authority scope requests
- explicit accept/reject workflow added for pending assistant suggestions without operational mutation
- assistant interaction route added for authenticated roles
- admin audit review now summarizes and filters assistant activity for platform and auditor review
- admin audit events added for assistant summaries, suggestions, refusals, accepted suggestions, and rejected suggestions
- proof added that assistant behavior cannot cross tenant, role, or operational authority boundaries

V14 completion proof:

- role and tenant boundary tests for every assistant-visible operation
- audit trail proof for suggestions, summaries, refusals, accepted suggestions, and rejected suggestions
- refusal tests for unsupported, unsafe, cross-tenant, or over-authority requests
- documentation of supported assistant scope, deterministic risk-priority rules, and explicit non-goals
- publication-boundary proof that private prompts, provider keys, customer data, and internal endpoints are not hard-coded in `backend/` or `frontend/`
- live browser closeout passed on 2026-05-30 for owner accept/reject, platform target summaries, missing-target refusal, assistant audit filtering, merchant scoped summary/refusal, warehouse scoped summary/refusal, and auditor read-only assistant/audit behavior
- `.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose` passed on 2026-05-30 after live testing, including backend tests, frontend lint/build/Vitest, all Playwright tests, markdown links, publication boundary, CI naming, sensitive-file scan, and sensitive-pattern scan
- `.\scripts\quality\api-smoke.ps1` passed on 2026-05-30 after live testing with V14 assistant endpoint, audit, history-scope, refusal, auditor-read-only, and smoke-scale concurrent request proof; latest summary: `reports/api-smoke-test-20260530-142704.summary.md`

### V15: Frontend Finish

Planned scope:

- full frontend audit matrix by route, role, viewport, workflow criticality, accessibility risk, and visual/UX gap, tracked in [Frontend V15 audit](frontend-v15-audit.md)
- cohesive professional visual system for spacing, typography, color, density, buttons, forms, tables, cards, badges, loading states, empty states, error states, and destructive/privileged actions
- light/dark theme support with persistent user preference, system preference handling, and contrast proof in both themes
- responsive layout polish across desktop, tablet/narrow, and mobile-sized widths with no horizontal overflow, clipped controls, hidden critical actions, or unreadable dense data
- accessibility hardening for semantic headings, labels, keyboard paths, focus states, contrast, status text, live updates, reduced-motion behavior where relevant, and screen-reader-friendly controls
- clearer dense operational states for admin, merchant, warehouse, notifications, service-accountability, relationship, order, inbound, shipment, inventory, outbox, audit, and assistant workflows
- role-aware UX polish for agentic operations added in V14, including clearer prototype-local framing, safer suggestion decision controls, easier history scanning, and visible audit linkage
- consistent navigation and workflow ergonomics so repeated operational work feels predictable, professional, and efficient
- screenshot/browser proof for the main workflows before V15 can close

Completion proof expected for V15:

- lint, build, Vitest, and Playwright proof for the main routed workflows
- route-by-route audit record for owner, admin/support-admin where relevant, auditor, merchant, and warehouse operator surfaces, including the issue found, owner of the fix, and proof that it closed
- responsive screenshots or browser evidence for platform, merchant, warehouse, assistant, notifications, service-accountability, audit/outbox, and public auth/recovery surfaces
- light/dark screenshots or browser evidence for representative dense screens, forms, tables, and assistant/audit flows
- accessibility review for navigation, forms, status text, contrast, keyboard reachability, focus visibility, semantic headings, unlabeled controls, and interactive state announcements
- proof that no route has horizontal overflow, incoherent overlap, clipped button text, inaccessible critical actions, or remote visual assets required for local rendering
- documentation updates for any changed routes, workflows, or runtime assumptions
- publication-boundary proof that UI copy and frontend configuration remain safe for later public release

V15 whole-version closeout gateway:

- V15 cannot close until a full gap-coverage sweep confirms tracked docs, code, scripts, tests, and user-facing UI/UX describe and prove the same current app.
- Documentation must describe the current application across `README.md`, `docs/index.md`, affected architecture/development docs, roadmap sections, and active V15 audit notes; stale version claims, outdated setup steps, and old behavior descriptions must be fixed or recorded as blockers.
- Code must coincide with the promised V15 features and known intentional deferrals; any mismatch between roadmap scope, implemented behavior, and visible product behavior must be closed or explicitly assigned to V15.5, V15.6, Pre-V16, V16, or VInfinite with required proof.
- Scripts must be current for the app they verify: local run helpers, seed/demo helpers, quality scripts, maintenance scripts, and documentation for those scripts must agree with the actual runtime and proof expectations.
- Tests must be current and meaningful: newly added features, components, and flows need focused coverage plus integration or route proof where they interact with surrounding workflows; stale fixture assumptions and weak assertions must be updated before closeout.
- UI/UX must pass a final professional review across the app: no awkward daily components, missing icons, ghost alerts, confusing empty states, inaccessible controls, clunky transitions, broken handoffs, incoherent overlap, misleading wording, or user-facing residue from earlier versions.
- Each remaining V15 subversion should apply this gateway at its own scale before it is called closed, then the whole-version sweep repeats after V15.6 and before Pre-V16.

### V15.1: UI Signature, Human Empty States, And Alerting Polish

Planned scope:

- remove customer-facing "prototype" framing from daily app surfaces and replace it with confident, production-shaped operational language while keeping release truth in roadmap, engineering docs, and guarded admin/release notes until Pre-V16 and V16 certify external delivery and SaaS readiness
- create a distinct MerHouse visual signature for the application shell, favicon/app mark, navigation, page headers, empty states, notification surfaces, and action icons without relying on default Vite assets, generic placeholder sprites, missing textures, remote visual assets, or clunky one-off icon choices
- standardize an icon language across roles and workflows so platform governance, merchant operations, warehouse execution, service accountability, notifications, assistant review, destructive actions, warnings, successes, and empty states have recognizable, accessible, non-primitive symbols
- make notification counts reflect the real unread total instead of a sticky placeholder value; hide or quiet the badge at zero, show the exact number when unread items exist, and prove the count changes with notification state
- make notifications alerting where operationally meaningful, including clear severity treatment for failed outbox work, failed or returned shipments, SLA risk, access-request readiness, account lifecycle events, and other user-actionable events without turning routine history into noise
- redesign empty states as human onboarding surfaces: when a newly created account has no inventory, orders, inbound work, relationships, notifications, service records, or assistant history, the UI should explain what the user can do next, which prerequisites matter, and which primary action starts the workflow
- ensure empty-state guidance is role-aware and workflow-aware: merchants should be guided toward creating inventory, relationships, inbound stock, and orders; warehouse operators toward receiving setup, fulfillment queues, and service relationships; platform users toward tenant/user/access/relationship setup; auditors toward review filters and evidence trails
- keep empty states accessible and calm: semantic headings, concise next-step text, one clear primary action where available, safe secondary links, no misleading production claims, no secrets in examples, and no dead-end blank panels
- review all loading, error, no-data, first-run, and "not found" states so they feel intentionally designed rather than mechanically generated

Completion proof expected for V15.1:

- focused frontend tests for notification unread counts, zero-count badge behavior, alert severity rendering, and role-aware empty-state guidance
- route-tour proof showing no unlabeled controls, empty interactive names, horizontal overflow, or console errors after icon and empty-state changes
- live browser screenshots for first-run/empty merchant, warehouse, platform, notification, assistant, and service-accountability states
- visual proof that the app shell and favicon/app mark use MerHouse-owned local assets and do not expose default Vite assets, missing textures, or remote visual dependencies
- documentation update explaining which user-facing prototype wording was removed, where release-truth wording still lives, and why this does not claim SaaS production readiness before V16
- publication-boundary proof that new assets and UI copy are safe for the future public `backend/` and `frontend/` repository

### V15.2: Local AI Agent Architecture And Docker Runtime

Planned scope:

- mark the current assistant honestly as deterministic risk triage, not provider-backed AI or an autonomous agent
- design a local AI-agent stack that can run beside `frontend`, `backend`, and `postgres` in Docker without placing model credentials, private prompts, provider tokens, or internal endpoints inside the future public app source
- introduce a separate `agent-service` boundary for AI reasoning so the Spring backend remains the source of truth for authentication, tenant scope, authorization, validation, auditing, and operational mutation
- define the local model runtime option for development, such as Ollama, llama.cpp, vLLM, or another containerized runtime, with resource expectations and a documented fallback when no model runtime is available
- keep AI tool use backend-mediated: the agent may request authorized read context and propose actions, but privileged mutations must pass backend validation and human approval before execution
- define prompt, context, and memory boundaries so tenant data, private prompts, customer data, and operational secrets do not leak across users, tenants, logs, generated reports, or future publication boundaries
- add an auditable agent tool-call model for proposed plans, retrieved context, tool requests, refusal reasons, human approvals, execution results, and evaluation outcomes
- define local evals that prove the agent chooses useful next steps, refuses unsafe requests, respects tenant and role boundaries, and degrades cleanly when the model runtime is down or slow
- decide whether V15.2 implements the first read-only local agent slice or closes as an architecture-only version before Pre-V16

Completion proof expected for V15.2:

- tracked architecture documentation for `frontend -> backend -> agent-service -> local-model-runtime`, including deployment boundaries, data flow, failure modes, and audit records
- Docker Compose plan or implementation showing how the local agent components are configured without embedding secrets in `backend/` or `frontend`
- backend tests proving every agent-visible tool remains role-scoped, tenant-scoped, audited, and non-mutating unless explicitly human-approved
- frontend tests or browser proof showing the UI labels the capability honestly as local AI assistance only when the local runtime is available
- model-runtime-off proof showing the app falls back to deterministic assistant behavior or a clear unavailable state without breaking core workflows
- publication-boundary proof that local AI configuration, prompts, model settings, eval reports, and generated traces do not leak into the future public app source
- roadmap decision recorded before Pre-V16 begins: implemented read-only local agent slice, architecture-only closeout, or explicit blocker with proof required

### V15.3: Human Comprehension And Quality-Of-Life UI

Planned scope:

- make the app understandable to a capable first-time user who did not help build MerHouse, without relying on chat history, hidden docs, or developer explanation
- replace shorthand navigation labels with plain workflow names where space allows, and keep icon choices distinct enough that users can tell governance, access, partners, service review, alerts, audit, assistant, inventory, orders, warehouse work, receiving, and shipments apart
- reduce over-telling: keep page guidance short, move repeated explanatory text into concise helper panels, and let headings, table names, status labels, and primary actions carry more of the meaning
- strengthen notification/alert semantics so critical work, action-needed work, reviewable history, and resolved history are visually and verbally distinct
- make first-run paths obvious for fresh merchants and warehouse operators: what to create first, what prerequisite is missing, and which page starts the work
- review quality-of-life details from a new user's perspective: unclear abbreviations, overly similar icons, noisy metrics, dead-end empty states, missing next actions, unclear disabled buttons, and status labels that require domain knowledge
- keep professional restraint: no marketing-style onboarding, no walls of instructional text, no fake production claims, and no customer-facing prototype wording on daily surfaces

Completion proof expected for V15.3:

- route-by-route human-comprehension audit in [Frontend V15 audit](frontend-v15-audit.md), including what was deleted or shortened as well as what was added
- focused tests for navigation labels/icon distinctions, alert severity language, and the first-run empty-state guidance that changed
- live browser tour with at least owner, merchant, warehouse, fresh merchant, fresh warehouse, notifications, assistant, service accountability, and a not-found detail state, recording console warnings/errors, horizontal overflow, unlabeled controls, and missing expected copy
- explicit note of any remaining UI/UX blocker that would still confuse a first-time user before moving into AI-agent or Pre-V16 work

Carry-forward UX commitments from the slow live review:

- no awkward-looking daily UI components may be treated as acceptable merely because they pass automated proof
- no missing, generic, or visually confusing icons on primary route, action, state, alert, assistant, empty, loading, error, or not-found surfaces
- no ghost alert count: the shell badge must reflect real unread work, hide or quiet at zero, and never appear as a sticky unexplained `1`
- assistant entry points must feel functionally sound even before the local AI agent lands: no clunky prefilled prompt behavior, clear review-only boundaries, useful deterministic triage, and obvious audit linkage
- the overall product experience should feel smooth: clear first action, fewer repeated destructive buttons, less seeded-data noise, better page hierarchy, and fewer walls of operational tables before priority work
- new users must be guided into connection: what to create first, who they need to connect with, what waits on another role, and where the next visible handoff appears
- future connected-user workflows must make relationships, package handoffs, inbound stock, fulfillment, service issues, and alerts feel linked across merchant, warehouse, and platform roles rather than isolated logs

### V15.4: Smooth Professional UX And Component Quality Gate

Planned scope:

- close the slow-review UI rough edges before deeper agent work: awkward-looking components, harsh dense tables, repeated destructive controls, bare not-found states, and pages that combine too many unrelated jobs
- rebalance owner/admin overview so platform users see attention-worthy work first and seeded/demo history does not dominate the first viewport
- split or visually group merchant inventory and merchant order workflows so create/setup, active work, evidence/history, and exception handling have clearer hierarchy
- make the warehouse console feel like a daily work queue first and a full operations ledger second, including a clearer single next item and less repetitive action noise
- move notification inbox/alert work ahead of preference administration, while keeping preferences available as secondary settings
- fix assistant input ergonomics so the prompt starts as a suggestion or placeholder instead of editable prefilled text that appends user input
- make not-found states human and recoverable, with clear likely cause and a role-appropriate return action
- recheck shared component quality: icons, buttons, tables, cards, badges, empty/loading/error/not-found surfaces, focus states, and narrow view behavior must look intentional rather than assembled

Completion proof expected for V15.4:

- focused frontend tests for assistant prompt ergonomics, notification inbox ordering, recoverable not-found states, and any split/grouped workflow surfaces
- component-level proof that primary empty/loading/error/not-found states and action buttons use distinct accessible icons where expected
- live browser slow-tour proof across owner/admin, merchant inventory/orders, warehouse console, notifications, assistant, service accountability, and not-found states with specific before/after notes
- proof that unread alert count has no ghost `1` behavior across zero, one, and multiple unread states
- documentation update in [Frontend V15 audit](frontend-v15-audit.md) listing each slow-review rough edge and whether it was fixed, intentionally deferred, or promoted to V15.5/Pre-V16
- `.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose` after the UI changes, plus publication-boundary proof that no new assets or copy introduce private context into `frontend/`

### V15.5: Connected User Workflows, Alerts, And Handoff Semantics

Planned scope:

- make user-to-user connection visible through the product: merchant requests, warehouse responses, package handoffs, inbound receiving, fulfillment exceptions, service issues, and platform governance should feel connected rather than like isolated tables
- strengthen alert semantics into relationship-aware work: who created the event, who needs to act next, what object it is tied to, and where the user should go
- connect package and shipment states to notifications and detail views so warehouse handoff, merchant review, failed/returned delivery, and package evidence have understandable cross-role trails
- connect merchant-warehouse relationships to first-run guidance, inbound stock, order allocation, service accountability, and alert surfaces so users understand why connection setup matters
- add or refine event copy for operational handoffs without pretending provider-backed delivery is production-ready before Pre-V16/V16
- define which connected-user alerts are required before the local AI agent can reliably suggest next actions, including package, relationship, inbound, fulfillment, exception, service, and account-lifecycle signals
- keep all alert and handoff data tenant-scoped, role-scoped, audited where appropriate, and safe for the future public `backend/` and `frontend/` repository

Completion proof expected for V15.5:

- backend and frontend tests proving connected alert/event visibility is role-scoped and tenant-scoped across merchant, warehouse, and platform users
- notification tests proving unread counts, alert severity, linked object navigation, and zero-state behavior across package, relationship, inbound, fulfillment, service, and account-lifecycle events
- live browser proof walking a connected scenario from merchant setup through warehouse receiving/fulfillment/package handoff, alert review, service accountability, and detail recovery
- documentation update explaining the connected-user alert model, what remains local/prototype-shaped, and what V16 must certify for production delivery
- publication-boundary proof that connected alerts do not expose private data, credentials, provider endpoints, or cross-tenant records

### V15.6: Performance, Indexing, And Operational Metrics

Planned scope:

- establish a measured local performance baseline before Pre-V16: backend endpoint latency, database query shape, frontend route load/render behavior, Docker resource use, and polling/background refresh pressure
- review high-traffic and high-risk database access paths for orders, inventory, warehouse work, notifications, outbox, audit, assistant interactions, service accountability, relationship governance, and detail pages
- add database indexes only where query plans and workload shape justify them; avoid speculative indexes that slow writes or complicate migrations without proof
- inspect backend repository/service calls for avoidable N+1 patterns, repeated reads, oversized payloads, missing pagination/filtering, and expensive dashboard aggregation
- review frontend performance for large tables/cards, route bundles, repeated polling, unnecessary re-renders, excessive DOM density, and slow first interaction on dense admin/merchant/warehouse routes
- define practical local metrics for the current architecture: representative seed size, response-time targets, query-count/query-plan evidence, bundle size, route render time, memory/CPU observations, and polling interval behavior
- decide whether any performance issue must be fixed before the local AI agent implementation, especially assistant context retrieval, connected alerts, and dashboard summaries that the agent may depend on
- document limits honestly: V15.6 optimizes the local/private architecture and creates Pre-V16 baselines, but it does not claim production-scale SaaS capacity

Completion proof expected for V15.6:

- tracked performance baseline report covering representative backend endpoints, frontend routes, database query plans, Docker resource observations, and polling/background refresh behavior
- backend tests or integration proof for any new indexes, pagination, query-shape changes, or service/repository optimizations
- Flyway migration proof for added indexes, including safe names, rollback notes where relevant, and confirmation that indexes do not target private/sensitive columns
- frontend tests or browser proof for route responsiveness, large-list rendering, no horizontal overflow/regression, and unchanged accessibility after performance-oriented UI changes
- before/after proof for each optimization: measured problem, change made, metric improved or tradeoff documented
- `.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose` plus any new performance proof script added under `scripts/quality/`
- documentation update explaining which bottlenecks remain for Pre-V16 stress/load testing and which are already closed by V15.6

### Pre-V16 Professionalization, Reliability, Stress, And Safety Gate

Planned scope:

- full-project gap review across backend, frontend, database, scripts, docs, containers, and repository boundaries
- professional repository and documentation review against the actual code
- V15.1 UI-signature review confirming user-facing copy, notification alerting, role-aware empty states, icons, favicon/app mark, and local visual assets are polished before deeper release hardening
- V15.2 local AI-agent review confirming agent boundaries, Docker runtime shape, model-off fallback, prompt/data boundaries, eval expectations, and audit proof are documented or explicitly blocked before release hardening
- quality-control proof for every supported local workflow
- maximum practical load and stress testing for the current architecture
- degraded-dependency behavior
- backup and restore proof
- dependency and container review
- backend test-tooling review confirming the Maven Surefire Mockito Java-agent configuration stays compatible with newer JDKs
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
- Mockito/JDK dynamic-agent warning from backend tests is resolved or documented with an explicit release-gate decision
- prototype-local account lifecycle behavior from V13 is either production-ready or explicitly blocked from production claims
- release blockers are tracked with owner, risk, and required proof

Pre-V16 CI todo:

- Add release-gate automation for maximum practical load and stress testing.
- Add backup and restore proof automation.
- Add dependency and container review automation.
- Keep the backend Surefire Mockito Java-agent configuration covered by the normal backend test gate.
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
- Write down deferred decisions: when a task says something is for "later", "future", "Pre-V16", "V16", "VInfinite", or a deliberate follow-up, record it in the proper durable place before closing the conversation. Use the active architecture doc for design choices, this roadmap for phase/version ownership, and an active `.notes/` page for working context that links back to the durable source. Do not leave future work only in chat.
- Any prototype touching authentication, authorization, password reset, access requests, notification delivery, tenant boundaries, data isolation, operational automation, payments, or production deployment must be labeled as prototype-local until Pre-V16 and V16 certify it as production-ready.
- Every phase must close documentation gaps against the actual code before being marked complete.
- Every phase must include proof matching its risk: backend tests, frontend tests, Playwright evidence, migration proof, script validation, stress/load proof, backup/restore proof, dependency/container review, or public-readiness checks as appropriate.
- Tests must evolve with the product: every newly added or materially changed feature needs focused automated coverage at the right layer, such as backend unit/integration tests, frontend unit/component tests, integration tests, or route-level Playwright proof. Coverage must prove the feature works with the surrounding components, flows, permissions, states, and visible UI without clunky transitions, broken handoffs, console errors, inaccessible controls, or confusing user-facing states. Update stale tests to assert the new durable behavior and user-facing contract instead of preserving obsolete fixture counts, incidental ordering, or implementation timing.
- CI intended for publication must be treated as production-shaped proof. The GitHub Actions workflow and visible run title must use the stable name `MerHouse Quality Gate`, not commit-message-as-process naming; CI must use generated masked credentials, keep password-reset token echo disabled, redact auth material from generated reports, avoid publishing raw proof artifacts, and expose only non-sensitive job flow, status, and proof identifiers in logs.
- Pre-V16 is the hard gate for full-system professionalization, stress testing, safety review, dependency/container review, backup/restore proof, publication-boundary leakage review, and release-blocker closure.
- VInfinite may collect future ideas, but backlog items do not override QC rules and do not imply production readiness.

## Change Quality Rule

Every meaningful change needs matching proof:

- backend changes: run backend tests and add focused tests when behavior changes
- frontend changes: run lint, build, Vitest, and Playwright when routed workflows change
- feature changes: add or update focused tests for the newly added behavior, including unit/component coverage where practical and integration or route proof when the behavior touches a flow; revise existing tests so they check the current invariant rather than stale fixture details
- database changes: prove Flyway migrations from an empty database
- script changes: parse scripts and update script documentation
- documentation changes: keep `README.md`, `docs/index.md`, affected docs, and active Obsidian notes aligned; run markdown link proof
- deferred or future work decisions: record the decision in the affected architecture doc, roadmap phase, or VInfinite backlog before closing
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
