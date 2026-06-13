# MerHouse Refactor Plan

> **Status:** Planning phase — no implementation has started.
> **Source:** Comprehensive codebase audit conducted 2026-06-13.
> **Scope:** All findings from the 8-phase audit converted into an actionable implementation roadmap.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Production Readiness Assessment](#2-production-readiness-assessment)
3. [Architecture Findings](#3-architecture-findings)
4. [Backend Findings](#4-backend-findings)
5. [Frontend Findings](#5-frontend-findings)
6. [Database Findings](#6-database-findings)
7. [Security Findings](#7-security-findings)
8. [Performance Findings](#8-performance-findings)
9. [Testing Findings](#9-testing-findings)
10. [Documentation Findings](#10-documentation-findings)
11. [DevOps / Infrastructure Findings](#11-devops--infrastructure-findings)
12. [Technical Debt Inventory](#12-technical-debt-inventory)
13. [Implementation Roadmap](#13-implementation-roadmap)

---

## 1. Executive Summary

MerHouse is a B2B fulfillment coordination platform connecting merchants, warehouse providers, and platform operators through a tenant-aware workflow. The codebase comprises 276 backend Java files, 65 frontend TypeScript files, 18 Flyway migrations, 62 PowerShell scripts, and 2 GitHub Actions workflows. V16.2 local certification is complete; V17 production activation is the active private deployment lane.

**Overall assessment:** The system is functionally complete for its current scope but carries structural debt that will make production ownership expensive if not addressed strategically. The most critical issues are not bugs — they are maintenance surface area and operational blind spots that will compound under real production load.

**Top 3 critical risks:**

1. **Authorization logic scattered across services** — `CurrentUserService` checks are interleaved with business logic in every service method, creating silent auth gaps and making security auditing nearly impossible.
2. **No pagination on core list endpoints** — every `findAll()` loads full result sets into memory; this will fail under production data volumes.
3. **Monolithic frontend pages** — single 1300+ line components hold all state, data fetching, and UI for entire role workspaces, making incremental improvement nearly impossible.

**Roadmap constraint:** The V17 refactoring rule in `docs/architecture/roadmap.md` (line 110) states: *"Do not refactor code, scripts, docs, CI, deployment configuration, or repository shape during production activation unless a concrete problem requires it."* Tier 0 items that fix concrete deployment blockers are acceptable now. Tier 1+ should wait until V17 deployment proof is complete or until a concrete defect forces the change.

---

## 2. Production Readiness Assessment

### Current Status

| Area | Status | Gap |
|------|--------|-----|
| Local development stack | Ready | None |
| Backend test suite | Ready | 36 test files pass |
| Frontend test suite | Ready | ~20 test files pass |
| CI quality gate | Ready | 6 parallel jobs + integration proof |
| Database migrations | Ready | 18 validated migrations |
| TLS on external endpoints | Pending V17 | Hugging Face + Vercel provide TLS |
| Rate limiting on public endpoints | Partial | Recovery + access requests throttled; login is not |
| Pagination on list endpoints | Not ready | Most list queries return unbounded results |
| Multi-tenant data isolation | Not ready | Application-level only, no Hibernate filter or RLS |
| Database backup/restore | Not ready | Manual pg_dump scripts only |
| Monitoring/metrics | Not ready | No Micrometer, no Prometheus, no alerting |
| Health/readiness probes | Partial | Simple health endpoint; no dependency checks |
| Incident response runbook | Not ready | Does not exist |
| API documentation | Ready | OpenAPI + Swagger UI |
| Signed Android APK | Ready | Manual dispatch workflow exists |
| SMTP email delivery | Partial | Code exists; V17 activation required |

### Production Blockers

These must be resolved before V17 deployment can be considered safe:

1. No pagination — OOM risk under production data volumes
2. No automatic tenant isolation — cross-tenant data leak risk
3. No backup/restore automation — data loss risk
4. No meaningful health/readiness endpoints — deployment orchestration will fail
5. Custom JWT implementation — unnecessary security risk vs. standard library
6. No rate limiting on login endpoint — brute-force attack vector

---

## 3. Architecture Findings

### ARCH-1: Authorization Not Separated from Business Logic

- **Severity:** Tier 0
- **Description:** Every service method performs its own authorization check via `CurrentUserService`. There is no centralized auth policy, no way to audit access control without reading every service method, and inconsistent enforcement patterns across services.
- **Why it matters:** A single missed check in any method gives unauthorized access. There is no way to verify the auth model is complete without line-by-line review.
- **Risk if left unresolved:** Silent authorization gaps leading to cross-tenant data exposure or privilege escalation.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/service/CurrentUserService.java`
  - `backend/src/main/java/com/merhouse/service/MerchantWarehouseService.java` (lines 91, 143, 208, 321, 397, 423, 453, 481, 509, 554)
  - `backend/src/main/java/com/merhouse/service/FulfillmentService.java` (lines 99, 134, 154, 212, 244, 262, 294, 344)
  - `backend/src/main/java/com/merhouse/service/InventoryService.java` (lines 63, 76, 86-91, 103, 111, 138, 174, 182)
  - `backend/src/main/java/com/merhouse/service/OrderService.java` (lines 69, 99, 131, 137, 159, 233, 279)
  - `backend/src/main/java/com/merhouse/service/ServiceAccountabilityService.java` (860 lines, multiple checks)
- **Recommended solution:** Create custom annotations (`@TenantScoped`, `@PlatformAdmin`, `@RequireRole`) processed by a Spring AOP aspect. Migrate authorization checks from service bodies to annotations on service methods or controller endpoints.
- **Estimated effort:** 5-7 days
- **Dependencies:** None (can be done independently)

### ARCH-2: No Package-by-Domain Organization

- **Severity:** Tier 2
- **Description:** All 39 services, 30 repositories, 18 controllers, and 107 DTOs live in flat packages by layer (`service/`, `repository/`, `web/`, `dto/`). This makes it hard to understand feature boundaries and creates coupling between unrelated features.
- **Why it matters:** When modifying the order domain, a developer must touch files across 4+ packages and distinguish order-related files from 200+ unrelated files.
- **Risk if left unresolved:** Increasing cognitive load and accidental coupling as features grow.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/service/` (39 files)
  - `backend/src/main/java/com/merhouse/repository/` (30 files)
  - `backend/src/main/java/com/merhouse/web/` (18 files)
  - `backend/src/main/java/com/merhouse/dto/` (107 files)
  - `backend/src/main/java/com/merhouse/entity/` (69 files)
- **Recommended solution:** Reorganize into domain packages: `domain/order/`, `domain/inventory/`, `domain/fulfillment/`, `domain/relationship/`, `domain/inbound/`, `domain/accountability/`, `domain/notification/`, `domain/assistant/`, `domain/admin/`, `domain/auth/`.
- **Estimated effort:** 7-10 days
- **Dependencies:** Should follow ARCH-1 (authorization extraction) to avoid moving auth logic twice.

### ARCH-3: Service Layer Violates Domain Boundaries

- **Severity:** Tier 1
- **Description:** `FulfillmentService` directly mutates `CustomerOrder.status` (line 177: `order.setStatus(OrderStatus.SHIPPED)`) instead of going through `OrderService`. `MerchantWarehouseService` (689 lines) handles both relationship lifecycle and inbound stock lifecycle. `ServiceAccountabilityService` (860 lines) handles agreements, statements, disputes, claims, and reviews.
- **Why it matters:** Cross-domain mutations create hidden coupling and make it impossible to reason about a domain in isolation.
- **Risk if left unresolved:** Changes in one domain silently break behavior in another; test isolation becomes impossible.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/service/FulfillmentService.java` (line 177: mutates order status)
  - `backend/src/main/java/com/merhouse/service/MerchantWarehouseService.java` (689 lines, two domains)
  - `backend/src/main/java/com/merhouse/service/ServiceAccountabilityService.java` (860 lines, five sub-domains)
- **Recommended solution:** Extract inbound stock lifecycle into `InboundStockService`. Extract accountability sub-domains into `ServiceAgreementService`, `ServiceStatementService`, `ServiceDisputeService`, `ServiceClaimService`, `ServiceReviewService`. Introduce domain events for cross-domain mutations (e.g., `FulfillmentService` publishes `ShipmentCreated` event; `OrderService` subscribes and updates order status).
- **Estimated effort:** 5-7 days
- **Dependencies:** Can be done independently of ARCH-1 but should precede ARCH-2.

### ARCH-4: Outbox Pattern Implemented Synchronously Within Transaction

- **Severity:** Tier 2
- **Description:** `OutboxService.publish()` inserts an outbox event row within the same transaction as the business operation. If the outbox insert fails, the business operation rolls back. The outbox processor runs on a 10-second fixed-delay schedule with no backpressure awareness.
- **Why it matters:** The outbox pattern is meant to guarantee eventual delivery even if the primary operation's side effects fail. Synchronous in-transaction insertion partially defeats this purpose.
- **Risk if left unresolved:** Outbox insert failure causes business operation rollback; no retry for transient outbox failures within the same transaction.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/service/OutboxService.java` (lines 17-24)
  - `backend/src/main/java/com/merhouse/service/OutboxProcessor.java` (lines 37-46)
- **Recommended solution:** The current implementation is acceptable for V17 (the event row is in the same transaction, which guarantees at-least-once persistence). For post-V17, consider a dedicated outbox consumer with separate transaction boundaries and backpressure-aware scheduling.
- **Estimated effort:** 5-7 days (post-V17)
- **Dependencies:** None

### ARCH-5: No API Versioning Strategy Beyond URL Prefix

- **Severity:** Tier 3
- **Description:** All endpoints use `/api/v1/` prefix. There is no strategy for introducing v2 endpoints while maintaining v1 backward compatibility.
- **Why it matters:** Breaking API changes in production will break existing consumers without a migration path.
- **Risk if left unresolved:** Forced breaking changes or duplicated endpoint maintenance.
- **Affected files/modules:** All 18 controllers in `backend/src/main/java/com/merhouse/web/`
- **Recommended solution:** Document the API versioning policy: `/api/v1/` is stable; new versions introduce `/api/v2/` with a deprecation window. Consider header-based versioning for finer granularity.
- **Estimated effort:** 2-3 days (documentation + convention)
- **Dependencies:** None

---

## 4. Backend Findings

### BE-1: No Pagination on Data-Loading Endpoints

- **Severity:** Tier 0
- **Description:** Every list endpoint returns full unbounded collections. Only notifications and outbox use `PageRequest`. Under production data volumes, every list query becomes a memory bomb.
- **Why it matters:** A merchant with 10,000 orders will cause the order list endpoint to load all 10,000 rows (with deep entity graphs) into memory in a single request.
- **Risk if left unresolved:** Out-of-memory errors, slow API responses, database connection exhaustion.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/repository/CustomerOrderRepository.java` (line 11: `findByMerchantId` returns `List`)
  - `backend/src/main/java/com/merhouse/service/InventoryService.java` (line 95: `findAll()`)
  - `backend/src/main/java/com/merhouse/service/MerchantWarehouseService.java` (lines 143-158: all relationships)
  - `backend/src/main/java/com/merhouse/service/FulfillmentService.java` (lines 131-149: all allocations)
  - `backend/src/main/java/com/merhouse/service/OrderService.java` (lines 136-154: all orders)
  - All repository interfaces returning `List<>`
- **Recommended solution:** Introduce a `PageRequest` wrapper. Convert all list endpoints to accept `page`, `size`, and optional `sort` parameters. Return `Page<T>` responses with total count and navigation metadata. Start with the highest-volume endpoints: orders, allocations, inventory, relationships.
- **Estimated effort:** 3-5 days
- **Dependencies:** None (can be done independently); frontend will need corresponding changes

### BE-2: DTO Proliferation with No Behavior

- **Severity:** Tier 2
- **Description:** 107 DTO files for 69 entities — many are 1:1 mappings with no behavior beyond data transfer. Static `from()` factory methods on DTOs create entity-to-DTO coupling throughout the codebase.
- **Why it matters:** Every entity change requires updating the matching DTO and its `from()` method. The 107-file surface area increases maintenance cost.
- **Risk if left unresolved:** Growing maintenance burden as DTOs and entities diverge.
- **Affected files/modules:** `backend/src/main/java/com/merhouse/dto/` (107 files)
- **Recommended solution:** This is a Spring Boot convention and acceptable for the current scope. Post-V17, consider a mapping framework (MapStruct) to reduce boilerplate, or generate DTOs from OpenAPI spec.
- **Estimated effort:** 5-7 days (if MapStruct adoption)
- **Dependencies:** Post-V17 only; not a deployment blocker

### BE-3: ProductionSafetyConfig Uses @Value Instead of @ConfigurationProperties

- **Severity:** Tier 2
- **Description:** `ProductionSafetyConfig` has 21 `@Value` parameters in its constructor, making it difficult to reason about configuration groups and impossible to use with IDE autocompletion or property validation.
- **Why it matters:** 21 stringly-typed parameters are error-prone and resist refactoring.
- **Risk if left unresolved:** Configuration errors introduced silently when adding new safety checks.
- **Affected files/modules:** `backend/src/main/java/com/merhouse/config/ProductionSafetyConfig.java` (lines 14-62)
- **Recommended solution:** Create typed `@ConfigurationProperties` classes: `MerhouseAuthProperties`, `MerhouseDeploymentProperties`, `MerhouseEmailProperties`, `MerhouseAgentProperties`. Inject these into `ProductionSafetyConfig` instead of individual `@Value` parameters.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### BE-4: FulfillmentException.status Is a String, Not an Enum

- **Severity:** Tier 3
- **Description:** `FulfillmentException.status` uses string literals ("OPEN", "RESOLVED") instead of a typed enum, unlike every other status field in the system.
- **Why it matters:** Inconsistency with the rest of the codebase. String comparisons are typo-prone and not compile-time checked.
- **Risk if left unresolved:** Silent bugs from typos in status strings.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/service/FulfillmentService.java` (lines 271, 298)
  - `backend/src/main/java/com/merhouse/entity/FulfillmentException.java`
- **Recommended solution:** Create `FulfillmentExceptionStatus` enum. Add a Flyway migration if the database column needs a CHECK constraint update.
- **Estimated effort:** 1 day
- **Dependencies:** None

### BE-5: No Optimistic Locking on Hot Entities

- **Severity:** Tier 1
- **Description:** Entities like `WarehouseInventory`, `CustomerOrder`, and `FulfillmentAllocation` have no `@Version` field. Concurrent modifications will silently overwrite each other (last-write-wins).
- **Why it matters:** Two warehouse operators processing the same allocation simultaneously could both advance it to PACKED, or two allocation operations could reserve the same inventory stock.
- **Risk if left unresolved:** Data corruption under concurrent access in production.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/entity/WarehouseInventory.java`
  - `backend/src/main/java/com/merhouse/entity/CustomerOrder.java`
  - `backend/src/main/java/com/merhouse/entity/FulfillmentAllocation.java`
  - `backend/src/main/java/com/merhouse/entity/InventoryItem.java`
- **Recommended solution:** Add `@Version Long version` to hot entities. Add Flyway migration to add `version` columns with default 0. Handle `ObjectOptimisticLockingFailureException` in the API exception handler (already partially done in `ApiExceptionHandler.java` line 44).
- **Estimated effort:** 2-3 days
- **Dependencies:** Should be done after BE-1 (pagination) to avoid merge conflicts in repository layer

### BE-6: ShipmentPackage.status Is a String, Not an Enum

- **Severity:** Tier 3
- **Description:** Same pattern as BE-4. `ShipmentPackage.status` uses string "HANDED_OFF" and `ShipmentPackageEvent.eventType` uses strings "PACKED", "HANDED_OFF".
- **Why it matters:** Inconsistency and typo risk.
- **Risk if left unresolved:** Silent bugs from string typos.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/service/FulfillmentService.java` (lines 425, 427, 430)
  - `backend/src/main/java/com/merhouse/entity/ShipmentPackage.java`
  - `backend/src/main/java/com/merhouse/entity/ShipmentPackageEvent.java`
- **Recommended solution:** Create `ShipmentPackageStatus` and `ShipmentPackageEventType` enums.
- **Estimated effort:** 1 day
- **Dependencies:** None

---

## 5. Frontend Findings

### FE-1: Monolithic API Client (742 lines)

- **Severity:** Tier 1
- **Description:** `api/client.ts` is 742 lines containing every API call as methods on a single `api` object. The companion `api/types.ts` is 1043 lines with all type definitions in one file.
- **Why it matters:** Any API change requires editing the same large file, creating merge conflicts. The 1043-line types file has no domain grouping.
- **Risk if left unresolved:** Developer friction, merge conflicts, slow onboarding.
- **Affected files/modules:**
  - `frontend/src/api/client.ts` (742 lines)
  - `frontend/src/api/types.ts` (1043 lines)
- **Recommended solution:** Split into domain modules: `api/modules/auth.ts`, `api/modules/inventory.ts`, `api/modules/orders.ts`, `api/modules/fulfillment.ts`, `api/modules/accountability.ts`, `api/modules/notification.ts`, `api/modules/assistant.ts`, `api/modules/admin.ts`. Each module co-locates its API calls and types. The shared `request<T>` function and `ApiError` class remain in `api/client.ts`.
- **Estimated effort:** 3-4 days
- **Dependencies:** None

### FE-2: Monolithic Page Components (5,600+ lines total)

- **Severity:** Tier 1
- **Description:** Five page files dominate the frontend:
  - `AdminPages.tsx` — 1509 lines, 7 page components in one file
  - `WarehousePage.tsx` — 1293 lines, single component with 15+ state variables
  - `MerchantPages.tsx` — 1336 lines
  - `ServiceAccountabilityPage.tsx` — 800 lines
  - `OperationalDetailPages.tsx` — 675 lines
- **Why it matters:** These files mix data fetching, form state, conditional rendering, and inline error handling. They cannot be incrementally improved without editing the entire monolith.
- **Risk if left unresolved:** Growing complexity, merge conflicts, difficulty adding features.
- **Affected files/modules:**
  - `frontend/src/pages/AdminPages.tsx`
  - `frontend/src/pages/WarehousePage.tsx`
  - `frontend/src/pages/MerchantPages.tsx`
  - `frontend/src/pages/ServiceAccountabilityPage.tsx`
  - `frontend/src/pages/OperationalDetailPages.tsx`
- **Recommended solution:** One file per page component. Extract reusable sub-components for tables, forms, and panels. Create custom hooks for data fetching (see FE-3).
- **Estimated effort:** 8-12 days total (2-3 days per major page)
- **Dependencies:** FE-3 (useApi hook) should be done first to provide the extraction target

### FE-3: No Custom Data-Fetching Hook

- **Severity:** Tier 1
- **Description:** Every page component duplicates the same pattern: `useState` for data/loading/error, `useEffect` for fetching, cleanup with `active` flag, `ApiError` handling. This pattern appears at least 15 times across page components.
- **Why it matters:** Every new page re-implements the same boilerplate. Error handling patterns drift across pages.
- **Risk if left unresolved:** Inconsistent error handling, developer friction, bugs from missed cleanup.
- **Affected files/modules:**
  - `frontend/src/pages/AdminPages.tsx` (lines 54-71, 73-100, etc.)
  - `frontend/src/pages/WarehousePage.tsx` (lines 69-100)
  - `frontend/src/pages/MerchantPages.tsx` (multiple)
  - `frontend/src/pages/ServiceAccountabilityPage.tsx` (multiple)
  - `frontend/src/pages/OperationalDetailPages.tsx` (multiple)
  - `frontend/src/pages/AssistantPage.tsx`
  - `frontend/src/pages/AccountPage.tsx`
  - `frontend/src/features/notifications/NotificationCenterPage.tsx`
- **Recommended solution:** Create a `useApi<T>(fetcher, deps?)` hook that returns `{ data, loading, error, refetch }`. Encapsulate the `active` flag cleanup, `ApiError` normalization, and loading state management. Then create domain-specific hooks: `useAdminSummary()`, `useWarehouses()`, `useOrders(merchantId)`, etc.
- **Estimated effort:** 2-3 days
- **Dependencies:** None (should be done before FE-2)

### FE-4: Form State Managed via Per-Record Draft Objects

- **Severity:** Tier 2
- **Description:** `WarehousePage.tsx` manages form drafts as `Record<string, ShipmentDraft>`, `Record<string, ReceivingDraft>`, and `Record<string, AdjustmentDraft>` indexed by entity ID. This pattern is repeated in other pages.
- **Why it matters:** Draft management is tightly coupled to the page component and cannot be reused. The Record<string, Draft> pattern is error-prone when entities are added or removed.
- **Risk if left unresolved:** Form bugs as pages grow; duplicated form logic across pages.
- **Affected files/modules:**
  - `frontend/src/pages/WarehousePage.tsx` (lines 60-62)
  - `frontend/src/pages/AdminPages.tsx` (multiple draft states)
  - `frontend/src/pages/MerchantPages.tsx` (order creation forms)
- **Recommended solution:** Create a `useFormDraft<T>(initialValue)` hook that manages draft state, validation, and reset. Optionally pair with `react-hook-form` for complex forms.
- **Estimated effort:** 2-3 days
- **Dependencies:** None

### FE-5: Auth Token Key Uses Legacy Name

- **Severity:** Tier 3
- **Description:** `AuthContext.tsx` stores the JWT token in `localStorage` with key `warehouse-console-token` — a legacy name from before the project was named MerHouse.
- **Why it matters:** Minor inconsistency; could confuse debugging sessions where the key name matters.
- **Risk if left unresolved:** None functional; cosmetic inconsistency.
- **Affected files/modules:** `frontend/src/auth/AuthContext.tsx` (line 7)
- **Recommended solution:** Rename to `merhouse-auth-token`. Add migration logic that reads the old key, writes to the new key, and deletes the old key.
- **Estimated effort:** 0.5 days
- **Dependencies:** None

### FE-6: Notification Polling Ignores Tab Visibility

- **Severity:** Tier 2
- **Description:** `AppLayout.tsx` polls the notification summary endpoint every 15 seconds regardless of whether the browser tab is visible or focused.
- **Why it matters:** Background tabs generate unnecessary API traffic. 10 idle tabs = 10 requests every 15 seconds.
- **Risk if left unresolved:** Wasted bandwidth and server resources; potential rate-limit triggering.
- **Affected files/modules:** `frontend/src/components/AppLayout.tsx` (lines 73-75)
- **Recommended solution:** Use the `visibilitychange` API to pause polling when the tab is hidden and resume when visible. Optionally switch to SSE or WebSocket for push-based notification delivery.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### FE-7: No Route-Based Code Splitting

- **Severity:** Tier 2
- **Description:** All page components are statically imported in `App.tsx`. The entire frontend bundle loads upfront regardless of which page the user visits.
- **Why it matters:** The bundle will grow as pages are added. Initial page load time increases linearly with bundle size.
- **Risk if left unresolved:** Slow initial load on mobile and low-bandwidth connections.
- **Affected files/modules:** `frontend/src/App.tsx` (lines 6-32)
- **Recommended solution:** Use `React.lazy()` + `Suspense` for route-level code splitting. Each page becomes a separate chunk loaded on demand.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### FE-8: Frontend Types Manually Mirror Backend DTOs

- **Severity:** Tier 2
- **Description:** `api/types.ts` (1043 lines) manually mirrors backend DTOs. Any backend DTO change requires manual frontend type update — no automated contract check exists.
- **Why it matters:** Type drift between frontend and backend causes runtime errors that TypeScript cannot catch at compile time.
- **Risk if left unresolved:** Silent runtime type mismatches after backend changes.
- **Affected files/modules:**
  - `frontend/src/api/types.ts`
  - All frontend page components consuming these types
- **Recommended solution:** Generate TypeScript types from the backend OpenAPI spec using `openapi-typescript` or `openapi-generator-cli`. Add a CI step that verifies generated types match the current spec.
- **Estimated effort:** 5-7 days
- **Dependencies:** Post-V17; requires stable OpenAPI spec

### FE-9: Ngrok-Specific Header in Production API Client

- **Severity:** Tier 3
- **Description:** `api/client.ts` includes an `ngrok-skip-browser-warning` header when the API base URL matches ngrok domains. This was needed for a previous deployment lane that has been abandoned.
- **Why it matters:** Legacy code that no longer serves a purpose. The roadmap explicitly states the ngrok lane is replaced.
- **Risk if left unresolved:** Confusion for new developers; unnecessary code in the request path.
- **Affected files/modules:** `frontend/src/api/client.ts` (lines 88, 107-118, 124-126)
- **Recommended solution:** Remove the ngrok header detection and injection. If ngrok is ever needed again, it can be added as a development-only plugin.
- **Estimated effort:** 0.5 days
- **Dependencies:** None

---

## 6. Database Findings

### DB-1: No Automatic Multi-Tenant Data Isolation

- **Severity:** Tier 0
- **Description:** The system uses a shared database with application-level tenant filtering via `CurrentUserService`. There is no row-level security (RLS), no Hibernate `@Filter` for automatic tenant scoping, and no tenant-id check enforced by default in repository queries. A single missed filter in a new query leaks cross-tenant data.
- **Why it matters:** Every new repository method must manually include tenant filtering. A forgotten `WHERE tenant_id = ?` clause returns data from all tenants.
- **Risk if left unresolved:** Cross-tenant data leak in production.
- **Affected files/modules:**
  - All 30 repository interfaces in `backend/src/main/java/com/merhouse/repository/`
  - `backend/src/main/java/com/merhouse/service/CurrentUserService.java`
  - `backend/src/main/resources/application.properties`
- **Recommended solution:** Add Hibernate `@FilterDef` and `@Filter` on tenant-scoped entities. Enable the filter automatically in a Spring `@Repository` aspect or OpenSessionInView interceptor that reads the current tenant from `SecurityContextHolder`. Existing queries continue to work; the filter adds an automatic `AND tenant_id = ?` condition.
- **Estimated effort:** 3-4 days
- **Dependencies:** None

### DB-2: N+1 Query Risk from @OneToMany Without @BatchSize

- **Severity:** Tier 1
- **Description:** Entity `@OneToMany` collections with `FetchType.LAZY` have no `@BatchSize` annotation. When Hibernate loads a collection of parent entities and then accesses their lazy collections, it issues one SELECT per parent per collection — the N+1 problem.
- **Why it matters:** Loading 50 orders with their allocations triggers 50+1 queries instead of 2.
- **Risk if left unresolved:** Severe performance degradation as data volume grows.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/entity/CustomerOrder.java` (lines 40-47: items, allocations, backorders)
  - `backend/src/main/java/com/merhouse/entity/FulfillmentAllocation.java` (line 57: items)
  - `backend/src/main/java/com/merhouse/entity/Shipment.java` (line 51: packages)
- **Recommended solution:** Add `@BatchSize(size = 50)` on all `@OneToMany` collections. This makes Hibernate load collections in batches of 50 instead of one-by-one.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### DB-3: No Flyway Migration Rollback Testing

- **Severity:** Tier 1
- **Description:** Flyway migrations are validated forward (empty DB → current schema) but there is no automated test verifying that migrations can be rolled back or that the schema is consistent after a partial failure.
- **Why it matters:** A failed production migration with no rollback path means downtime.
- **Risk if left unresolved:** Extended downtime from failed migration with no rollback plan.
- **Affected files/modules:** `backend/src/main/resources/db/migration/` (18 files)
- **Recommended solution:** Add a CI step that applies all migrations to an empty Testcontainers database, then verifies schema consistency. Document the rollback strategy for each migration (Flyway Community edition doesn't support automatic `undo`, so document manual rollback scripts for critical migrations).
- **Estimated effort:** 2-3 days
- **Dependencies:** None

### DB-4: JSONB Attributes Column Has No Schema Validation

- **Severity:** Tier 2
- **Description:** `InventoryItem.attributes` is `Map<String, Object>` mapped to JSONB. There is no schema validation — any JSON structure is accepted. Similarly, `Shipment.metadata` is unvalidated JSONB.
- **Why it matters:** Invalid or inconsistent attribute data cannot be queried reliably. A misnamed key or wrong type breaks filtering.
- **Risk if left unresolved:** Data quality degradation; unreliable JSONB queries.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/entity/InventoryItem.java` (line 43)
  - `backend/src/main/java/com/merhouse/entity/Shipment.java` (line 49)
- **Recommended solution:** Post-V17, add JSONB schema validation using PostgreSQL `CHECK` constraints with `jsonb_path_exists`, or validate structure in the service layer before persisting.
- **Estimated effort:** 2-3 days
- **Dependencies:** Post-V17

### DB-5: Deep EntityGraph Paths Cause Large JOINs

- **Severity:** Tier 2
- **Description:** `CustomerOrderRepository.findWithDetailsById` loads merchant + items + items.inventoryItem + allocations + allocations.items + allocations.items.inventoryItem + allocations.warehouse + backorders + backorders.inventoryItem in a single query. This produces a large Cartesian product.
- **Why it matters:** For orders with many items and allocations, the result set multiplies rapidly. An order with 10 items × 3 allocations × 2 allocation items = 60 rows for a single order.
- **Risk if left unresolved:** Slow single-order queries under production data volumes.
- **Affected files/modules:** `backend/src/main/java/com/merhouse/repository/CustomerOrderRepository.java` (lines 15-26)
- **Recommended solution:** Consider splitting the deep fetch into multiple targeted queries (batch-load allocations separately from items). Use `@BatchSize` as an interim measure. For the single-order detail page, the current approach is acceptable; the problem emerges in list queries that call `get(order.getId())` in a loop (see PERF-1).
- **Estimated effort:** 2-3 days
- **Dependencies:** BE-1 (pagination) addresses the list-query case

---

## 7. Security Findings

### SEC-1: Custom JWT Implementation Instead of Standard Library

- **Severity:** Tier 0
- **Description:** `JwtService.java` implements JWT creation and validation manually using `Mac`/`SecretKeySpec` instead of a battle-tested library like `nimbus-jose-jwt` or `spring-security-oauth2-resource-server`. The implementation includes constant-time comparison and minimum secret length, but a custom JWT library is an unnecessary security risk.
- **Why it matters:** Standard libraries handle edge cases (timing attacks, algorithm confusion, key rotation) that custom implementations often miss. Security auditors flag custom crypto.
- **Risk if left unresolved:** Security audit failure; potential vulnerability in edge cases not covered by the custom implementation.
- **Affected files/modules:** `backend/src/main/java/com/merhouse/security/JwtService.java` (131 lines)
- **Recommended solution:** Replace with `spring-boot-starter-oauth2-resource-server` + Nimbus JOSE. The migration is straightforward: configure `jwt.secretKey` in application properties, use `JwtDecoder` and `JwtEncoder` beans, and adapt `JwtAuthenticationFilter` to use the standard decoder.
- **Estimated effort:** 2-3 days
- **Dependencies:** None

### SEC-2: No Rate Limiting on Login Endpoint

- **Severity:** Tier 0
- **Description:** The login endpoint (`/api/v1/auth/login`) has no rate limiting. Recovery and access-request endpoints have throttling (5 requests per 60 minutes, 3 requests per 24 hours), but login does not.
- **Why it matters:** Brute-force password attacks can attempt unlimited login combinations.
- **Risk if left unresolved:** Credential stuffing and brute-force attacks.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/web/AuthController.java`
  - `backend/src/main/java/com/merhouse/config/SecurityConfig.java`
- **Recommended solution:** Add rate limiting to the login endpoint. Options: Spring interceptors with a concurrent map or Redis counter, bucket4j library, or nginx-level rate limiting. Start with an in-memory rate limiter (e.g., 5 failed attempts per email per 15 minutes) and upgrade to Redis-backed for multi-instance deployments.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### SEC-3: No Token Refresh or Rotation Mechanism

- **Severity:** Tier 1
- **Description:** JWTs expire after 1 hour (`merhouse.auth.jwt-expires-seconds=3600`). After expiry, the user must re-authenticate. There is no refresh token mechanism.
- **Why it matters:** Users are logged out every hour, which is a poor experience for long-running sessions. Refresh tokens allow short-lived access tokens with seamless renewal.
- **Risk if left unresolved:** User frustration; increased login endpoint load from frequent re-authentication.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/security/JwtService.java` (line 56)
  - `backend/src/main/resources/application.properties` (line 30)
  - `frontend/src/auth/AuthContext.tsx`
- **Recommended solution:** Implement refresh tokens: issue a long-lived refresh token alongside the access token. Store refresh tokens in the database with rotation (each use generates a new refresh token and invalidates the old one). Add a `/api/v1/auth/refresh` endpoint.
- **Estimated effort:** 3-5 days
- **Dependencies:** SEC-1 (standard JWT library) should be done first

### SEC-4: CSRF Disabled

- **Severity:** Tier 3
- **Description:** CSRF protection is explicitly disabled in `SecurityConfig.java` (line 32: `csrf -> csrf.disable()`).
- **Why it matters:** CSRF is irrelevant for a stateless JWT API consumed by a SPA with `Authorization: Bearer` headers. The CORS configuration does not allow credentials. This is an acceptable design decision but should be documented.
- **Risk if left unresolved:** None if the API remains purely JWT-authenticated with no cookie-based sessions.
- **Affected files/modules:** `backend/src/main/java/com/merhouse/config/SecurityConfig.java` (line 32)
- **Recommended solution:** Add a comment in `SecurityConfig.java` explaining why CSRF is disabled. No code change needed.
- **Estimated effort:** 0.5 days
- **Dependencies:** None

### SEC-5: CORS Credentials Disabled

- **Severity:** Tier 3
- **Description:** `SecurityConfig.java` (line 61) sets `allowCredentials(false)`. Cookies will not flow cross-origin; the app uses Bearer tokens instead.
- **Why it matters:** This is an intentional design choice but limits future cookie-based patterns (e.g., HttpOnly refresh token cookies).
- **Risk if left unresolved:** Cannot use HttpOnly cookies for token storage without CORS credential support.
- **Affected files/modules:** `backend/src/main/java/com/merhouse/config/SecurityConfig.java` (line 61)
- **Recommended solution:** If SEC-3 (refresh tokens) adopts HttpOnly cookie storage for refresh tokens, this will need to be changed to `allowCredentials(true)` with specific allowed origins (not wildcard).
- **Estimated effort:** Included in SEC-3
- **Dependencies:** SEC-3

---

## 8. Performance Findings

### PERF-1: OrderService.findAll() Triggers N+1 at Service Level

- **Severity:** Tier 1
- **Description:** `OrderService.findAll()` (line 143) calls `get(order.getId())` in a stream, which triggers `findWithDetailsById` for each order. This means loading 50 orders generates 50 separate database queries with deep entity graphs.
- **Why it matters:** This is the worst-case N+1 pattern: each iteration loads the full order graph including items, allocations, backorders, and their nested relationships.
- **Risk if left unresolved:** Severe latency on the order list endpoint under production data volumes.
- **Affected files/modules:** `backend/src/main/java/com/merhouse/service/OrderService.java` (lines 136-154)
- **Recommended solution:** Create a dedicated `findAllWithMerchant()` query that loads only the fields needed for list view (no deep entity graph). Reserve `findWithDetailsById` for the single-order detail page.
- **Estimated effort:** 1-2 days
- **Dependencies:** BE-1 (pagination) will reduce the impact but the N+1 pattern should still be fixed

### PERF-2: No Application Metrics

- **Severity:** Tier 0
- **Description:** There are no application-level metrics, no Micrometer integration, no Prometheus endpoint, and no alerting. The only observability is the simple health endpoint and outbox alert records.
- **Why it matters:** Production incidents cannot be detected or diagnosed without metrics. "Is the system slow?" is unanswerable.
- **Risk if left unresolved:** Blind production operation; incidents discovered only through user complaints.
- **Affected files/modules:**
  - `backend/pom.xml` (no micrometer dependency)
  - `backend/src/main/resources/application.properties` (no metrics config)
  - `backend/src/main/java/com/merhouse/web/HealthController.java`
- **Recommended solution:** Add `micrometer-registry-prometheus` dependency. Expose `/actuator/prometheus` endpoint. Instrument key operations: order creation, allocation, inventory operations, outbox processing. Add Grafana dashboard templates.
- **Estimated effort:** 3-5 days
- **Dependencies:** None

### PERF-3: No Connection Pool Tuning

- **Severity:** Tier 2
- **Description:** No HikariCP configuration in `application.properties`. The application relies on Spring Boot defaults (10 connections, 30-second idle timeout).
- **Why it matters:** Default pool size may be too small for concurrent warehouse operations or too large for the Hugging Face Docker Space memory constraints.
- **Risk if left unresolved:** Connection exhaustion under load or wasted resources from oversized pool.
- **Affected files/modules:** `backend/src/main/resources/application.properties`
- **Recommended solution:** Add explicit HikariCP configuration: `spring.datasource.hikari.maximum-pool-size`, `minimum-idle`, `idle-timeout`, `connection-timeout`. Tune based on load test results.
- **Estimated effort:** 1 day
- **Dependencies:** PERF-2 (metrics) to measure pool behavior

### PERF-4: No Frontend Bundle Size Tracking

- **Severity:** Tier 2
- **Description:** `vite.config.ts` sets `chunkSizeWarningLimit: 650` (line 8), acknowledging bundle size concerns. There is no CI enforcement of bundle budgets.
- **Why it matters:** Bundle size directly impacts initial load time, especially on mobile. Without tracking, size creeps upward silently.
- **Risk if left unresolved:** Slow initial page load on mobile and low-bandwidth connections.
- **Affected files/modules:**
  - `frontend/vite.config.ts` (line 8)
  - `frontend/package.json` (no bundle analysis scripts)
- **Recommended solution:** Add `rollup-plugin-visualizer` for bundle analysis. Add a CI step that fails if the total bundle size exceeds a budget. Set initial budget at current size + 10%.
- **Estimated effort:** 1 day
- **Dependencies:** None

---

## 9. Testing Findings

### TEST-1: No Authorization Boundary Tests

- **Severity:** Tier 1
- **Description:** No test verifies that tenant A cannot access tenant B's data. No test verifies that a MERCHANT user cannot access ADMIN endpoints. The authorization model is untested at the integration level.
- **Why it matters:** Authorization is the system's primary security boundary. Without tests, regressions are caught only by manual review.
- **Risk if left unresolved:** Silent authorization regressions after refactoring.
- **Affected files/modules:**
  - All 36 backend test files in `backend/src/test/java/com/merhouse/`
  - `backend/src/test/java/com/merhouse/config/SecurityConfigTest.java` (52 lines, minimal)
- **Recommended solution:** Add `@WebMvcTest` sliced controller tests that verify each endpoint's authorization rules. Test scenarios: unauthenticated, wrong tenant, wrong role, correct access. Target the most sensitive endpoints first: order management, inventory mutation, user management, admin endpoints.
- **Estimated effort:** 5-7 days
- **Dependencies:** ARCH-1 (authorization extraction) would change the implementation but the test contract should be stable

### TEST-2: No Concurrency Tests for Inventory Allocation

- **Severity:** Tier 1
- **Description:** `InventoryService.reserveAvailableAcrossWarehouses` and `adjustReservedStock` use pessimistic write locks but have no test verifying correct behavior under concurrent access.
- **Why it matters:** Race conditions in inventory allocation could lead to over-reservation (selling more stock than exists).
- **Risk if left unresolved:** Data corruption under concurrent allocation attempts.
- **Affected files/modules:**
  - `backend/src/main/java/com/merhouse/service/InventoryService.java` (lines 208-233, 259-301)
  - `backend/src/test/java/com/merhouse/service/InventoryServiceTest.java`
- **Recommended solution:** Add a Testcontainers-based integration test that runs two concurrent allocation attempts for the same inventory item and verifies that the total reserved quantity does not exceed the available quantity.
- **Estimated effort:** 2-3 days
- **Dependencies:** None

### TEST-3: No Accessibility Validation Tests

- **Severity:** Tier 2
- **Description:** No automated accessibility testing (axe-core, pa11y) is integrated into the test suite or E2E tests.
- **Why it matters:** Accessibility is a legal and ethical requirement. Without automated checks, regressions are caught only by manual testing.
- **Risk if left unresolved:** Accessibility regressions go undetected.
- **Affected files/modules:**
  - `frontend/tests/e2e/` (Playwright tests)
  - `frontend/playwright.config.ts`
- **Recommended solution:** Integrate `@axe-core/playwright` into the Playwright E2E suite. Add an accessibility scan step to the browser tour and cross-surface checks.
- **Estimated effort:** 2-3 days
- **Dependencies:** None

### TEST-4: No Network Failure Simulation Tests

- **Severity:** Tier 2
- **Description:** Frontend tests mock successful API responses. No test verifies behavior when the API is unreachable, returns 500, or times out.
- **Why it matters:** Network failures are the most common production issue. The frontend must degrade gracefully.
- **Risk if left unresolved:** Frontend crashes or shows blank screens during API outages.
- **Affected files/modules:**
  - `frontend/src/api/client.ts`
  - All page component test files
- **Recommended solution:** Add unit tests that simulate API failures (network error, 500, 403, timeout) and verify that error states are displayed correctly.
- **Estimated effort:** 2-3 days
- **Dependencies:** None

### TEST-5: Playwright E2E Coverage Unknown

- **Severity:** Tier 2
- **Description:** Playwright E2E tests exist in `frontend/tests/e2e/` but the coverage scope is not documented or measured.
- **Why it matters:** Without knowing what E2E covers, gaps are invisible.
- **Risk if left unresolved:** False confidence in E2E coverage.
- **Affected files/modules:** `frontend/tests/e2e/`
- **Recommended solution:** Audit E2E test coverage against the route tree in `App.tsx`. Document which routes and workflows are covered. Add missing coverage for unhappy paths.
- **Estimated effort:** 3-5 days
- **Dependencies:** None

### TEST-6: No Load/Performance Test Suite

- **Severity:** Tier 1
- **Description:** The only load testing is the `load-smoke.ps1` PowerShell script. There is no automated load test suite that runs in CI or on demand.
- **Why it matters:** Performance regressions cannot be detected without baseline measurements and repeatable tests.
- **Risk if left unresolved:** Performance degradation goes undetected until users complain.
- **Affected files/modules:** `scripts/proof/release/load-smoke.ps1`
- **Recommended solution:** Add a k6 or Gatling load test suite that targets key endpoints (login, order list, allocation, inventory). Run on demand and eventually in CI.
- **Estimated effort:** 3-5 days
- **Dependencies:** PERF-2 (metrics) for correlation

---

## 10. Documentation Findings

### DOC-1: No API Usage Guide for External Developers

- **Severity:** Tier 2
- **Description:** API documentation exists via OpenAPI/Swagger but there is no onboarding guide for merchants or warehouse developers who want to integrate with the API.
- **Why it matters:** External developers need more than endpoint documentation — they need authentication flows, common workflows, and example requests.
- **Risk if left unresolved:** Poor developer experience; increased support burden.
- **Affected files/modules:** `docs/architecture/api-documentation.md`
- **Recommended solution:** Create an API usage guide with authentication walkthrough, common workflow examples (create order → allocate → ship), and error handling patterns.
- **Estimated effort:** 3-5 days
- **Dependencies:** Post-V17

### DOC-2: No Operational Runbook

- **Severity:** Tier 1
- **Description:** No incident response or operational runbook exists. The roadmap identifies this as V17 scope but it has not been created.
- **Why it matters:** Production incidents require documented response procedures.
- **Risk if left unresolved:** Extended incident resolution time; ad-hoc responses.
- **Affected files/modules:** `docs/operations/`
- **Recommended solution:** Create an operational runbook covering: incident classification, escalation procedures, rollback procedures, database recovery, common failure modes and responses.
- **Estimated effort:** 3-5 days
- **Dependencies:** PERF-2 (metrics) defines what to monitor; V17 deployment provides the infrastructure context

### DOC-3: No CONTRIBUTING.md

- **Severity:** Tier 2
- **Description:** There is no contribution guide explaining how to set up, develop, test, and submit changes.
- **Why it matters:** New developers (or AI agents) need clear setup and workflow instructions.
- **Risk if left unresolved:** Onboarding friction; inconsistent PR quality.
- **Affected files/modules:** Repository root
- **Recommended solution:** Create `CONTRIBUTING.md` with local setup, development commands, testing requirements, PR process, and code style expectations.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### DOC-4: No CHANGELOG.md

- **Severity:** Tier 2
- **Description:** There is no changelog recording what changed between versions.
- **Why it matters:** Version tracking and release communication require a changelog.
- **Risk if left unresolved:** No record of what changed between releases.
- **Affected files/modules:** Repository root
- **Recommended solution:** Create `CHANGELOG.md` following Keep a Changelog format. Backfill from git history for V16.1, V16.2, and V17 milestones.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### DOC-5: Database Schema Not Documented Beyond Migrations

- **Severity:** Tier 2
- **Description:** The database schema is defined only in 18 Flyway migration files. There is no human-readable schema documentation showing the current state.
- **Why it matters:** Understanding the data model requires reading migrations in sequence.
- **Risk if left unresolved:** Slow onboarding; difficulty reasoning about schema changes.
- **Affected files/modules:** `backend/src/main/resources/db/migration/` (18 files)
- **Recommended solution:** Generate a schema diagram or document from the current database state using a tool like `schemaspy` or `eralchemy`. Add to `docs/architecture/`.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

---

## 11. DevOps / Infrastructure Findings

### INFRA-1: No Database Backup/Restore Automation

- **Severity:** Tier 0
- **Description:** Database backup relies on manual `pg_dump` commands in proof scripts. There is no automated backup schedule, no restore verification, and no documented recovery procedure.
- **Why it matters:** Data loss in production is the highest-impact failure mode.
- **Risk if left unresolved:** Permanent data loss from database corruption or accidental deletion.
- **Affected files/modules:**
  - `scripts/proof/release/` (proof scripts reference backup artifacts)
  - `docs/operations/production-deployment-activation.md` (mentions backup as V17 scope)
- **Recommended solution:** Implement automated daily PostgreSQL backups for the Neon database (Neon provides point-in-time recovery; verify it's enabled). Add a restore verification script that runs against a test database. Document the backup/restore procedure in the operational runbook.
- **Estimated effort:** 2-3 days
- **Dependencies:** None

### INFRA-2: No Meaningful Health/Readiness Endpoints

- **Severity:** Tier 0
- **Description:** The health endpoint (`/api/v1/health`) returns a simple response without checking database connectivity or other dependencies. Cloud deployment platforms (Hugging Face, Vercel) need health checks for routing decisions.
- **Why it matters:** Deployments cannot verify that the backend is actually ready to serve requests.
- **Risk if left unresolved:** Traffic routed to unhealthy instances; deployment failures.
- **Affected files/modules:** `backend/src/main/java/com/merhouse/web/HealthController.java`
- **Recommended solution:** Add Spring Boot Actuator with `/actuator/health` that checks database connectivity, disk space, and SMTP reachability (when email is enabled). Configure Hugging Face Docker Space health check to use this endpoint.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### INFRA-3: No Pre-Commit Hooks

- **Severity:** Tier 2
- **Description:** There are no pre-commit hooks for linting, formatting, or type-checking. All quality checks run only in CI.
- **Why it matters:** Developers receive feedback only after pushing, increasing cycle time.
- **Risk if left unresolved:** Slow feedback loop; CI catches issues that could be caught locally.
- **Affected files/modules:** Repository root (`.husky/` or `.pre-commit-config.yaml` does not exist)
- **Recommended solution:** Add pre-commit hooks using `husky` + `lint-staged` for: ESLint on staged `.ts/.tsx` files, Prettier formatting, TypeScript type-check. Optionally add a Java format check via `spotless-maven-plugin`.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### INFRA-4: No Automated Dependency Updates

- **Severity:** Tier 2
- **Description:** No Dependabot or Renovate configuration for automated dependency update PRs.
- **Why it matters:** Security patches and bug fixes in dependencies are applied only when manually noticed.
- **Risk if left unresolved:** Known vulnerabilities in dependencies go unpatched.
- **Affected files/modules:** Repository root (no `dependabot.yml` or `renovate.json`)
- **Recommended solution:** Add Dependabot configuration for npm (frontend) and Maven (backend). Group minor/patch updates to reduce PR noise.
- **Estimated effort:** 0.5 days
- **Dependencies:** None

### INFRA-5: No Backend Container Health Check in Docker Compose

- **Severity:** Tier 3
- **Description:** The `docker-compose.yml` backend service has no health check. Docker Compose cannot determine if the backend is ready to serve requests.
- **Why it matters:** Frontend container starts before backend is ready; integration tests may fail on timing.
- **Risk if left unresolved:** Flaky local development and CI startup.
- **Affected files/modules:** `docker-compose.yml` (lines 21-56)
- **Recommended solution:** Add a health check to the backend service that curls the health endpoint. Add `depends_on: backend: condition: service_healthy` to the frontend service.
- **Estimated effort:** 0.5 days
- **Dependencies:** INFRA-2 (meaningful health endpoint)

### INFRA-6: No PowerShell Script Linting

- **Severity:** Tier 3
- **Description:** The CI validates that PowerShell scripts parse correctly but does not run PSScriptAnalyzer for best-practice linting.
- **Why it matters:** 62 PowerShell scripts are a significant maintenance surface. PSScriptAnalyzer catches common issues like uninitialized variables, insecure patterns, and style violations.
- **Risk if left unresolved:** Subtle script bugs and inconsistent style.
- **Affected files/modules:**
  - `scripts/` (62 .ps1 files)
  - `.github/workflows/merhouse-quality-gate.yml` (lines 129-145: parser check only)
- **Recommended solution:** Add PSScriptAnalyzer step to CI. Fix reported warnings and errors. Add a local check script.
- **Estimated effort:** 1-2 days
- **Dependencies:** None

### INFRA-7: CI Quality Gate Total Duration Potentially Exceeds 30 Minutes

- **Severity:** Tier 2
- **Description:** The quality gate has 6 parallel jobs followed by a 7th integration job that starts a full Docker Compose stack, seeds data, runs API smoke, and runs a browser tour. The integration job alone has a 35-minute timeout.
- **Why it matters:** Long CI times slow the development feedback loop.
- **Risk if left unresolved:** Developer frustration; delayed merge decisions.
- **Affected files/modules:** `.github/workflows/merhouse-quality-gate.yml`
- **Recommended solution:** Profile CI step durations. Consider caching Docker layers. Split the integration proof into a fast smoke test (always) and a full browser tour (on schedule or manual dispatch).
- **Estimated effort:** 2-3 days
- **Dependencies:** None

---

## 12. Technical Debt Inventory

### Backend Debt

| ID | Area | Severity | Description | File(s) |
|----|------|----------|-------------|---------|
| BD-1 | DTO | Tier 2 | 107 DTO files for 69 entities, many 1:1 mappings | `backend/src/main/java/com/merhouse/dto/` |
| BD-2 | DTO | Tier 2 | Static `from()` factory methods couple entities to DTOs | All `*Response.from(entity)` patterns |
| BD-3 | Service | Tier 1 | `ServiceAccountabilityService` 860 lines, 5 sub-domains | `backend/src/main/java/com/merhouse/service/ServiceAccountabilityService.java` |
| BD-4 | Service | Tier 1 | `MerchantWarehouseService` 689 lines, 2 domains | `backend/src/main/java/com/merhouse/service/MerchantWarehouseService.java` |
| BD-5 | Auth | Tier 0 | Authorization in service methods, not cross-cutting | All services with `currentUserService.*` |
| BD-6 | Data | Tier 0 | No pagination on list queries | All repositories returning `List<>` |
| BD-7 | Data | Tier 1 | No `@BatchSize` on `@OneToMany` — N+1 risk | `CustomerOrder.java`, `FulfillmentAllocation.java`, `Shipment.java` |
| BD-8 | Security | Tier 0 | Custom JWT instead of standard library | `backend/src/main/java/com/merhouse/security/JwtService.java` |
| BD-9 | Security | Tier 1 | No token refresh/rotation | `application.properties:30` |
| BD-10 | Data | Tier 0 | No Hibernate `@Filter` for tenant isolation | All repositories |
| BD-11 | Outbox | Tier 2 | `OutboxService.publish()` synchronous within transaction | `backend/src/main/java/com/merhouse/service/OutboxService.java` |
| BD-12 | Config | Tier 2 | 21 `@Value` params instead of `@ConfigurationProperties` | `backend/src/main/java/com/merhouse/config/ProductionSafetyConfig.java` |
| BD-13 | Entity | Tier 3 | `FulfillmentException.status` is String, not enum | `backend/src/main/java/com/merhouse/service/FulfillmentService.java:271` |
| BD-14 | API | Tier 3 | No versioning strategy beyond `/api/v1/` | All controllers |
| BD-15 | Data | Tier 2 | `InventoryItem.attributes` JSONB unvalidated | `backend/src/main/java/com/merhouse/entity/InventoryItem.java:43` |
| BD-16 | Entity | Tier 3 | `ShipmentPackage.status` and event type are strings | `backend/src/main/java/com/merhouse/service/FulfillmentService.java:425-432` |
| BD-17 | Entity | Tier 1 | No `@Version` optimistic locking on hot entities | `WarehouseInventory.java`, `CustomerOrder.java`, `FulfillmentAllocation.java` |

### Frontend Debt

| ID | Area | Severity | Description | File(s) |
|----|------|----------|-------------|---------|
| FD-1 | Architecture | Tier 1 | `api/client.ts` 742 lines, every API call | `frontend/src/api/client.ts` |
| FD-2 | Architecture | Tier 1 | `api/types.ts` 1043 lines, all types | `frontend/src/api/types.ts` |
| FD-3 | Components | Tier 1 | Monolithic pages with 15+ useState hooks | `WarehousePage.tsx:49-67`, `AdminPages.tsx` |
| FD-4 | Data fetching | Tier 1 | No custom data-fetching hook | Every page component |
| FD-5 | State | Tier 2 | Form state via per-record draft objects | `WarehousePage.tsx:60-62` |
| FD-6 | Auth | Tier 3 | Token key `warehouse-console-token` (legacy) | `frontend/src/auth/AuthContext.tsx:7` |
| FD-7 | Polling | Tier 2 | Notification poll ignores tab visibility | `frontend/src/components/AppLayout.tsx:73-75` |
| FD-8 | Types | Tier 2 | Frontend types manually mirror backend | `frontend/src/api/types.ts` |
| FD-9 | Routing | Tier 2 | No route-based code splitting | `frontend/src/App.tsx:6-32` |
| FD-10 | Legacy | Tier 3 | Ngrok header in production API client | `frontend/src/api/client.ts:107-118` |

### Infrastructure Debt

| ID | Area | Severity | Description | File(s) |
|----|------|----------|-------------|---------|
| ID-1 | CI | Tier 2 | Quality gate potentially exceeds 30 min | `.github/workflows/merhouse-quality-gate.yml` |
| ID-2 | Secrets | Tier 2 | Keystore rotation requires workflow update | `.github/workflows/merhouse-android-release.yml:61` |
| ID-3 | Docker | Tier 3 | No health check on backend container | `docker-compose.yml:22-56` |
| ID-4 | Monitoring | Tier 0 | No application metrics | `backend/pom.xml`, `HealthController.java` |
| ID-5 | Backup | Tier 0 | No database backup/restore automation | `docs/operations/production-deployment-activation.md` |

---

## 13. Implementation Roadmap

### Dependency Graph

```
Tier 0 (all independent — do in parallel):
  BE-1 (pagination) ─────────────────────────────┐
  DB-1 (tenant isolation) ────────────────────────┤
  INFRA-1 (backup automation) ────────────────────┤
  INFRA-2 (health endpoints) ─────────────────────┤
  SEC-1 (standard JWT) ───────────────────────────┤
  SEC-2 (login rate limiting) ────────────────────┤
  PERF-2 (metrics) ───────────────────────────────┘
                                                   
Tier 1 (some dependencies):                       
  ARCH-1 (authorization aspect) ← independent     
  ARCH-3 (domain extraction) ← independent        
  BE-5 (optimistic locking) ← after BE-1           
  DB-2 (batch size) ← independent                 
  DB-3 (migration rollback testing) ← independent 
  FE-1 (API client split) ← independent           
  FE-3 (useApi hook) ← independent, before FE-2   
  FE-2 (page splits) ← after FE-3                 
  SEC-3 (refresh tokens) ← after SEC-1            
  PERF-1 (N+1 fix) ← after BE-1                   
  TEST-1 (auth boundary tests) ← independent      
  TEST-2 (concurrency tests) ← independent        
  TEST-6 (load tests) ← after PERF-2              
  DOC-2 (operational runbook) ← after PERF-2      

Tier 2 (post-V17 stabilization):                 
  ARCH-2 (package reorg) ← after ARCH-1           
  ARCH-4 (outbox refinement) ← independent        
  BE-2 (DTO reduction/MapStruct) ← independent    
  BE-3 (ConfigurationProperties) ← independent    
  DB-4 (JSONB validation) ← independent           
  DB-5 (deep entity graph) ← after BE-1           
  FE-4 (form draft hook) ← independent            
  FE-6 (visibility polling) ← independent         
  FE-7 (code splitting) ← independent             
  FE-8 (type generation) ← post-V17               
  PERF-3 (connection pool) ← after PERF-2         
  PERF-4 (bundle tracking) ← independent          
  TEST-3 (a11y testing) ← independent             
  TEST-4 (failure simulation) ← independent       
  TEST-5 (E2E coverage audit) ← independent       
  DOC-1 (API guide) ← post-V17                   
  DOC-3 (CONTRIBUTING.md) ← independent           
  DOC-4 (CHANGELOG.md) ← independent              
  DOC-5 (schema docs) ← independent               
  INFRA-3 (pre-commit hooks) ← independent        
  INFRA-4 (Dependabot) ← independent              
  INFRA-7 (CI optimization) ← independent         

Tier 3 (nice-to-have):                            
  ARCH-5 (API versioning) ← independent           
  BE-4 (exception status enum) ← independent      
  BE-6 (package status enum) ← independent        
  FE-5 (token key rename) ← independent           
  FE-9 (remove ngrok header) ← independent        
  SEC-4 (CSRF comment) ← independent              
  SEC-5 (CORS credentials) ← after SEC-3          
  INFRA-5 (Docker health check) ← after INFRA-2   
  INFRA-6 (PS linting) ← independent              
```

### Tier 0 Tasks: Production Blockers

---

## T0-1

Priority: Tier 0 — Production Blocker
Status: Not Started
Category: Data Access
Estimated Effort: 3-5 days
Dependencies: None

### Problem

All list endpoints return unbounded collections. Under production data volumes, every list query becomes a memory bomb. A merchant with 10,000 orders will cause the order list endpoint to load all 10,000 rows (with deep entity graphs) into memory in a single request.

### Proposed Solution

Introduce a `PageRequest` wrapper. Convert all list endpoints to accept `page`, `size`, and optional `sort` parameters. Return `Page<T>` responses with total count and navigation metadata. Start with the highest-volume endpoints: orders, allocations, inventory, relationships.

### Acceptance Criteria

- [ ] All list endpoints accept `page`, `size`, and `sort` query parameters with sensible defaults
- [ ] All list endpoints return a paginated response envelope with `content`, `totalElements`, `totalPages`, `number`, `size`
- [ ] Default page size is 25; maximum allowed page size is 100
- [ ] Backend tests verify pagination behavior (boundary cases: page beyond data, size=0, size > max)
- [ ] Frontend updated to handle paginated responses
- [ ] API smoke script handles paginated endpoints

---

## T0-2

Priority: Tier 0 — Production Blocker
Status: Not Started
Category: Data Access / Security
Estimated Effort: 3-4 days
Dependencies: None

### Problem

The system uses a shared database with application-level tenant filtering. There is no Hibernate `@Filter` for automatic tenant scoping. A single missed filter in a new query leaks cross-tenant data.

### Proposed Solution

Add Hibernate `@FilterDef` and `@Filter` on tenant-scoped entities. Enable the filter automatically in a Spring aspect or interceptor that reads the current tenant from `SecurityContextHolder`. Existing queries continue to work; the filter adds an automatic `AND tenant_id = ?` condition.

### Acceptance Criteria

- [ ] Hibernate `@FilterDef` defined on all tenant-scoped entities (`Tenant`, `AppUser`, `CustomerOrder`, `InventoryItem`, `WarehouseInventory`, `MerchantWarehouseRelationship`, `InboundStockRequest`, `FulfillmentAllocation`, `NotificationDelivery`, `ServiceAgreement`, etc.)
- [ ] Filter automatically enabled for all authenticated requests
- [ ] Existing repository queries return the same results (filter is additive, not replacing manual checks)
- [ ] Test verifies that a query without explicit tenant filter returns only the current tenant's data
- [ ] Test verifies that admin/owner queries that need cross-tenant access can disable the filter explicitly

---

## T0-3

Priority: Tier 0 — Production Blocker
Status: Not Started
Category: Infrastructure
Estimated Effort: 2-3 days
Dependencies: None

### Problem

No automated database backup/restore exists. Manual `pg_dump` scripts in proof scripts are the only backup mechanism. Data loss in production is the highest-impact failure mode.

### Proposed Solution

Verify Neon point-in-time recovery is enabled for the production database. Add a restore verification script that runs against a test database. Document the backup/restore procedure in the operational runbook.

### Acceptance Criteria

- [ ] Neon PITR (point-in-time recovery) confirmed enabled for production database
- [ ] Restore verification script exists and passes against a test restore
- [ ] Backup/restore procedure documented in operational runbook
- [ ] Restore test run recorded as proof

---

## T0-4

Priority: Tier 0 — Production Blocker
Status: Not Started
Category: Infrastructure
Estimated Effort: 1-2 days
Dependencies: None

### Problem

The health endpoint returns a simple response without checking database connectivity or other dependencies. Cloud deployment platforms need health checks for routing decisions.

### Proposed Solution

Add Spring Boot Actuator with `/actuator/health` that checks database connectivity, disk space, and SMTP reachability (when email is enabled). Configure Hugging Face Docker Space health check to use this endpoint.

### Acceptance Criteria

- [ ] `/actuator/health` returns `UP` when database is reachable
- [ ] `/actuator/health` returns `DOWN` when database is unreachable
- [ ] SMTP health indicator included when email is enabled
- [ ] Hugging Face Docker Space `HEALTHCHECK` configured to use the endpoint
- [ ] Docker Compose backend service has a health check using the same endpoint

---

## T0-5

Priority: Tier 0 — Production Blocker
Status: Not Started
Category: Security
Estimated Effort: 2-3 days
Dependencies: None

### Problem

Custom JWT implementation instead of a standard, battle-tested library. Security auditors will flag custom crypto. Standard libraries handle edge cases (timing attacks, algorithm confusion, key rotation) that custom implementations often miss.

### Proposed Solution

Replace with `spring-boot-starter-oauth2-resource-server` + Nimbus JOSE. Configure `jwt.secretKey` in application properties. Use `JwtDecoder` and `JwtEncoder` beans. Adapt `JwtAuthenticationFilter` to use the standard decoder.

### Acceptance Criteria

- [ ] `spring-boot-starter-oauth2-resource-server` dependency added
- [ ] Custom `JwtService` replaced with Spring Security's `JwtDecoder`/`JwtEncoder`
- [ ] `JwtAuthenticationFilter` uses `JwtDecoder` for token validation
- [ ] All existing authentication flows (login, me, token refresh) work unchanged
- [ ] All existing tests pass without modification
- [ ] Token format is backward-compatible (existing tokens continue to work until expiry)

---

## T0-6

Priority: Tier 0 — Production Blocker
Status: Not Started
Category: Security
Estimated Effort: 1-2 days
Dependencies: None

### Problem

No rate limiting on the login endpoint. Recovery and access-request endpoints have throttling, but login does not. Brute-force password attacks can attempt unlimited login combinations.

### Proposed Solution

Add rate limiting to the login endpoint. Start with an in-memory rate limiter (5 failed attempts per email per 15 minutes) and upgrade to Redis-backed for multi-instance deployments.

### Acceptance Criteria

- [ ] Login endpoint returns 429 after 5 failed attempts for the same email within 15 minutes
- [ ] Successful login resets the failure counter
- [ ] Rate limit response includes `Retry-After` header
- [ ] Rate limiting does not affect other endpoints
- [ ] Admin login is not exempted (same rules apply)
- [ ] Test verifies rate limiting behavior

---

## T0-7

Priority: Tier 0 — Production Blocker
Status: Not Started
Category: Observability
Estimated Effort: 3-5 days
Dependencies: None

### Problem

No application-level metrics, no Micrometer integration, no Prometheus endpoint, no alerting. The only observability is the simple health endpoint and outbox alert records. Production incidents cannot be detected or diagnosed without metrics.

### Proposed Solution

Add `micrometer-registry-prometheus` dependency. Expose `/actuator/prometheus` endpoint. Instrument key operations: order creation, allocation, inventory operations, outbox processing, API request latency, error rates. Add Grafana dashboard templates.

### Acceptance Criteria

- [ ] `/actuator/prometheus` endpoint exposed and returns metrics
- [ ] Key business operations instrumented with timers and counters
- [ ] JVM metrics (memory, GC, threads) available via Prometheus endpoint
- [ ] Database connection pool metrics available
- [ ] Grafana dashboard template committed to `docs/operations/` or deployment config
- [ ] Metrics endpoint secured (not publicly accessible in production)

---

### Tier 1 Tasks: High Priority

---

## T1-1

Priority: Tier 1
Status: Not Started
Category: Architecture / Security
Estimated Effort: 5-7 days
Dependencies: None

### Problem

Authorization logic is scattered across every service method via `CurrentUserService` calls. There is no centralized auth policy, no way to audit access control without reading every service method, and inconsistent enforcement patterns.

### Proposed Solution

Create custom annotations (`@TenantScoped`, `@PlatformAdmin`, `@RequireRole`) processed by a Spring AOP aspect. Migrate authorization checks from service bodies to annotations on service methods or controller endpoints.

### Acceptance Criteria

- [ ] `@TenantScoped` annotation created that automatically verifies current user belongs to the target tenant
- [ ] `@PlatformAdmin` annotation created that requires OWNER/ADMIN role
- [ ] `@RequireRole` annotation created that accepts specific roles
- [ ] AOP aspect processes these annotations before method execution
- [ ] All existing authorization checks migrated to annotations
- [ ] All existing tests pass without modification
- [ ] New authorization test verifies that removing an annotation causes access denial

---

## T1-2

Priority: Tier 1
Status: Not Started
Category: Architecture
Estimated Effort: 5-7 days
Dependencies: None (but should precede ARCH-2)

### Problem

`FulfillmentService` directly mutates `CustomerOrder.status`. `MerchantWarehouseService` handles both relationship lifecycle and inbound stock lifecycle. `ServiceAccountabilityService` handles 5 sub-domains in 860 lines.

### Proposed Solution

Extract inbound stock lifecycle into `InboundStockService`. Extract accountability sub-domains into `ServiceAgreementService`, `ServiceStatementService`, `ServiceDisputeService`, `ServiceClaimService`, `ServiceReviewService`. Introduce domain events for cross-domain mutations.

### Acceptance Criteria

- [ ] `InboundStockService` handles all inbound stock operations
- [ ] `MerchantWarehouseService` handles only relationship lifecycle
- [ ] `ServiceAccountabilityService` split into focused sub-services
- [ ] Cross-domain mutations (e.g., FulfillmentService → OrderService) use domain events or explicit service calls
- [ ] All existing tests pass
- [ ] No behavior changes visible from API consumers

---

## T1-3

Priority: Tier 1
Status: Not Started
Category: Frontend
Estimated Effort: 2-3 days
Dependencies: None

### Problem

Every page component duplicates the same data-fetching pattern: `useState` for data/loading/error, `useEffect` for fetching, cleanup with `active` flag, `ApiError` handling. This pattern appears at least 15 times.

### Proposed Solution

Create a `useApi<T>(fetcher, deps?)` hook that returns `{ data, loading, error, refetch }`. Encapsulate the `active` flag cleanup, `ApiError` normalization, and loading state management. Create domain-specific hooks on top.

### Acceptance Criteria

- [ ] `useApi<T>` hook created and tested
- [ ] Hook handles loading, error, and success states
- [ ] Hook cleans up properly on unmount (no state updates after unmount)
- [ ] Hook supports dependency-based re-fetching
- [ ] At least 3 page components refactored to use the hook
- [ ] All existing tests pass

---

## T1-4

Priority: Tier 1
Status: Not Started
Category: Frontend
Estimated Effort: 3-4 days
Dependencies: FE-1 (can be done in parallel)

### Problem

`api/client.ts` (742 lines) and `api/types.ts` (1043 lines) are monolithic. Any API change requires editing the same large file, creating merge conflicts.

### Proposed Solution

Split into domain modules: `api/modules/auth.ts`, `api/modules/inventory.ts`, etc. Each module co-locates its API calls and types. The shared `request<T>` function and `ApiError` class remain in `api/client.ts`.

### Acceptance Criteria

- [ ] `api/client.ts` reduced to shared transport logic + `ApiError` (< 100 lines)
- [ ] Domain modules created for auth, inventory, orders, fulfillment, relationships, accountability, notifications, assistant, admin
- [ ] Types co-located with their domain module
- [ ] All page imports updated
- [ ] All existing tests pass
- [ ] No behavior changes

---

## T1-5

Priority: Tier 1
Status: Not Started
Category: Frontend
Estimated Effort: 8-12 days
Dependencies: T1-3 (useApi hook)

### Problem

Five page files total 5,600+ lines. Each mixes data fetching, form state, conditional rendering, and inline error handling. They cannot be incrementally improved.

### Proposed Solution

One file per page component. Extract reusable sub-components for tables, forms, and panels. Use `useApi` hook for data fetching.

### Acceptance Criteria

- [ ] `AdminPages.tsx` split into individual page files (AdminOverviewPage, AdminTenantsPage, AdminUsersPage, AdminAccessRequestsPage, AdminRelationshipsPage)
- [ ] `WarehousePage.tsx` split into focused sub-components (WarehouseWorkQueue, WarehouseReceivingPanel, WarehouseInventoryPanel, etc.)
- [ ] `MerchantPages.tsx` split into individual page files
- [ ] `ServiceAccountabilityPage.tsx` split into sub-components
- [ ] `OperationalDetailPages.tsx` split into individual detail pages
- [ ] No file exceeds 400 lines
- [ ] All existing tests pass
- [ ] No behavior changes visible to users

---

## T1-6

Priority: Tier 1
Status: Not Started
Category: Data Access
Estimated Effort: 2-3 days
Dependencies: None

### Problem

No `@Version` optimistic locking on hot entities. Concurrent modifications will silently overwrite each other.

### Proposed Solution

Add `@Version Long version` to `WarehouseInventory`, `CustomerOrder`, `FulfillmentAllocation`, `InventoryItem`. Add Flyway migration to add `version` columns with default 0.

### Acceptance Criteria

- [ ] `@Version` field added to hot entities
- [ ] Flyway migration adds `version BIGINT NOT NULL DEFAULT 0` columns
- [ ] `ObjectOptimisticLockingFailureException` already handled by `ApiExceptionHandler` (verify)
- [ ] Test verifies concurrent modification returns 409 Conflict
- [ ] Frontend displays user-friendly retry message for optimistic lock failures

---

## T1-7

Priority: Tier 1
Status: Not Started
Category: Data Access
Estimated Effort: 1-2 days
Dependencies: None

### Problem

No `@BatchSize` on `@OneToMany` collections. When Hibernate loads a collection of parent entities and then accesses their lazy collections, it issues one SELECT per parent per collection.

### Proposed Solution

Add `@BatchSize(size = 50)` on all `@OneToMany` collections.

### Acceptance Criteria

- [ ] `@BatchSize(size = 50)` added to `CustomerOrder.items`, `CustomerOrder.allocations`, `CustomerOrder.backorders`
- [ ] `@BatchSize(size = 50)` added to `FulfillmentAllocation.items`
- [ ] `@BatchSize(size = 50)` added to `Shipment.packages`
- [ ] Existing tests pass
- [ ] Verify reduced query count in logs (enable SQL logging in test)

---

## T1-8

Priority: Tier 1
Status: Not Started
Category: Performance
Estimated Effort: 1-2 days
Dependencies: None (but BE-1 pagination reduces the impact)

### Problem

`OrderService.findAll()` calls `get(order.getId())` in a stream, triggering `findWithDetailsById` for each order — N+1 at the service level.

### Proposed Solution

Create a dedicated `findAllWithMerchant()` query that loads only the fields needed for list view (no deep entity graph). Reserve `findWithDetailsById` for the single-order detail page.

### Acceptance Criteria

- [ ] New repository query `findAllWithMerchant()` loads only order + merchant data
- [ ] `OrderService.findAll()` uses the new query for list views
- [ ] `OrderService.get()` continues to use deep entity graph for detail views
- [ ] Test verifies list query generates ≤ 2 SQL statements
- [ ] All existing tests pass

---

## T1-9

Priority: Tier 1
Status: Not Started
Category: Security
Estimated Effort: 3-5 days
Dependencies: T0-5 (standard JWT library)

### Problem

JWTs expire after 1 hour with no refresh mechanism. Users must re-authenticate every hour.

### Proposed Solution

Implement refresh tokens: issue a long-lived refresh token alongside the access token. Store refresh tokens in the database with rotation. Add a `/api/v1/auth/refresh` endpoint.

### Acceptance Criteria

- [ ] Login response includes both `accessToken` and `refreshToken`
- [ ] `/api/v1/auth/refresh` endpoint accepts a valid refresh token and returns new access + refresh tokens
- [ ] Refresh tokens are single-use (rotation)
- [ ] Expired or reused refresh tokens are rejected
- [ ] Frontend automatically refreshes tokens before expiry
- [ ] All existing auth tests pass
- [ ] New tests for refresh token lifecycle

---

## T1-10

Priority: Tier 1
Status: Not Started
Category: Testing
Estimated Effort: 5-7 days
Dependencies: None

### Problem

No test verifies that tenant A cannot access tenant B's data. No test verifies that a MERCHANT user cannot access ADMIN endpoints. The authorization model is untested at the integration level.

### Proposed Solution

Add `@WebMvcTest` sliced controller tests that verify each endpoint's authorization rules. Test scenarios: unauthenticated, wrong tenant, wrong role, correct access.

### Acceptance Criteria

- [ ] Authorization tests exist for all controller endpoints
- [ ] Each test verifies: unauthenticated → 401, wrong tenant → 403, wrong role → 403, correct access → 2xx
- [ ] Tests run as part of the standard `./mvnw test` suite
- [ ] No test requires a running Docker Compose stack

---

## T1-11

Priority: Tier 1
Status: Not Started
Category: Testing
Estimated Effort: 2-3 days
Dependencies: None

### Problem

No test verifies correct behavior under concurrent access for inventory allocation, despite pessimistic write locks.

### Proposed Solution

Add a Testcontainers-based integration test that runs two concurrent allocation attempts for the same inventory item.

### Acceptance Criteria

- [ ] Concurrent allocation test verifies total reserved quantity ≤ available quantity
- [ ] Test uses Testcontainers PostgreSQL
- [ ] Test runs as part of the standard `./mvnw test` suite
- [ ] Test verifies both success and conflict scenarios

---

## T1-12

Priority: Tier 1
Status: Not Started
Category: Testing
Estimated Effort: 3-5 days
Dependencies: T0-7 (metrics for correlation)

### Problem

No automated load test suite. Performance regressions cannot be detected without baseline measurements.

### Proposed Solution

Add a k6 or Gatling load test suite targeting key endpoints. Run on demand and eventually in CI.

### Acceptance Criteria

- [ ] Load test suite covers: login, order list, allocation, inventory operations
- [ ] Baseline measurements recorded for each endpoint (latency p50/p95/p99, throughput)
- [ ] Load test script committed to `scripts/quality/` or `tests/load/`
- [ ] CI step added for on-demand load testing (not blocking)

---

## T1-13

Priority: Tier 1
Status: Not Started
Category: Database
Estimated Effort: 2-3 days
Dependencies: None

### Problem

Flyway migrations are validated forward but there is no automated test verifying rollback capability or schema consistency after partial failure.

### Proposed Solution

Add a CI step that applies all migrations to an empty Testcontainers database and verifies schema consistency. Document the rollback strategy for each migration.

### Acceptance Criteria

- [ ] CI step applies all migrations to a Testcontainers PostgreSQL instance
- [ ] Schema consistency verified after all migrations apply
- [ ] Manual rollback strategy documented for each migration
- [ ] Test runs as part of the standard `./mvnw test` suite

---

## T1-14

Priority: Tier 1
Status: Not Started
Category: Documentation
Estimated Effort: 3-5 days
Dependencies: T0-7 (metrics define what to monitor)

### Problem

No incident response or operational runbook exists. The roadmap identifies this as V17 scope.

### Proposed Solution

Create an operational runbook covering: incident classification, escalation procedures, rollback procedures, database recovery, common failure modes and responses.

### Acceptance Criteria

- [ ] Runbook committed to `docs/operations/`
- [ ] Covers: incident classification, escalation, rollback, recovery, common failures
- [ ] Reviewed by at least one person who didn't write it
- [ ] Linked from `docs/index.md`

---

### Tier 2 Tasks: Medium Priority

---

## T2-1

Priority: Tier 2
Status: Not Started
Category: Architecture
Estimated Effort: 7-10 days
Dependencies: T1-1 (authorization aspect)

### Problem

All services, repositories, controllers, and DTOs live in flat packages by layer, making it hard to understand feature boundaries.

### Proposed Solution

Reorganize into domain packages: `domain/order/`, `domain/inventory/`, `domain/fulfillment/`, etc.

### Acceptance Criteria

- [ ] All classes moved to domain-specific packages
- [ ] No circular dependencies between domain packages
- [ ] All tests pass without modification
- [ ] No behavior changes

---

## T2-2

Priority: Tier 2
Status: Not Started
Category: Frontend
Estimated Effort: 5-7 days
Dependencies: Post-V17 (requires stable OpenAPI spec)

### Problem

Frontend types manually mirror backend DTOs. Any backend change requires manual frontend type update with no automated contract check.

### Proposed Solution

Generate TypeScript types from the backend OpenAPI spec using `openapi-typescript` or `openapi-generator-cli`.

### Acceptance Criteria

- [ ] TypeScript types generated from OpenAPI spec
- [ ] CI step verifies generated types match current spec
- [ ] Manual type file removed
- [ ] All frontend tests pass

---

## T2-3

Priority: Tier 2
Status: Not Started
Category: Frontend
Estimated Effort: 2-3 days
Dependencies: None

### Problem

Form drafts managed via `Record<string, DraftType>` maps are error-prone and not reusable.

### Proposed Solution

Create a `useFormDraft<T>(initialValue)` hook that manages draft state, validation, and reset.

### Acceptance Criteria

- [ ] `useFormDraft` hook created and tested
- [ ] At least 2 page components refactored to use the hook
- [ ] All existing tests pass

---

## T2-4

Priority: Tier 2
Status: Not Started
Category: Frontend
Estimated Effort: 1-2 days
Dependencies: None

### Problem

`AppLayout.tsx` polls notification summary every 15 seconds regardless of tab visibility.

### Proposed Solution

Use the `visibilitychange` API to pause polling when the tab is hidden.

### Acceptance Criteria

- [ ] Polling pauses when tab is hidden
- [ ] Polling resumes when tab becomes visible with an immediate refresh
- [ ] Existing notification count behavior unchanged when tab is visible

---

## T2-5

Priority: Tier 2
Status: Not Started
Category: Frontend
Estimated Effort: 1-2 days
Dependencies: None

### Problem

All page components are statically imported in `App.tsx`. The entire frontend bundle loads upfront.

### Proposed Solution

Use `React.lazy()` + `Suspense` for route-level code splitting.

### Acceptance Criteria

- [ ] Each route loads its component lazily
- [ ] Loading fallback displayed while component loads
- [ ] Initial bundle size reduced by at least 30%
- [ ] All existing tests pass

---

## T2-6

Priority: Tier 2
Status: Not Started
Category: Config
Estimated Effort: 1-2 days
Dependencies: None

### Problem

`ProductionSafetyConfig` has 21 `@Value` parameters instead of typed `@ConfigurationProperties`.

### Proposed Solution

Create typed `@ConfigurationProperties` classes and inject into `ProductionSafetyConfig`.

### Acceptance Criteria

- [ ] `MerhouseAuthProperties`, `MerhouseDeploymentProperties`, `MerhouseEmailProperties`, `MerhouseAgentProperties` created
- [ ] `ProductionSafetyConfig` uses typed properties instead of `@Value`
- [ ] All safety validations continue to work
- [ ] All existing tests pass

---

## T2-7

Priority: Tier 2
Status: Not Started
Category: Testing
Estimated Effort: 2-3 days
Dependencies: None

### Problem

No automated accessibility testing.

### Proposed Solution

Integrate `@axe-core/playwright` into the Playwright E2E suite.

### Acceptance Criteria

- [ ] Axe-core integrated into Playwright tests
- [ ] Critical and serious accessibility violations fail the test
- [ ] Moderate violations are reported as warnings
- [ ] CI runs accessibility checks

---

## T2-8

Priority: Tier 2
Status: Not Started
Category: Testing
Estimated Effort: 2-3 days
Dependencies: None

### Problem

Frontend tests mock successful API responses. No test verifies behavior when the API is unreachable or returns errors.

### Proposed Solution

Add unit tests that simulate API failures and verify error state rendering.

### Acceptance Criteria

- [ ] Tests exist for: network error, 500, 403, timeout
- [ ] Each page component's error state is verified
- [ ] Tests run as part of `npm test`

---

## T2-9

Priority: Tier 2
Status: Not Started
Category: Testing
Estimated Effort: 3-5 days
Dependencies: None

### Problem

Playwright E2E test coverage is not measured or documented.

### Proposed Solution

Audit E2E test coverage against the route tree in `App.tsx`. Document which routes and workflows are covered. Add missing coverage.

### Acceptance Criteria

- [ ] Coverage matrix documented (route → test)
- [ ] Gaps identified and prioritized
- [ ] At least 5 missing coverage areas addressed with new tests

---

## T2-10

Priority: Tier 2
Status: Not Started
Category: Performance
Estimated Effort: 1 day
Dependencies: None

### Problem

No bundle size tracking or enforcement in CI.

### Proposed Solution

Add `rollup-plugin-visualizer` for bundle analysis. Add CI step that fails if bundle exceeds budget.

### Acceptance Criteria

- [ ] Bundle analysis report generated on build
- [ ] CI step fails if total bundle size exceeds current size + 10%
- [ ] Bundle budget configurable

---

## T2-11

Priority: Tier 2
Status: Not Started
Category: DevOps
Estimated Effort: 1-2 days
Dependencies: None

### Problem

No pre-commit hooks for linting, formatting, or type-checking.

### Proposed Solution

Add `husky` + `lint-staged` for ESLint, Prettier, and TypeScript checks on staged files.

### Acceptance Criteria

- [ ] Pre-commit hook runs ESLint on staged `.ts/.tsx` files
- [ ] Pre-commit hook runs TypeScript type-check
- [ ] Hook runs in < 10 seconds for typical changes
- [ ] Hooks can be skipped with `--no-verify` for emergencies

---

## T2-12

Priority: Tier 2
Status: Not Started
Category: DevOps
Estimated Effort: 0.5 days
Dependencies: None

### Problem

No Dependabot or Renovate configuration for automated dependency updates.

### Proposed Solution

Add Dependabot configuration for npm and Maven.

### Acceptance Criteria

- [ ] `dependabot.yml` configured for npm and Maven
- [ ] Minor/patch updates grouped to reduce PR noise
- [ ] Security updates enabled

---

## T2-13

Priority: Tier 2
Status: Not Started
Category: Database
Estimated Effort: 2-3 days
Dependencies: Post-V17

### Problem

JSONB columns (`InventoryItem.attributes`, `Shipment.metadata`) have no schema validation.

### Proposed Solution

Add JSONB schema validation using PostgreSQL CHECK constraints or service-layer validation.

### Acceptance Criteria

- [ ] `InventoryItem.attributes` has documented schema constraints
- [ ] Invalid attributes rejected at service layer or database level
- [ ] Test verifies validation behavior

---

## T2-14

Priority: Tier 2
Status: Not Started
Category: DevOps
Estimated Effort: 2-3 days
Dependencies: None

### Problem

CI quality gate potentially exceeds 30 minutes. The integration job alone has a 35-minute timeout.

### Proposed Solution

Profile CI step durations. Cache Docker layers. Split integration proof into fast smoke + optional full tour.

### Acceptance Criteria

- [ ] CI total duration < 20 minutes for typical PRs
- [ ] Full browser tour runs on schedule or manual dispatch only
- [ ] Fast smoke test runs on every PR

---

## T2-15

Priority: Tier 2
Status: Not Started
Category: Documentation
Estimated Effort: 1-2 days
Dependencies: None

### Problem

No `CONTRIBUTING.md` with development setup, test commands, and PR process.

### Proposed Solution

Create `CONTRIBUTING.md` with local setup, development commands, testing requirements, PR process.

### Acceptance Criteria

- [ ] `CONTRIBUTING.md` committed to repository root
- [ ] Covers: local setup, dev commands, test commands, PR process, code style
- [ ] Linked from `README.md`

---

## T2-16

Priority: Tier 2
Status: Not Started
Category: Documentation
Estimated Effort: 1-2 days
Dependencies: None

### Problem

No changelog recording what changed between versions.

### Proposed Solution

Create `CHANGELOG.md` following Keep a Changelog format.

### Acceptance Criteria

- [ ] `CHANGELOG.md` committed to repository root
- [ ] Backfilled with V16.1, V16.2, and V17 milestones from git history
- [ ] Follows Keep a Changelog format

---

## T2-17

Priority: Tier 2
Status: Not Started
Category: Documentation
Estimated Effort: 1-2 days
Dependencies: None

### Problem

Database schema is defined only in 18 Flyway migration files with no human-readable documentation.

### Proposed Solution

Generate schema documentation from the current database state.

### Acceptance Criteria

- [ ] Schema diagram or document generated
- [ ] Committed to `docs/architecture/`
- [ ] Linked from architecture docs index

---

### Tier 3 Tasks: Low Priority / Nice-to-Have

---

## T3-1

Priority: Tier 3
Status: Not Started
Category: Architecture
Estimated Effort: 2-3 days
Dependencies: None

### Problem

No API versioning strategy beyond `/api/v1/` prefix.

### Proposed Solution

Document the versioning policy and convention for introducing new versions.

### Acceptance Criteria

- [ ] API versioning policy documented in `docs/architecture/api-documentation.md`
- [ ] Convention for introducing `/api/v2/` with deprecation window defined

---

## T3-2

Priority: Tier 3
Status: Not Started
Category: Backend
Estimated Effort: 1 day
Dependencies: None

### Problem

`FulfillmentException.status` is a String, not an enum.

### Proposed Solution

Create `FulfillmentExceptionStatus` enum and add Flyway migration if needed.

### Acceptance Criteria

- [ ] Enum created and used throughout
- [ ] All existing tests pass
- [ ] Flyway migration adds CHECK constraint if not already present

---

## T3-3

Priority: Tier 3
Status: Not Started
Category: Backend
Estimated Effort: 1 day
Dependencies: None

### Problem

`ShipmentPackage.status` and `ShipmentPackageEvent.eventType` are strings, not enums.

### Proposed Solution

Create typed enums.

### Acceptance Criteria

- [ ] Enums created and used throughout
- [ ] All existing tests pass

---

## T3-4

Priority: Tier 3
Status: Not Started
Category: Frontend
Estimated Effort: 0.5 days
Dependencies: None

### Problem

Auth token key uses legacy name `warehouse-console-token`.

### Proposed Solution

Rename to `merhouse-auth-token` with migration logic.

### Acceptance Criteria

- [ ] Key renamed
- [ ] Migration logic reads old key, writes new key, deletes old key
- [ ] Existing sessions preserved

---

## T3-5

Priority: Tier 3
Status: Not Started
Category: Frontend
Estimated Effort: 0.5 days
Dependencies: None

### Problem

Ngrok-specific header detection in production API client is legacy code.

### Proposed Solution

Remove ngrok header detection and injection.

### Acceptance Criteria

- [ ] Ngrok-related code removed from `api/client.ts`
- [ ] All existing tests pass

---

## T3-6

Priority: Tier 3
Status: Not Started
Category: Security
Estimated Effort: 0.5 days
Dependencies: None

### Problem

CSRF disabled without documentation explaining why.

### Proposed Solution

Add comment in `SecurityConfig.java`.

### Acceptance Criteria

- [ ] Comment explains why CSRF is disabled
- [ ] No code changes

---

## T3-7

Priority: Tier 3
Status: Not Started
Category: DevOps
Estimated Effort: 0.5 days
Dependencies: T0-4 (health endpoint)

### Problem

No health check on backend container in `docker-compose.yml`.

### Proposed Solution

Add health check using `/actuator/health`.

### Acceptance Criteria

- [ ] Backend service has `healthcheck` configuration
- [ ] Frontend service depends on backend health

---

## T3-8

Priority: Tier 3
Status: Not Started
Category: DevOps
Estimated Effort: 1-2 days
Dependencies: None

### Problem

PowerShell scripts are parsed but not linted in CI.

### Proposed Solution

Add PSScriptAnalyzer step to CI.

### Acceptance Criteria

- [ ] PSScriptAnalyzer runs in CI
- [ ] Critical warnings and errors fail the build
- [ ] Local check script available

---

## Summary of Plan

### By Tier

| Tier | Tasks | Total Effort | Description |
|------|-------|--------------|-------------|
| Tier 0 | 7 | 15-25 days | Production blockers — must complete before V17 |
| Tier 1 | 14 | 41-60 days | High priority — authorization, domain extraction, frontend splits, testing |
| Tier 2 | 17 | 33-48 days | Medium priority — architecture, monitoring, docs, tooling |
| Tier 3 | 8 | 6-8 days | Nice-to-have — enums, cleanup, documentation |

### Recommended Execution Order

1. **Tier 0** — All 7 tasks are independent and can be done in parallel. Execute them before V17 deployment.
2. **Tier 1** — Start with T1-1 (authorization) and T1-3 (useApi hook) as they unblock the most downstream work. Then T1-4 (API client split) and T1-5 (page splits) in sequence. T1-2 (domain extraction) and T1-6 (optimistic locking) can proceed in parallel.
3. **Tier 2** — Execute after V17 stabilization, driven by deployed evidence. Prioritize based on actual pain points observed in production.
4. **Tier 3** — Execute opportunistically when touching the affected code for other reasons.

### Roadmap Constraint Reminder

Per `docs/architecture/roadmap.md` line 110: *"Do not refactor during production activation unless a concrete problem requires it."* Only Tier 0 items fix concrete deployment blockers and should proceed now. Tier 1+ should wait until V17 deployment proof is complete or until a concrete defect forces the change.
