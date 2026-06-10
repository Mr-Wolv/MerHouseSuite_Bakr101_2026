# Service Accountability

Service accountability records describe the operating agreement and review loop between merchants and warehouse providers.

The feature records coordination state only. It does not implement payment processing, banking, accounting, tax, credit-card, FX, or legal-contract workflows.

It also does not store uploaded dispute attachments, enforce legal or business-calendar dispute deadlines, or run a statement-correction ledger. Current disputes, claims, and reviews preserve evidence as notes and linked local operational records. Statement totals are local service-unit records, and settlement state is a coordination marker rather than proof of payment collection.

## Core Records

- Service agreements tied to active merchant-warehouse relationships.
- Reference rate cards and service scopes.
- SLA policies for receiving, pick/pack, shipment handoff, and exception response.
- Service statements with line-level source references.
- SLA status read models for operational work.
- Disputes, operational claims, and service-review requests.
- Merchant order import batches with row-level validation and created-order links.

## API Surface

Service-accountability endpoints live under `/api/v1/service-accountability`.

Order import endpoints live under `/api/v1/orders/imports` because they create merchant orders.

## Frontend Surface

The shared `/service-accountability` route is attention-first. At-risk SLA work, open disputes, claims, and pending reviews appear before agreement, statement, and import history so each role can see what needs action or review before reading ledgers.

Merchant and platform roles can draft service-agreement terms against an active merchant-warehouse relationship and propose those terms for warehouse acceptance. Warehouse and platform roles can accept proposed terms. Review requests stay locked until an agreement is active, and fresh stakeholders see agreement-required guidance instead of a dead-end review action.

The route also exposes agreement terms, SLA status, service statement totals, review records, claims, disputes, and order import history according to user role and tenant.

Allowed owner/admin, merchant, and warehouse users can finalize draft service statements, mark finalized statements settled, resolve or reject open service disputes and claims, and approve or reject pending service reviews from the shared route. Support-admin and auditor users keep read-only evidence review mode on the same records.

Service-accountability action feedback must describe the latest attempted mutation only. Failed review-request retries clear earlier success banners before showing the error so live web and Android validation cannot mistake stale success for a newly created review.

Visible service-accountability copy must keep the boundary clear for operators: statements are not invoices, SLA hours are local policy clocks, and dispute evidence is note-and-record based until a future attachment or correction workflow is deliberately added.

Copied service-accountability text is normalized at both shared route submit points and API request DTO boundaries before validation: agreement titles and notes, statement notes and idempotency keys, line descriptions, dispute and claim reasons, review evidence, resolution outcomes, rate-card pass-through notes, and SLA pause notes trim surrounding whitespace while passwords and structured ids remain exact.

Dense service ledgers are bounded on the shared route. Statements, dispute/claim/review records, and merchant import history each show an explicit visible count with a reveal control for later records so local proof databases and Android WebView sessions remain responsive without hiding evidence.

## Role Boundaries

Owner and admin users can inspect and mutate service records across tenants. Support-admin and auditor users can inspect service records, including agreement SLA status read models, across tenants for review and troubleshooting, but they are not service-record mutators. Merchant users work with records for their merchant relationships. Warehouse operators work with records for their provider relationships.

Service-accountability alerts are local and recipient-scoped. Agreement proposals, acceptances, statement/dispute/claim/review events, and resolution steps notify the counterparty or involved parties without claiming provider-backed delivery.

## Proof

Focused backend and frontend tests cover agreement draft/propose/accept flow, statement finalization and settlement actions, active-agreement review gating, stale review-request feedback clearing, issue resolution actions, role/tenant scoping, support/auditor read-only mutation denial, copied service evidence normalization, dense service ledger disclosure, attention-first service signals, and fresh-stakeholder empty states. The V15.10 live browser proof moved fresh merchant and warehouse users from no service records to active agreement terms, then verified the counterparty notification and the service-accountability route without disabled dead-end review controls.
