# MerHouse Implementation Sequence

> **Status:** SUPERSEDED by [`V17-RE-EVALUATION.md`](./V17-RE-EVALUATION.md) and the follow-up [`Closure_Plan.md`](./Closure_Plan.md). This document remains as the historical audit foundation that informed the V17 re-evaluation. For current V17 scope and task ordering, refer to those documents: deployment infrastructure is complete, the three portfolio features in active scope are implemented (Access Request, OTP Recovery, How To Use), AI Assistant Completion is deferred to Vinfinite, and the remaining work is closure convergence plus deployed proof execution.
>
> **Purpose:** Single source of truth for all V17 deployment work. This document consolidates findings from a comprehensive codebase audit, PowerShell script evaluation, and re-evaluation of all tasks against the V17 refactoring rule to identify the safest path to successful V17 deployment.
>
> **Constraint:** The V17 refactoring rule (`docs/architecture/roadmap.md` line 110) permits changes only for failing proof, deployment blockers, security/runtime boundary issues, performance bottlenecks, real coupling that blocks deployment, or documented defects. Everything else waits.
>
> **Scope:** 46 code/infrastructure tasks (T0-T3) + 17 PowerShell script tasks (S0) with revised dispositions based on measurable business value, not architectural preference.

---

## Table of Contents

