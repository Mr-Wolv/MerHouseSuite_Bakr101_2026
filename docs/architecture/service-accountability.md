# Service Accountability

Service accountability records describe the operating agreement and review loop between merchants and warehouse providers.

The feature records coordination state only. It does not implement payment processing, banking, accounting, tax, credit-card, FX, or legal-contract workflows.

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

The shared `/service-accountability` route exposes agreement terms, SLA status, service statement totals, review records, and order import history according to user role and tenant.

## Role Boundaries

Platform roles can inspect records across tenants. Merchant users work with records for their merchant relationships. Warehouse operators work with records for their provider relationships.