1. [Evaluation Framework](#evaluation-framework)
2. [Audit Findings](#audit-findings)
3. [Technical Debt Inventory](#technical-debt-inventory)
4. [PowerShell Script Inventory](#powershell-script-inventory)
5. [Script Task Evaluations](#script-task-evaluations)
6. [Self-Challenge Summary](#self-challenge-summary)
7. [Code Task Evaluations](#code-task-evaluations)
8. [Consolidated Implementation Sequence](#consolidated-implementation-sequence)
9. [What Changed From Original Plans](#what-changed-from-original-plans)
10. [Architectural Preference vs. Measurable Business Value](#architectural-preference-vs-measurable-business-value)
11. [Risk Summary](#risk-summary)
12. [Script-Code Alignment Audit](#script-code-alignment-audit)
13. [Implementation Log](#implementation-log)

---

## Evaluation Framework

### Evaluation Criteria

Each task is scored on a 3-point scale (High / Medium / Low) for:

| Criterion | Question |
|-----------|----------|
| **Production risk reduction** | Does this prevent a failure mode that will actually occur during V17 pilot? |
| **User impact** | Will end-users (merchants, warehouse operators, admins) notice if we don't do this? |
| **Operational impact** | Will the operator be unable to detect, diagnose, or recover from problems? |
| **Implementation risk** | How likely is the change itself to break something that currently works? |
| **Refactor risk** | How much of the codebase must change, and how hard is it to roll back? |
| **Evidence the problem exists** | Is there a failing test, a deployed failure, or a concrete scenario proving this is real — or is it theoretical? |

### Disposition Categories

| Disposition | Meaning |
|-------------|---------|
| **Must do before V17** | The deployment will fail, data will be lost, or a security boundary will be violated without this. |
| **Do after V17** | Valuable but not a deployment blocker. Ship V17 first, then address. |
| **Do only if a real problem appears** | The problem is theoretical for the V17 pilot. Revisit only if evidence emerges. |
| **Never do unless architecture changes significantly** | This is architectural preference, not measurable business value. The current approach works. |

---

## Audit Findings

### Executive Summary

MerHouse is a B2B fulfillment coordination platform connecting merchants, warehouse providers, and platform operators through a tenant-aware workflow. The codebase comprises 276 backend Java files, 65 frontend TypeScript files, 18 Flyway migrations, 62 PowerShell scripts, and 2 GitHub Actions workflows. V16.2 local certification is complete; V17 production activation is the active private deployment lane.

**Overall assessment:** The system is functionally complete for its current scope but carries structural debt that will make production ownership expensive if not addressed strategically. The most critical issues are not bugs — they are maintenance surface area and operational blind spots that will compound under real production load.

**Top 3 critical risks:**
1. **Authorization logic scattered across services** — `CurrentUserService` checks are interleaved with business logic in every service method.
2. **No pagination on core list endpoints** — every `findAll()` loads full result sets into memory.
3. **Monolithic frontend pages** — single 1300+ line components hold all state, data fetching, and UI for entire role workspaces.

---

### Architecture Findings

#### ARCH-1: Authorization Not Separated from Business Logic

- **Severity:** Tier 0
- **Description:** Every service method performs its own authorization check via `CurrentUserService`. No centralized auth policy.
- **Risk if left unresolved:** Silent authorization gaps leading to cross-tenant data exposure or privilege escalation.
- **Affected files:** `CurrentUserService.java`, all services with `currentUserService.*` checks
- **Recommended solution:** Create custom annotations (`@TenantScoped`, `@PlatformAdmin`) processed by Spring AOP.
- **Estimated effort:** 5-7 days
- **Disposition (revised):** Never do unless architecture changes significantly. Current pattern is explicit and readable.

#### ARCH-2: No Package-by-Domain Organization

- **Severity:** Tier 2
- **Description:** All 39 services, 30 repositories, 18 controllers, and 107 DTOs live in flat packages by layer.
- **Risk if left unresolved:** Increasing cognitive load and accidental coupling as features grow.
- **Affected files:** All `service/`, `repository/`, `web/`, `dto/`, `entity/` packages
- **Estimated effort:** 7-10 days
- **Disposition (revised):** Never do unless architecture changes significantly. Current structure is navigable.

#### ARCH-3: Service Layer Violates Domain Boundaries

- **Severity:** Tier 1
- **Description:** `FulfillmentService` directly mutates `CustomerOrder.status`. `MerchantWarehouseService` and `ServiceAccountabilityService` handle multiple domains.
- **Risk if left unresolved:** Cross-domain mutations create hidden coupling.
- **Affected files:** `FulfillmentService.java`, `MerchantWarehouseService.java`, `ServiceAccountabilityService.java`
- **Estimated effort:** 5-7 days
- **Disposition (revised):** Never do unless architecture changes significantly.

#### ARCH-4: Outbox Pattern Implemented Synchronously Within Transaction

- **Severity:** Tier 2
- **Description:** `OutboxService.publish()` inserts outbox event within same transaction as business operation.
- **Risk if left unresolved:** Outbox insert failure causes business operation rollback.
- **Affected files:** `OutboxService.java`, `OutboxProcessor.java`
- **Estimated effort:** 5-7 days (post-V17)
- **Disposition (revised):** Do after V17.

#### ARCH-5: No API Versioning Strategy Beyond URL Prefix

- **Severity:** Tier 3
- **Description:** All endpoints use `/api/v1/` prefix. No strategy for introducing v2 endpoints.
- **Risk if left unresolved:** Forced breaking changes or duplicated endpoint maintenance.
- **Estimated effort:** 2-3 days
- **Disposition (revised):** Do after V17 — when a second consumer or breaking change requires it.

---

### Backend Findings

#### BE-1: No Pagination on Data-Loading Endpoints

- **Severity:** Tier 0 → **Must do (narrowed scope)**
- **Description:** Every list endpoint returns unbounded collections. Under production data volumes, memory bomb.
- **Risk if left unresolved:** OOM errors, slow API responses, database connection exhaustion.
- **Affected files:** All repositories returning `List<>` (CustomerOrderRepository, InventoryService, MerchantWarehouseService, etc.)
- **Solution:** Add hard LIMIT caps (500 rows) to all queries. Full pagination for orders/allocations/inventory only.
- **Estimated effort:** 3-4 days

#### BE-2: DTO Proliferation with No Behavior

- **Severity:** Tier 2
- **Description:** 107 DTO files for 69 entities — many are 1:1 mappings.
- **Risk if left unresolved:** Growing maintenance burden.
- **Estimated effort:** 5-7 days (post-V17, if adopting MapStruct)
- **Disposition:** Do after V17.

#### BE-3: ProductionSafetyConfig Uses @Value Instead of @ConfigurationProperties

- **Severity:** Tier 2
- **Description:** 21 `@Value` parameters in constructor.
- **Risk if left unresolved:** Configuration errors introduced silently.
- **Estimated effort:** 1-2 days
- **Disposition:** Do after V17.

#### BE-4: FulfillmentException.status Is a String, Not an Enum

- **Severity:** Tier 3
- **Description:** String literals ("OPEN", "RESOLVED") instead of typed enum.
- **Risk if left unresolved:** Silent bugs from typos in status strings.
- **Estimated effort:** 1 day
- **Disposition:** Never do unless architecture changes. No bug; migration for consistency only.

#### BE-5: No Optimistic Locking on Hot Entities

- **Severity:** Tier 1 → **Do only if real problem appears**
- **Description:** No `@Version` field on `WarehouseInventory`, `CustomerOrder`, `FulfillmentAllocation`.
- **Risk if left unresolved:** Concurrent modifications silently overwrite each other.
- **Affected files:** Hot entity classes
- **Estimated effort:** 2-3 days
- **Disposition:** Pessimistic locks on inventory already protect; add if data corruption occurs.

#### BE-6: ShipmentPackage.status Is a String, Not an Enum

- **Severity:** Tier 3
- **Description:** Similar to BE-4.
- **Estimated effort:** 1 day
- **Disposition:** Never do unless architecture changes.

---

### Frontend Findings

#### FE-1: Monolithic API Client (742 lines)

- **Severity:** Tier 1
- **Description:** `api/client.ts` contains every API call. `api/types.ts` is 1043 lines.
- **Risk if left unresolved:** Merge conflicts, slow onboarding.
- **Estimated effort:** 3-4 days
- **Disposition:** Do after V17. File organization with no deployment impact.

#### FE-2: Monolithic Page Components (5,600+ lines total)

- **Severity:** Tier 1
- **Description:** Five page files mix data fetching, form state, conditional rendering.
- **Risk if left unresolved:** Growing complexity, merge conflicts.
- **Estimated effort:** 8-12 days
- **Disposition:** Do after V17. Zero effect on whether V17 deploys.

#### FE-3: No Custom Data-Fetching Hook

- **Severity:** Tier 1
- **Description:** Every page duplicates `useState` for data/loading/error, `useEffect` cleanup pattern (15+ times).
- **Risk if left unresolved:** Inconsistent error handling, developer friction.
- **Estimated effort:** 2-3 days
- **Disposition:** Do after V17. Valuable for DX but not deployment-blocking.

#### FE-4: Form State Managed via Per-Record Draft Objects

- **Severity:** Tier 2
- **Description:** `Record<string, Draft>` pattern repeated across pages.
- **Risk if left unresolved:** Form bugs as pages grow.
- **Estimated effort:** 2-3 days
- **Disposition:** Do after V17.

#### FE-5: Auth Token Key Uses Legacy Name

- **Severity:** Tier 3
- **Description:** `localStorage` key is `warehouse-console-token` (legacy).
- **Risk if left unresolved:** Cosmetic inconsistency.
- **Estimated effort:** 0.5 days
- **Disposition:** Never do unless architecture changes. Migration risk > benefit.

#### FE-6: Notification Polling Ignores Tab Visibility

- **Severity:** Tier 2
- **Description:** Polls every 15 seconds regardless of tab visibility.
- **Risk if left unresolved:** Wasted bandwidth.
- **Estimated effort:** 1-2 days
- **Disposition:** Do only if real problem. V17 pilot has few concurrent users.

#### FE-7: No Route-Based Code Splitting

- **Severity:** Tier 2
- **Description:** All page components statically imported; entire bundle loads upfront.
- **Risk if left unresolved:** Slow initial load.
- **Estimated effort:** 1-2 days
- **Disposition:** Do after V17. Current 508 KB JS / 137 KB gzip within budget.

#### FE-8: Frontend Types Manually Mirror Backend DTOs

- **Severity:** Tier 2
- **Description:** 1043-line `api/types.ts` manually mirrors backend DTOs.
- **Risk if left unresolved:** Type drift after backend changes.
- **Estimated effort:** 5-7 days
- **Disposition:** Do after V17. Requires stable OpenAPI spec.

#### FE-9: Ngrok-Specific Header in Production API Client

- **Severity:** Tier 3
- **Description:** Legacy ngrok header detection; old deployment lane replaced.
- **Risk if left unresolved:** Confusion for new developers.
- **Estimated effort:** 0.5 days
- **Disposition:** Do after V17. Remove when modifying api/client.ts.

---

### Database Findings

#### DB-1: No Automatic Multi-Tenant Data Isolation

- **Severity:** Tier 0 → **Do only if real problem appears**
- **Description:** Application-level tenant filtering; no Hibernate `@Filter` or RLS.
- **Risk if left unresolved:** Cross-tenant data leak.
- **Affected files:** All 30 repositories
- **Solution:** Add Hibernate `@FilterDef` / `@Filter` on tenant-scoped entities.
- **Estimated effort:** 3-4 days
- **Disposition:** Manual filtering works; add filter post-V17 or if leak found. Implement T1-10 (boundary tests) instead.

#### DB-2: N+1 Query Risk from @OneToMany Without @BatchSize

- **Severity:** Tier 1 → **Do after V17**
- **Description:** Collections with `FetchType.LAZY` have no `@BatchSize`.
- **Risk if left unresolved:** N+1 performance degradation.
- **Affected files:** `CustomerOrder.java`, `FulfillmentAllocation.java`, `Shipment.java`
- **Solution:** Add `@BatchSize(size = 50)` on all `@OneToMany` collections.
- **Estimated effort:** 1-2 days
- **Disposition:** Do after V17. Pagination reduces impact; low-risk to defer.

#### DB-3: No Flyway Migration Rollback Testing

- **Severity:** Tier 1 → **Must do before V17**
- **Description:** Migrations validated forward but no rollback testing.
- **Risk if left unresolved:** Extended downtime from failed migration with no rollback.
- **Affected files:** 18 Flyway migrations
- **Solution:** Document manual rollback strategy for each migration.
- **Estimated effort:** 2-3 days
- **Disposition:** Production deployment runs migrations against live data for first time.

#### DB-4: JSONB Attributes Column Has No Schema Validation

- **Severity:** Tier 2
- **Description:** `InventoryItem.attributes` (JSONB) unvalidated.
- **Risk if left unresolved:** Data quality degradation.
- **Estimated effort:** 2-3 days
- **Disposition:** Do only if problem appears. App code structures correctly.

#### DB-5: Deep EntityGraph Paths Cause Large JOINs

- **Severity:** Tier 2
- **Description:** Deep fetch produces Cartesian product for orders with many items/allocations.
- **Risk if left unresolved:** Slow single-order queries under production data.
- **Affected files:** `CustomerOrderRepository.java` (lines 15-26)
- **Estimated effort:** 2-3 days
- **Disposition:** Do after V17. Pagination addresses list-query case.

---

### Security Findings

#### SEC-1: Custom JWT Implementation Instead of Standard Library

- **Severity:** Tier 0 → **Do only if real problem appears**
- **Description:** `JwtService.java` implements JWT manually using `Mac`/`SecretKeySpec`.
- **Risk if left unresolved:** Security audit failure; potential vulnerability.
- **Affected files:** `JwtService.java` (131 lines)
- **Solution:** Replace with `spring-boot-starter-oauth2-resource-server` + Nimbus JOSE.
- **Estimated effort:** 2-3 days
- **Disposition:** Custom implementation uses HMAC-SHA256 correctly. No known vulnerability. Replacement is high risk for zero user benefit during pilot.

#### SEC-2: No Rate Limiting on Login Endpoint

- **Severity:** Tier 0 → **Must do before V17** ~~✓ COMPLETED~~
- **Description:** Login endpoint has no rate limiting. Recovery and access-request endpoints have throttling.
- **Risk if left unresolved:** Brute-force password attacks.
- **Affected files:** `AuthController.java`, `SecurityConfig.java`
- **Solution:** In-memory rate limiter: 5 failed attempts per email per 15 minutes.
- **Estimated effort:** 1 day

#### SEC-3: No Token Refresh or Rotation Mechanism

- **Severity:** Tier 1 → **Do after V17**
- **Description:** JWTs expire after 1 hour. After expiry, user must re-authenticate.
- **Risk if left unresolved:** User frustration; increased login load.
- **Affected files:** `JwtService.java`, `AuthContext.tsx`
- **Solution:** Implement refresh tokens with rotation.
- **Estimated effort:** 3-5 days
- **Disposition:** 1-hour re-login acceptable for pilot. Do post-V17.

#### SEC-4: CSRF Disabled

- **Severity:** Tier 3
- **Description:** CSRF protection explicitly disabled in `SecurityConfig.java`.
- **Risk if left unresolved:** None if API remains JWT-authenticated.
- **Recommended solution:** Add comment explaining why.
- **Estimated effort:** 0.5 days
- **Disposition:** Do after V17. Add comment when editing SecurityConfig.

#### SEC-5: CORS Credentials Disabled

- **Severity:** Tier 3
- **Description:** `allowCredentials(false)`. App uses Bearer tokens instead.
- **Risk if left unresolved:** Cannot use HttpOnly cookies without CORS credential support.
- **Affected files:** `SecurityConfig.java` (line 61)
- **Disposition:** Revisit only if SEC-3 (refresh tokens) adopts HttpOnly cookie storage.

---

### Performance Findings

#### PERF-1: OrderService.findAll() Triggers N+1 at Service Level

- **Severity:** Tier 1 → **Merged into T0-1 (pagination)**
- **Description:** `OrderService.findAll()` calls `get(order.getId())` in stream — N+1 at service level.
- **Risk if left unresolved:** Severe latency on order list endpoint.
- **Affected files:** `OrderService.java` (lines 136-154)
- **Solution:** Create `findAllWithMerchant()` query; reserve deep graph for detail page.
- **Estimated effort:** Included in T0-1.
- **Disposition:** Fix as part of pagination implementation.

#### PERF-2: No Application Metrics

- **Severity:** Tier 0 → **Do after V17**
- **Description:** No Micrometer, no Prometheus, no alerting.
- **Risk if left unresolved:** Blind production operation; incidents discovered through user complaints.
- **Affected files:** `pom.xml`, `HealthController.java`
- **Solution:** Add `micrometer-registry-prometheus`; expose `/actuator/prometheus`.
- **Estimated effort:** 3-5 days
- **Disposition:** Monitoring proof script provides minimum observability. Prometheus is upgrade, not gate.

#### PERF-3: No Connection Pool Tuning

- **Severity:** Tier 2
- **Description:** No HikariCP configuration; relies on Spring Boot defaults (10 connections).
- **Risk if left unresolved:** Connection exhaustion or wasted resources.
- **Estimated effort:** 1 day
- **Disposition:** Do after V17. Tune based on production load data.

#### PERF-4: No Frontend Bundle Size Tracking

- **Severity:** Tier 2
- **Description:** `vite.config.ts` warns at 650 KB but no CI enforcement.
- **Risk if left unresolved:** Bundle size creeps; slow initial load.
- **Solution:** Add `rollup-plugin-visualizer`; CI enforces budget.
- **Estimated effort:** 1 day
- **Disposition:** Do after V17. Current bundle within budget.

---

### Testing Findings

#### TEST-1: No Authorization Boundary Tests

- **Severity:** Tier 1 → **Must do before V17** (reframed as T1-10)
- **Description:** No test verifies tenant A cannot access tenant B's data.
- **Risk if left unresolved:** Silent authorization regressions.
- **Affected files:** All 36 backend test files
- **Solution:** Add `@WebMvcTest` controller tests for authorization rules.
- **Estimated effort:** 3-5 days (focused on sensitive endpoints)
- **Disposition:** Replaces T0-2 (Hibernate filter). Tests actively catch mistakes.

#### TEST-2: No Concurrency Tests for Inventory Allocation

- **Severity:** Tier 1 → **Do only if real problem appears**
- **Description:** Pessimistic write locks exist but no test verifies correct behavior under concurrent access.
- **Risk if left unresolved:** Data corruption under concurrent allocation.
- **Estimated effort:** 2-3 days
- **Disposition:** Pessimistic locks protect; add test if over-reservation occurs.

#### TEST-3: No Accessibility Validation Tests

- **Severity:** Tier 2
- **Description:** No automated accessibility testing (axe-core, pa11y).
- **Risk if left unresolved:** Accessibility regressions.
- **Estimated effort:** 2-3 days
- **Disposition:** Do after V17. Important but not V17 gate.

#### TEST-4: No Network Failure Simulation Tests

- **Severity:** Tier 2
- **Description:** Frontend tests mock successful responses only.
- **Risk if left unresolved:** Frontend crashes on API outage.
- **Estimated effort:** 2-3 days
- **Disposition:** Do after V17.

#### TEST-5: Playwright E2E Coverage Unknown

- **Severity:** Tier 2
- **Description:** E2E tests exist but coverage scope undocumented.
- **Risk if left unresolved:** False confidence in E2E coverage.
- **Estimated effort:** 3-5 days
- **Disposition:** Do after V17.

#### TEST-6: No Load/Performance Test Suite

- **Severity:** Tier 1 → **Do after V17**
- **Description:** Only `load-smoke.ps1` PowerShell script; no automated load tests in CI.
- **Risk if left unresolved:** Performance regressions undetected.
- **Estimated effort:** 3-5 days
- **Disposition:** Existing script provides basic validation. Add k6/Gatling post-V17.

---

### Documentation Findings

#### DOC-1: No API Usage Guide for External Developers

- **Severity:** Tier 2
- **Description:** OpenAPI/Swagger exists but no onboarding guide.
- **Risk if left unresolved:** Poor developer experience; increased support.
- **Estimated effort:** 3-5 days
- **Disposition:** Do after V17. Only needed for external integration.

#### DOC-2: No Operational Runbook

- **Severity:** Tier 1 → **Must do before V17** (T1-14)
- **Description:** No incident response or operational runbook.
- **Risk if left unresolved:** Ad-hoc incident response; extended downtime.
- **Affected files:** `docs/operations/`
- **Solution:** Create runbook covering incident classification, rollback, recovery, common failures.
- **Estimated effort:** 2-3 days
- **Disposition:** Roadmap requires it. Does not depend on Prometheus.

#### DOC-3: No CONTRIBUTING.md

- **Severity:** Tier 2
- **Description:** No contribution guide.
- **Risk if left unresolved:** Onboarding friction.
- **Estimated effort:** 1-2 days
- **Disposition:** Do after V17. Repository not yet open.

#### DOC-4: No CHANGELOG.md

- **Severity:** Tier 2
- **Description:** No changelog.
- **Risk if left unresolved:** No record of what changed between versions.
- **Estimated effort:** 1-2 days
- **Disposition:** Do after V17.

#### DOC-5: Database Schema Not Documented Beyond Migrations

- **Severity:** Tier 2
- **Description:** Schema defined only in 18 Flyway files.
- **Risk if left unresolved:** Slow onboarding.
- **Estimated effort:** 1-2 days
- **Disposition:** Do after V17.

---

### DevOps / Infrastructure Findings

#### INFRA-1: No Database Backup/Restore Automation

- **Severity:** Tier 0 → **Must do before V17** (T0-3)
- **Description:** No automated backup. Manual `pg_dump` scripts only.
- **Risk if left unresolved:** Permanent data loss.
- **Solution:** Verify Neon PITR enabled; write restore verification script; document procedure.
- **Estimated effort:** 1-2 days
- **Disposition:** Production deployment requires recovery path.

#### INFRA-2: No Meaningful Health/Readiness Endpoints

- **Severity:** Tier 0 → **Must do before V17** ~~✓ COMPLETED~~ (T0-4)
- **Description:** `/api/v1/health` returns unconditional UP — even if DB is down.
- **Risk if left unresolved:** Traffic routed to unhealthy instances.
- **Affected files:** `HealthController.java`
- **Solution:** Add Spring Boot Actuator with database connectivity check.
- **Estimated effort:** 1-2 days

#### INFRA-3: No Pre-Commit Hooks

- **Severity:** Tier 2
- **Description:** No linting/formatting hooks; all checks run in CI.
- **Risk if left unresolved:** Slow feedback loop.
- **Estimated effort:** 1-2 days
- **Disposition:** Do after V17. Developer convenience.

#### INFRA-4: No Automated Dependency Updates

- **Severity:** Tier 2
- **Description:** No Dependabot or Renovate configuration.
- **Risk if left unresolved:** Known vulnerabilities unpatched.
- **Estimated effort:** 0.5 days
- **Disposition:** Do after V17. Quick, safe change.

#### INFRA-5: No Backend Container Health Check in Docker Compose

- **Severity:** Tier 3
- **Description:** `docker-compose.yml` backend service has no health check.
- **Risk if left unresolved:** Flaky local development startup.
- **Estimated effort:** 0.5 days
- **Disposition:** Include as part of T0-4 (health endpoints).

#### INFRA-6: No PowerShell Script Linting

- **Severity:** Tier 3
- **Description:** Scripts parse-checked but not linted with PSScriptAnalyzer.
- **Risk if left unresolved:** Subtle script bugs.
- **Estimated effort:** 1-2 days
- **Disposition:** Do after V17.

#### INFRA-7: CI Quality Gate Total Duration Potentially Exceeds 30 Minutes

- **Severity:** Tier 2
- **Description:** Integration job has 35-minute timeout; total gate may exceed 30 min.
- **Risk if left unresolved:** Slow development feedback loop.
- **Estimated effort:** 2-3 days
- **Disposition:** Do after V17. Profile and optimize.

---

## Technical Debt Inventory

### Backend Debt

| ID | Area | Severity | Description |
|----|------|----------|-------------|
| BD-1 | DTO | Tier 2 | 107 DTO files for 69 entities |
| BD-2 | DTO | Tier 2 | Static `from()` factory methods couple entities to DTOs |
| BD-3 | Service | Tier 1 | `ServiceAccountabilityService` 860 lines, 5 sub-domains |
| BD-4 | Service | Tier 1 | `MerchantWarehouseService` 689 lines, 2 domains |
| BD-5 | Auth | Tier 0 | Authorization in service methods (current pattern works) |
| BD-6 | Data | Tier 0 | Pagination needed on high-volume endpoints (orders, allocations) |
| BD-7 | Data | Tier 1 | No `@BatchSize` on `@OneToMany` — N+1 risk |
| BD-8 | Security | Tier 0 | Custom JWT (works correctly, no known vulnerability) |
| BD-9 | Security | Tier 1 | No token refresh/rotation |
| BD-10 | Data | Tier 0 | No Hibernate `@Filter` for tenant isolation (manual filtering works) |
| BD-11 | Outbox | Tier 2 | `OutboxService.publish()` synchronous within transaction |
| BD-12 | Config | Tier 2 | 21 `@Value` params instead of `@ConfigurationProperties` |
| BD-13 | Entity | Tier 3 | `FulfillmentException.status` is String, not enum |
| BD-14 | API | Tier 3 | No versioning strategy beyond `/api/v1/` |
| BD-15 | Data | Tier 2 | `InventoryItem.attributes` JSONB unvalidated |
| BD-16 | Entity | Tier 3 | `ShipmentPackage.status` strings instead of enum |
| BD-17 | Entity | Tier 1 | No `@Version` optimistic locking on hot entities |

### Frontend Debt

| ID | Area | Severity | Description |
|----|------|----------|-------------|
| FD-1 | Architecture | Tier 1 | `api/client.ts` 742 lines |
| FD-2 | Architecture | Tier 1 | `api/types.ts` 1043 lines |
| FD-3 | Components | Tier 1 | Monolithic pages (5,600+ lines total) |
| FD-4 | Data fetching | Tier 1 | No custom data-fetching hook (15+ duplicates) |
| FD-5 | State | Tier 2 | Form state via per-record draft objects |
| FD-6 | Auth | Tier 3 | Token key `warehouse-console-token` (legacy) |
| FD-7 | Polling | Tier 2 | Notification polling ignores tab visibility |
| FD-8 | Types | Tier 2 | Frontend types manually mirror backend |
| FD-9 | Routing | Tier 2 | No route-based code splitting |
| FD-10 | Legacy | Tier 3 | Ngrok header in production API client |

### Infrastructure Debt

| ID | Area | Severity | Description |
|----|------|----------|-------------|
| ID-1 | CI | Tier 2 | Quality gate potentially exceeds 30 min |
| ID-2 | Backup | Tier 0 | No database backup/restore automation |
| ID-3 | Health | Tier 0 | No meaningful health/readiness endpoints |
| ID-4 | Monitoring | Tier 0 | No application metrics |
| ID-5 | Scripts | Tier 2 | PowerShell path resolution patterns inconsistent |

---

## PowerShell Script Inventory

### Overview

56 scripts across 6 subdirectories, totaling ~40,000 lines:

| Directory | Scripts | Total Lines | Purpose |
|-----------|---------|-------------|---------|
| `scripts/api/` | 1 runner + 4 lib + 17 scenarios | ~15,000 | API smoke test suite |
| `scripts/deploy/` | 2 | ~230 | Deployment shape checks, Space sync |
| `scripts/local/` | 5 | ~1,200 | Local stack start/stop/seed/dev |
| `scripts/maintenance/` | 1 | ~110 | Report cleanup |
| `scripts/proof/` | 5 android + 10 release + 2 web + 2 lib | ~18,000 | V17 deployment proof scripts |
| `scripts/quality/` | 9 | ~5,200 | Local quality gate, readiness checks |

### Script-Specific Self-Challenge

Before task-by-task evaluation, here are places where script refactoring enthusiasm must be checked:

1. **HTTP client consolidation (4 implementations) → Do only if a real problem appears.** The four helpers serve different contexts (api/lib, seed-demo closure, native-android ADB handling, deployed-v17-proof custom auth). Consolidating is 3-5 days of high-risk refactoring with zero user benefit.

2. **Credential parameter boilerplate → Never do.** Repeated `-AdminEmail`, `-AdminPassword` parameters are boilerplate but they're the public interface of independent proof scripts. Extracting would break CI workflows and operator muscle memory.

3. **Proof fixture generator breakup → Do after V17.** Large, but test fixture generators. Extracting to separate files is good hygiene but has no deployment impact.

4. **Monolithic native-android-tour.ps1 (863 lines) → Do after V17.** Large but self-contained. Splitting would improve maintainability but has zero deployment impact.

5. **Package-by-purpose reorganization → Never do.** Moving scripts between subdirectories is folder organization, not deployment work.

---

## Script Task Evaluations

### S0-1: Fix Corrupted Function Names in tour-report-lib.ps1

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | Any proof script dot-sourcing fails at runtime |
| User impact | **Low** | Users don't run proof scripts |
| Operational impact | **High** | Proof scripts cannot produce V17 evidence |
| Implementation risk | **Low** | Three single-word replacements |
| Refactor risk | **Low** | No behavior change |
| Evidence the problem exists | **High** | `ooin-Path` (lines 13, 28) and `ConvertFrom-oson` (line 59) are invalid cmdlets |

**Disposition: Must do before V17**

**Scope:** Fix three corrupted function names:
- Line 13: `ooin-Path` → `Join-Path`
- Line 28: `ooin-Path` → `Join-Path`
- Line 59: `ConvertFrom-oson` → `ConvertFrom-Json`

**Estimated effort:** 5 minutes

**Status:** ~~✓ COMPLETED~~

---

### S0-2: Shared Common Library (Project Root + Path Resolution)

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | Three different `$projectRoot` patterns; subtle bugs if script moved |
| User impact | **Low** | Users don't see path resolution |
| Operational impact | **Medium** | Wrong root causes script failure |
| Implementation risk | **Low** | Additive library; mechanical replacement |
| Refactor risk | **Low** | Per-script 2-line changes |
| Evidence the problem exists | **High** | 25+ instances with 3 patterns, `IsPathRooted` ternary appears 25+ times |

**Disposition: Must do before V17**

**Scope:**
1. Create `scripts/lib/common.ps1` with:
   - `Get-MerHouseProjectRoot` — resolves project root from any script depth
   - `Resolve-MerHousePath` — replaces `IsPathRooted` ternary pattern
2. Dot-source in every script that resolves paths
3. Replace inline computations with shared functions

**Estimated effort:** 2-3 hours

**Status:** ~~✓ COMPLETED~~

---

### S0-3: Extract Invoke-Checked Helper

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | 3 copies are identical; no divergence |
| Evidence the problem exists | **Medium** | 3 identical copies; future bug fix must be applied 3 times |

**Disposition: Do after V17**

**Rationale:** Duplication is real but identical. Extract when modifying any of these scripts for other reasons.

**Estimated effort:** 1-2 days

---

### S0-4: Extract Assert-ProofTimestamp

**Disposition: Do after V17**

**Rationale:** 2 identical copies; no divergence observed.

**Estimated effort:** < 1 day

---

### S0-5: Extract Assert-NoSecretLeak

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | Security boundary; divergence could miss leak pattern |
| Operational impact | **Medium** | Missed leak pattern means evidence artifacts could contain secrets |

**Disposition: Do after V17** — but prioritize first wave (security boundary)

**Rationale:** 80+ lines of recursive JSON traversal in 2 scripts. Adding new sensitive field pattern requires updating both. Consolidate post-V17.

**Estimated effort:** 2 days

---

### S0-6: Extract Assert-SafeEvidenceText

**Disposition: Do only if a real problem appears**

**Rationale:** 3 copies have deliberately different regex patterns matching each proof's specific evidence requirements. Consolidate only if a new proof script needs the same pattern.

---

### S0-7: HTTP Client Consolidation

**Disposition: Do only if a real problem appears**

**Rationale:** 4 implementations serve different contexts:
- `Invoke-Json` (api/lib): Context hashtable with `BaseUrl`, `DefaultHeaders`
- `Invoke-Api` (seed-demo): Closure over `$apiBaseUrl`, `$adminToken`
- `Invoke-ApiJson` (native-android-tour): ADB port-forwarding error context
- Ad-hoc `Invoke-RestMethod` (deployed-v17-proof): Custom auth header injection

Consolidating risks breaking subtle differences (especially ADB error context, seed-demo closure behavior).

---

### S0-8: Break Up Proof Fixture Generators

**Disposition: Do after V17**

**Rationale:** `deployed-v17-proof-attachment-check.ps1` (870 lines) and `v17-cutover-readiness-check.ps1` (687 lines) generate many fixture JSON files. Extracting fixtures is good hygiene but adds file-loading dependency and makes fixture structure less visible. Not deployment work.

---

### S0-9: Split native-android-tour.ps1 (863 lines)

**Disposition: Do after V17**

**Rationale:** Large but self-contained. State flows through script-scoped variables; extraction requires careful interface design. No deployment blocker.

---

### S0-10: Consolidate Library Layer (api/lib + proof/lib → scripts/lib)

**Disposition: Do after V17**

**Rationale:** Current split reflects two main script families. S0-2 already creates top-level `lib/` without requiring full consolidation. Post-V17, if shared library count grows, consolidate then.

---

### S0-11: Deduplicate api-smoke.ps1 Wrapper

**Disposition: Never do unless architecture changes significantly**

**Rationale:** `quality/api-smoke.ps1` wraps `api/run-all.ps1` with additional URL normalization and path resolution. This is intentional defense-in-depth. Removing eliminates validation layer.

---

### S0-12: seed-demo.ps1 HTTP Client Extraction

**Disposition: Do only if a real problem appears**

**Rationale:** `Invoke-Api` uses closure variables (`$apiBaseUrl`, `$adminToken`). Replacing with shared `Invoke-Json` requires restructuring script to use context hashtable—significant change for a seed data script.

---

### S0-13: Extract Read-EnvFile from huggingface-space-sync.ps1

**Disposition: Do after V17** — when a second consumer appears

**Rationale:** Only one consumer today.

---

### S0-14: Credential Parameter Boilerplate

**Disposition: Never do unless architecture changes significantly**

**Rationale:** Repeated credential parameters are the public interface of independent proof scripts. Extracting breaks CI workflows and operator muscle memory.

---

### S0-15: report.ps1 Monolith (530 lines)

**Disposition: Do after V17**

**Rationale:** Report generation works correctly. Not a deployment blocker.

---

### S0-16: native-mobile-check.ps1 Split (457 lines)

**Disposition: Do after V17**

**Rationale:** Android validation with internal state. Splitting would improve maintainability but has zero deployment impact.

---

### S0-17: v17-cutover-readiness.ps1 Validation Engine (695 lines)

**Disposition: Do after V17**

**Rationale:** Validation logic works correctly. Not a deployment blocker.

---

## Self-Challenge Summary: Code & Architecture

Before the task-by-task code evaluation, here are key places where the original audit recommendations were wrong or overstated:

1. **Custom JWT (originally Tier 0) → Do only if a real problem appears.** Implementation includes constant-time comparison, minimum 32-byte secrets, correct HMAC-SHA256 using `javax.crypto.Mac`. No known vulnerability. Replacing touches every authenticated request with high regression risk and zero measurable security benefit for a private pilot. An external audit would flag it — but no audit is scheduled.

2. **Pagination (originally Tier 0) → Must do before V17, but narrowed scope.** Unbounded queries are a real risk, but V17 pilot has small number of tenants/records. Full pagination on every endpoint is overkill. Only high-volume endpoints (orders, allocations, inventory) need pagination; rest can be capped.

3. **Tenant isolation via Hibernate filter (originally Tier 0) → Do only if a real problem appears.** Application-level filtering works — every query includes `CurrentUserService.requireAdminOrTenant()`. Hibernate `@Filter` adds defense-in-depth but has high implementation risk (misconfigured filter could break admin cross-tenant queries). Existing manual filtering tested through V16.2. Add post-V17 or if leak found.

4. **Authorization aspect extraction (originally Tier 1) → Never do unless architecture changes significantly.** Moving checks to AOP annotations is architectural preference. Current pattern works, is readable, has been tested. Would touch every service method and test with high regression risk. A missed annotation gives unauthorized access just as easily as a missed method call.

5. **Domain extraction from large services (originally Tier 1) → Never do unless architecture changes significantly.** Splitting `MerchantWarehouseService` and `ServiceAccountabilityService` is file organization, not deployment blocker. No user affected by which class a method lives in. High refactor risk, explicitly prohibited by V17 rule.

6. **Metrics / Prometheus (originally Tier 0) → Do after V17.** Hugging Face Spaces provides built-in logs and basic health monitoring. Deployed monitoring proof script (`deployed-monitoring-proof.ps1`) samples endpoint health with latency budgets. Full Prometheus/Micrometer integration is valuable but not required — existing script provides minimum viable observability.

7. **Frontend monolithic pages (originally Tier 1) → Do after V17.** No user-visible defect, no deployment blocker. Pages work. Splitting is 8-12 days of high-risk refactoring with zero effect on whether V17 deploys.

---

## Code Task Evaluations

### Tier 0 Tasks: Production Blockers (6 tasks, 10-14 days total)

#### T0-1: Pagination on List Endpoints

**Disposition: Must do before V17** — narrowed scope

**Revised scope:** Add hard LIMIT caps (500 rows) to all unbounded queries. Full pagination (page/size/sort) only for orders, allocations, inventory.

**Estimated effort:** 3-4 days

#### T0-3: Backup/Restore Verification

**Disposition: Must do before V17**

**Scope:**
1. Verify Neon PITR enabled for production database
2. Write restore verification script
3. Document backup/restore procedure
4. Run restore drill

**Estimated effort:** 1-2 days

#### T0-4: Health/Readiness Endpoints

**Disposition: Must do before V17** ~~✓ COMPLETED~~

**Scope:**
1. Add `spring-boot-starter-actuator` dependency
2. Configure `/actuator/health` with database connectivity check
3. `/api/v1/health` delegates to actuator
4. Docker Compose backend health check

**Estimated effort:** 1-2 days

#### T0-6: Login Rate Limiting

**Disposition: Must do before V17** ~~✓ COMPLETED~~

**Scope:** In-memory rate limiter, 5 failed attempts per email per 15 minutes, returns 429 with `Retry-After`

**Estimated effort:** 1 day

#### T1-13: Migration Rollback Documentation

**Disposition: Must do before V17**

**Scope:**
1. Document manual rollback strategy for each migration
2. Test documented rollback works
3. No code changes; documentation and testing only

**Estimated effort:** 2-3 days

#### T1-14: Operational Runbook

**Disposition: Must do before V17**

**Scope:** Incident classification, escalation, rollback, recovery, common failures. Does not depend on Prometheus.

**Estimated effort:** 2-3 days

#### T1-10: Authorization Boundary Tests (reframed from T0-2)

**Disposition: Must do before V17**

**Scope:** Add `@WebMvcTest` controller tests verifying:
- Tenant A cannot access Tenant B's data
- MERCHANT cannot access ADMIN endpoints
- WAREHOUSE_OPERATOR cannot access MERCHANT-only endpoints
- SUSPENDED users cannot mutate

**Estimated effort:** 3-5 days (focused on sensitive endpoints)

---

### Tier 1 Tasks: High Priority (post-V17 or do-if-problem)

All Tier 1 tasks from the original plan are reclassified as either:
- **Do after V17** — valuable but not deployment blockers (T1-3, T1-4, T1-5, T1-7, T1-9, T1-12)
- **Do only if problem appears** — theoretical risk, no evidence (T0-2, T1-6, T1-11)
- **Never do** — architectural preference (T1-1, T1-2)
- **Merged into T0** — part of other tasks (T1-8 merged into T0-1)

**Estimated effort (post-V17 wave 1):** 3-5 days each for T1-9, T1-12; 2-3 days each for others.

---

### Tier 2 Tasks: Medium Priority (post-V17)

22 tasks including frontend refactoring, documentation, tooling, dev experience improvements.

**Estimated effort:** 33-48 days total, spread over months post-V17.

---

### Tier 3 Tasks: Low Priority / Nice-to-Have (8 tasks)

Cosmetic improvements and documentation. No deployment impact.

**Estimated effort:** 6-8 days total.

---

## Consolidated Implementation Sequence

### Must Do Before V17 (7 tasks + scripts, ~14-18 days)

| Seq | Task | Effort | Dependencies |
|-----|------|--------|--------------|
| 1 | **Scripts S0-1** (Fix corrupted functions) | 5 min | None |
| 2 | **Scripts S0-2** (Shared path library) | 2-3 hrs | None |
| 3 | **T0-4** (Health endpoints) | 1-2 days | None |
| 4 | **T0-6** (Login rate limiting) | 1 day | None |
| 5 | **T0-1** (Pagination + N+1 fix) | 3-4 days | None |
| 6 | **T1-10** (Authorization boundary tests) | 3-5 days | None |
| 7 | **T0-3** (Backup/restore verification) | 1-2 days | None |
| 8 | **T1-13** (Migration rollback docs) | 2-3 days | None |
| 9 | **T1-14** (Operational runbook) | 2-3 days | None |

**Execution order:**
- Tasks 1-2: Quick wins (15 min + 2-3 hrs)
- Tasks 3-4: Independent, small code changes (2 days)
- Task 5: Largest code change; start after 1-4 (3-4 days)
- Tasks 6-9: Can run in parallel with task 5 (documentation/testing)

**Total effort:** 10-14 days code + 2-3 days docs/tests

---

### Do After V17 (Wave 1 - First 2 Weeks)

| Task | Area | Effort |
|------|------|--------|
| T0-7 | Metrics / Prometheus | 3-5 days |
| T0-5 | Standard JWT Library | 2-3 days |
| T1-12 | Load Test Suite | 3-5 days |
| T1-9 | Token Refresh / Rotation | 3-5 days |

---

### Do After V17 (Wave 2 - Developer Experience, Within 2 Months)

| Task | Area | Effort |
|------|------|--------|
| T1-3 | useApi Data-Fetching Hook | 2-3 days |
| T1-4 | API Client Split | 3-4 days |
| T1-5 | Monolithic Page Splits | 8-12 days |
| T2-6 | ConfigurationProperties | 1-2 days |
| T1-7 | @BatchSize on @OneToMany | 1-2 days |
| T2-12 | Dependabot Configuration | 0.5 days |

---

### Do After V17 (Wave 3 - Quality & Documentation)

22 tasks including frontend types, form hooks, code splitting, a11y testing, E2E coverage audit, bundle tracking, pre-commit hooks, CI optimization, documentation (CONTRIBUTING, CHANGELOG, schema docs).

---

### Do Only If Real Problem Appears (5 tasks)

| Task | Trigger |
|------|---------|
| T0-2 | Cross-tenant data leak found |
| T1-6 | Concurrent-modification data corruption |
| T1-11 | Inventory over-reservation under load |
| T2-4 | Background polling becomes measurable cost |
| T2-13 | Invalid/inconsistent JSONB data breaks queries |

---

### Never Do Unless Architecture Changes (6 tasks)

| Task | Why |
|------|-----|
| T1-1 | Authorization Aspect | Current pattern works; AOP is style, not safety |
| T1-2 | Domain Extraction | File organization, no measurable benefit |
| T2-1 | Package-by-Domain Reorg | Cosmetic refactor prohibited by V17 rule |
| T3-2 | FulfillmentException.status Enum | No bug; migration for consistency only |
| T3-3 | ShipmentPackage Status Enums | No bug; migration for consistency only |
| T3-4 | Auth Token Key Rename | Migration risk > cosmetic benefit |

### PowerShell Scripts: Before V17 (2 tasks)

| Task | Effort | Status |
|------|--------|--------|
| S0-1 | 5 min | ~~✓ COMPLETED~~ |
| S0-2 | 2-3 hrs | ~~✓ COMPLETED~~ |

### PowerShell Scripts: After V17 (8 tasks)

First wave (security boundary): S0-5
Second wave: S0-3, S0-4, S0-8, S0-9, S0-10, S0-13, S0-15, S0-16, S0-17

---

## What Changed From Original Plans

### Downgraded from "Must do before V17"

| Task | Original | New | Why |
|------|----------|-----|-----|
| T0-2 Tenant Isolation @Filter | Tier 0 | Do only if problem | Application-level filtering works; no evidence of leak; Hibernate filter has high regression risk |
| T0-5 Standard JWT Library | Tier 0 | Do only if problem | Custom JWT uses HMAC-SHA256 correctly; no vulnerability; replacement high risk/zero benefit |
| T0-7 Metrics / Prometheus | Tier 0 | Do after V17 | Monitoring proof script provides minimum observability; Prometheus is upgrade, not gate |

### Upgraded or Newly Required

| Task | Original | New | Why |
|------|----------|-----|-----|
| T1-10 Authorization Boundary Tests | Tier 1 (after extraction) | Must do before V17 | Correct mitigation for tenant isolation; tests catch leaks; Hibernate filter changes how queries execute |
| T1-13 Migration Rollback Documentation | Tier 1 / Post-V17 | Must do before V17 | Production deployment runs migrations against live data for first time; no rollback plan = operational hazard |
| T1-14 Operational Runbook | Tier 1 / Depends on metrics | Must do before V17 | Roadmap requires it; does not depend on Prometheus |

### Reclassified as "Never Do"

| Task | Original | New | Why |
|------|----------|-----|-----|
| T1-1 Authorization Aspect | Tier 1 | Never do | Architectural preference; current pattern explicit/readable/tested; AOP not safer than explicit calls |
| T1-2 Domain Extraction | Tier 1 | Never do | File organization, no measurable benefit; prohibited by V17 rule |
| T2-1 Package-by-Domain Reorg | Tier 2 | Never do | Cosmetic refactor prohibited by V17 rule |
| T3-2/T3-3 String-to-Enum | Tier 3 | Never do | No bug; migration for consistency only |
| T3-4 Token Key Rename | Tier 3 | Never do | Migration risk exceeds cosmetic benefit |

### Merged

| Task | Into | Why |
|------|------|-----|
| T1-8 OrderService N+1 Fix | T0-1 Pagination | Same code change; fixing N+1 is prerequisite for efficient pagination |

---

## Architectural Preference vs. Measurable Business Value

The following original audit recommendations represent architectural preference, not measurable deployment value:

1. **"Authorization not separated from business logic" (ARCH-1)** — `CurrentUserService.requireAdminOrTenant()` calls in service methods are explicit, readable, debuggable. Moving to AOP annotations does not reduce the number of places where auth must be correct — it just makes them less visible.

2. **"No package-by-domain organization" (ARCH-2)** — Package-by-layer is a valid organizational strategy. Cognitive cost is a developer preference, not deployment risk.

3. **"Service layer violates domain boundaries" (ARCH-3)** — Cross-domain mutations exist but work correctly. Introducing domain events adds complexity (event routing, eventual consistency, error handling) for no user-visible benefit.

4. **"Custom JWT implementation" (SEC-1)** — Uses Java's standard `javax.crypto.Mac` with HMAC-SHA256, constant-time comparison, minimum 32-byte secrets. This is not "custom crypto" — it's using the standard crypto API directly instead of through a wrapper.

5. **"Monolithic API client" (FE-1) / "Monolithic pages" (FE-2)** — File size is a developer convenience metric, not a user-facing or deployment metric. Pages work. Splitting is 8-12 days of risk for zero user benefit.

6. **"String statuses instead of enums" (BE-4, BE-6)** — Type safety is a developer preference. String values are correct, consistent, and have caused no bugs. Adding enums requires Flyway migrations for CHECK constraints — operational risk for cosmetic gain.

---

## Risk Summary

### Risks of Doing Too Much Before V17

1. **Regression risk** — Every code change risks breaking something that works. V16.2 convergence was hard-won.
2. **Schedule risk** — Original plan had 95-141 days. Even revised "Must do" is 10-14 days. Every refactor day delays V17.
3. **Scope creep risk** — "While we're fixing pagination, let's refactor the API client" — 7 tasks become 46 tasks.
4. **Testing risk** — Refactoring invalidates tests, requiring updates that may introduce false positives/negatives.

### Risks of Doing Too Little Before V17

1. **OOM from unbounded queries** — Mitigated by T0-1 (pagination with hard caps)
2. **Brute-force attacks on login** — Mitigated by T0-6 (rate limiting)
3. **Undetected tenant isolation bugs** — Mitigated by T1-10 (authorization boundary tests), not T0-2 (Hibernate filter)
4. **No operational recovery path** — Mitigated by T0-3 (backup/restore), T1-13 (migration rollback), T1-14 (runbook)
5. **No health monitoring** — Mitigated by T0-4 (actuator health endpoint)

### The Safest Path

Do the 9 "Must do" tasks (7 code/infra + 2 script). Deploy V17. Let production evidence drive the next wave.

---

## Script-Code Alignment Audit

### Backend: Controller-to-Scenario Coverage

17 backend controllers mapped to API smoke scenarios:

| Controller | Scenarios | Status |
|---|---|---|
| AuthController | 00, 02, 14, 17 | Covered; rate limiting (scenario 17) added |
| HealthController | 18 | **Added** — scenarios 18 validate health endpoints |
| All others | Per findings | Good coverage |

**Gaps closed:**
- **Login rate limiting (T0-6)** — scenario 17 sends 6 failed logins, verifies 429 with `Retry-After`
- **Health endpoint (T0-4)** — scenario 18 validates `/api/v1/health` and `/actuator/health`

**Remaining gap:**
- **Authorization boundaries (T1-10)** — scenarios 02 and 11 include some 403 checks but lack systematic cross-tenant tests. Addressed by separate backend unit/integration tests.

### Frontend: Route Coverage

`full-tour.spec.ts` navigates all routes with all 5 roles (owner, merchant, warehouse, support-admin, auditor). **No gap for V17.**

### Mobile: Build and Proof Coverage

7 scripts cover build config, APK assembly, login, visual tour, device sync, native tour, release shape. **No gap for V17.**

### CI Workflow Alignment

Quality gate runs: backend tests, frontend tests, API smoke (includes rate limiting + health), seed-demo, frontend-full-tour, v17-production-readiness, public-readiness, HF/Vercel check, performance-readiness, mobile-shell-check, markdown-check.

**Gaps closed:**
- `public-readiness.ps1` no longer depends on `rg` (ripgrep) — uses PowerShell-native `Select-String`
- API smoke validates T0-4 (health) and T0-6 (rate limiting) at integration level

---

## Implementation Log

### Script Refactoring: COMPLETED

**Date:** 2026-06-13

#### S0-1: Fix Corrupted Functions

Fixed 3 corrupted function names in `scripts/proof/lib/tour-report-lib.ps1`:
- Line 13: `ooin-Path` → `Join-Path`
- Line 28: `ooin-Path` → `Join-Path`
- Line 59: `ConvertFrom-oson` → `ConvertFrom-Json`

#### S0-2: Shared Common Library

Created `scripts/lib/common.ps1` with:
- `Get-MerHouseProjectRoot` — resolves project root from any script depth using `$PSScriptRoot` traversal
- `Resolve-MerHousePath` — replaces the `IsPathRooted` ternary pattern

Updated 30+ scripts across all categories to:
- Dot-source the common library
- Use `Get-MerHouseProjectRoot` instead of inline path computation
- Use `Resolve-MerHousePath` instead of `IsPathRooted` ternaries

**Parse validation:** 63 scripts, 0 failures

**Runtime fixes:**
- `deployed-v17-proof-attachment-check.ps1`: `$projectRoot.Path.Replace(...)` → `$projectRoot.Replace(...)`
- `performance-readiness.ps1`: `$projectRoot.Path.Length` → `$projectRoot.Length`

**Runtime validation:** `v17-production-readiness.ps1` executed successfully through 15/16 checks.

---

### Backend: T0-4 Health Endpoints — COMPLETED

**Date:** 2026-06-13

**Changes:**

1. **`backend/pom.xml`** — Added `spring-boot-starter-actuator` dependency
2. **`backend/src/main/resources/application.properties`** — Actuator configuration:
   - `management.endpoints.web.exposure.include=health`
   - `management.endpoint.health.show-details=when-authorized`
   - `management.health.livenessstate.enabled=true`
   - `management.health.readinessstate.enabled=true`
3. **`backend/src/main/java/com/merhouse/web/HealthController.java`** — Real DB connectivity check via `Connection.isValid(2)`. Returns UP when DB reachable, DOWN when not.
4. **`backend/src/main/java/com/merhouse/config/SecurityConfig.java`** — `/actuator/health/**` added to permit-all
5. **`backend/src/test/java/com/merhouse/web/ApiControllerTest.java`** — Updated tests for health endpoint
6. **`docker-compose.yml`** — Backend service health check + frontend `depends_on: condition: service_healthy`

**Test proof:** 204 tests pass

---

### Backend: T0-6 Login Rate Limiting — COMPLETED

**Date:** 2026-06-13

**Changes:**

1. **`backend/src/main/java/com/merhouse/security/LoginRateLimiter.java`** — New in-memory rate limiter: 5 failures per email per 15 minutes
2. **`backend/src/main/java/com/merhouse/security/LoginRateLimitExceededException.java`** — New exception mapped to 429
3. **`backend/src/main/java/com/merhouse/service/AuthService.java`** — Integrated rate limiter
4. **`backend/src/main/java/com/merhouse/web/ApiExceptionHandler.java`** — Added 429 handler with `Retry-After` header
5. **Tests:** 7 LoginRateLimiterTest tests + updated AuthServiceTest + AuthControllerTest

**Test proof:** 213 tests pass

---

### API Smoke Tests: Script-Code Alignment

**Date:** 2026-06-14

**Changes:**

1. **`scripts/api/scenarios/17-login-rate-limit.ps1`** — New scenario: 5 failed logins → 401, 6th → 429 with `Retry-After`, different email works
2. **`scripts/api/scenarios/18-health-endpoint.ps1`** — New scenario: `/api/v1/health` returns UP, `/actuator/health` includes DB health
3. **`scripts/api/run-all.ps1`** — Added scenarios 17 and 18 to smoke suite

---

### Deployment Scripts: Fixes

**Date:** 2026-06-14

**Changes:**

1. **`scripts/quality/public-readiness.ps1`** — Replaced `rg` dependency with PowerShell-native `Get-ChildItem` + `Select-String`
2. **`scripts/deploy/huggingface-space-sync.ps1`** — Four fixes:
   - Removed `/NFL /NDL` from robocopy for visibility
   - Added post-robocopy verification
   - Replaced unreliable Python stdin with temp file execution
   - Added `$LASTEXITCODE` checks

---

## Summary

**Before V17:** 9 tasks (~14-18 days total)
- Script fixes: S0-1, S0-2 (3 hours)
- Code/infra: T0-4, T0-6, T0-1, T0-3, T1-10, T1-13, T1-14 (10-14 days)

**Completed:** S0-1, S0-2, T0-4, T0-6 (+ script/test alignment)

**Remaining before V17:** T0-1, T0-3, T1-10, T1-13, T1-14

**After V17:** 22+ tasks across three waves (Wave 1: first 2 weeks; Wave 2: first 2 months; Wave 3: as needed)

**Never do:** 6 architectural-preference tasks

**Do if problem appears:** 5 low-evidence tasks
