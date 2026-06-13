# MerHouse Implementation Sequence

> **Purpose:** Re-evaluate every task from `REFACTOR_PLAN.md` against the single goal: the safest path to a successful V17 deployment.
> **Constraint:** The V17 refactoring rule (`docs/architecture/roadmap.md` line 110) permits changes only for failing proof, deployment blockers, security/runtime boundary issues, performance bottlenecks, real coupling that blocks deployment, or documented defects. Everything else waits.
> **Method:** Each task is scored on six dimensions, then assigned one of four dispositions. I challenge my own original recommendations and flag where I was promoting architectural preference over measurable deployment value.

---

## Evaluation Criteria

Each task is scored on a 3-point scale (High / Medium / Low) for:

| Criterion | Question |
|-----------|----------|
| **Production risk reduction** | Does this prevent a failure mode that will actually occur during V17 pilot? |
| **User impact** | Will end-users (merchants, warehouse operators, admins) notice if we don't do this? |
| **Operational impact** | Will the operator be unable to detect, diagnose, or recover from problems? |
| **Implementation risk** | How likely is the change itself to break something that currently works? |
| **Refactor risk** | How much of the codebase must change, and how hard is it to roll back? |
| **Evidence the problem exists** | Is there a failing test, a deployed failure, or a concrete scenario proving this is real — or is it theoretical? |

## Disposition Categories

| Disposition | Meaning |
|-------------|---------|
| **Must do before V17** | The deployment will fail, data will be lost, or a security boundary will be violated without this. |
| **Do after V17** | Valuable but not a deployment blocker. Ship V17 first, then address. |
| **Do only if a real problem appears** | The problem is theoretical for the V17 pilot. Revisit only if evidence emerges. |
| **Never do unless architecture changes significantly** | This is architectural preference, not measurable business value. The current approach works. |

---

## Self-Challenge Summary

Before the task-by-task evaluation, here are the key places where my original audit recommendations were wrong or overstated:

1. **Custom JWT (originally Tier 0) → Do only if a real problem appears.** The implementation includes constant-time comparison, minimum secret length, and correct HMAC-SHA256. There is no known vulnerability. Replacing it is high implementation risk (touches every authenticated request) with zero measurable security benefit for a private pilot. An external security audit would flag it — but no audit is scheduled for V17.

2. **Pagination (originally Tier 0) → Must do before V17, but narrowed scope.** Unbounded queries are a real risk, but the V17 pilot will have a small number of tenants and records. Full pagination on every endpoint is overkill. Only the endpoints most likely to grow fast (orders, allocations) need pagination before deployment; the rest can be capped.

3. **Tenant isolation via Hibernate filter (originally Tier 0) → Do only if a real problem appears.** The current application-level filtering works — every query includes `CurrentUserService.requireAdminOrTenant()`. A Hibernate `@Filter` would add defense-in-depth, but the implementation risk is high (it changes how every query executes), and a misconfigured filter could break admin cross-tenant queries. The existing manual filtering has been tested through V16.2 convergence. Add `@Filter` post-V17 or if a cross-tenant leak is found.

4. **Authorization aspect extraction (originally Tier 1) → Never do unless architecture changes significantly.** Moving auth checks from service methods to AOP annotations is an architectural preference. The current pattern works, is readable, and has been tested. The change would touch every service method and every test, with high regression risk and zero user-visible benefit. The stated concern — "a single missed check gives unauthorized access" — is equally true with annotations (a missed annotation gives unauthorized access).

5. **Domain extraction from large services (originally Tier 1) → Never do unless architecture changes significantly.** Splitting `MerchantWarehouseService` and `ServiceAccountabilityService` is file organization, not a deployment blocker. No user is affected by which class a method lives in. The change has high refactor risk and is explicitly prohibited by the V17 refactoring rule.

6. **Metrics / Prometheus (originally Tier 0) → Do after V17.** Hugging Face Spaces provides built-in logs and basic health monitoring. The deployed monitoring proof script (`deployed-monitoring-proof.ps1`) samples endpoint health with latency budgets. Full Prometheus/Micrometer integration is valuable but not required to deploy — the existing monitoring proof script provides the minimum viable observability for the first pilot.

7. **Frontend monolithic pages (originally Tier 1) → Do after V17.** No user-visible defect. No deployment blocker. The pages work. Splitting them is 8-12 days of high-risk refactoring that could introduce regressions, with zero effect on whether V17 deploys successfully.

---

## Task Evaluations

### T0-1: Pagination on List Endpoints

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | Unbounded queries will OOM under data growth — not theoretical |
| User impact | **Medium** | Users won't see pagination directly, but slow/failing pages affect them |
| Operational impact | **Medium** | OOM crashes are hard to diagnose without pagination context |
| Implementation risk | **Medium** | Changes repository/controller/service signatures; frontend must adapt |
| Refactor risk | **Medium** | Broad but mechanical changes; rollback is straightforward |
| Evidence the problem exists | **High** | `OrderService.findAll()` line 143 calls `get()` per order (N+1); grep shows 25+ `findAll` calls returning unbounded `List<>` |

**Disposition: Must do before V17** — but narrowed in scope.

**Revised scope:** Do not paginate every endpoint. Instead:
1. Add a hard `LIMIT` cap (e.g., 500) to all unbounded list queries as a safety floor. This prevents OOM with minimal change.
2. Add full pagination (page/size/sort) only to the endpoints most likely to exceed 500 rows in a small pilot: orders, allocations, and inventory.
3. Other endpoints (users, relationships, notifications, accountability sub-types) get the hard cap only, with full pagination deferred to post-V17.

**Estimated effort:** 3-4 days (down from 3-5, due to reduced scope)

**Why the original was overstated:** The audit said "every list endpoint" needs pagination. For a small B2B pilot with a handful of tenants, most endpoints will never exceed 100 records. A hard cap prevents the catastrophic failure mode (OOM) without requiring full pagination UX on every endpoint.

---

### T0-2: Hibernate @Filter for Tenant Isolation

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Application-level filtering works; Hibernate filter adds defense-in-depth only |
| User impact | **Low** | Users never notice which layer enforces tenant boundaries |
| Operational impact | **Low** | No operational impact either way |
| Implementation risk | **High** | Changes query execution for every tenant-scoped query; misconfiguration could break admin/owner cross-tenant access |
| Refactor risk | **High** | Must modify all tenant-scoped entities, add a session-bound filter activator, and verify no query is accidentally double-filtered or missed |
| Evidence the problem exists | **Low** | No cross-tenant leak has been found in V16.2 testing. Every query has manual `requireAdminOrTenant()` calls. The concern is theoretical: "a future missed check." |

**Disposition: Do only if a real problem appears**

**Rationale:** The current manual filtering is the same pattern used by many production Spring Boot applications. Adding Hibernate `@Filter` is defense-in-depth, not a fix for an existing vulnerability. The implementation risk is significant: a misconfigured filter could silently break admin queries that need cross-tenant access, or double-filter queries that already have manual checks. The V17 pilot has a small number of tenants operated by a single organization — the attack surface for cross-tenant leaks is minimal. Post-V17, if a cross-tenant leak is found, add the filter then.

**Estimated effort:** 3-4 days (if needed)

**Why the original was overstated:** The audit treated this as a Tier 0 production blocker equivalent to a known vulnerability. In reality, there is no evidence of a leak, the manual checks work, and the change has high regression risk. The correct response is to add targeted authorization boundary tests (T1-10) that would catch any future leak, not to restructure the entire data access layer.

---

### T0-3: Backup/Restore Automation

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | Data loss in production is the highest-impact failure mode |
| User impact | **High** | Users lose their data permanently without backups |
| Operational impact | **High** | No recovery path = extended or permanent outage |
| Implementation risk | **Low** | Neon provides PITR; verification is documentation and a restore script |
| Refactor risk | **Low** | No code changes; infrastructure configuration and documentation |
| Evidence the problem exists | **High** | Production deployment activation doc explicitly lists "backup and restore" as required proof (line 206). No backup automation exists. |

**Disposition: Must do before V17**

**Revised scope:** Neon provides point-in-time recovery on all plans. The task is:
1. Verify Neon PITR is enabled for the production database.
2. Write a restore verification script.
3. Document the procedure in the operational runbook.
4. Run the restore drill and record proof.

This is mostly documentation and verification, not code. The existing `pg_dump` proof scripts can serve as a manual backup supplement.

**Estimated effort:** 1-2 days (down from 2-3, since Neon PITR does the heavy lifting)

---

### T0-4: Health/Readiness Endpoints

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | Hugging Face Spaces needs to know if the backend is alive; deployment step 3 in activation doc confirms `/api/v1/health` |
| User impact | **Medium** | Users see errors if traffic routes to a dead instance |
| Operational impact | **High** | Cannot determine service health without a real health check |
| Implementation risk | **Low** | Add Spring Boot Actuator; minimal code change |
| Refactor risk | **Low** | Additive change; existing health endpoint continues to work |
| Evidence the problem exists | **High** | Current `HealthController.java` returns `{"status": "UP"}` unconditionally — even if the database is down. Space README template references this endpoint. |

**Disposition: Must do before V17** ~~✓ COMPLETED~~

**Revised scope:**
1. Add `spring-boot-starter-actuator` dependency.
2. Configure `/actuator/health` with database connectivity check.
3. Keep `/api/v1/health` as a public alias that delegates to actuator.
4. Add SMTP health indicator when email is enabled.
5. Docker Compose backend service gets a health check.

The existing `/api/v1/health` endpoint is already referenced in deployment docs. Adding actuator is a small, safe change.

**Estimated effort:** 1-2 days (unchanged)

---

### T0-5: Standard JWT Library

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No known vulnerability in the current implementation |
| User impact | **Low** | Users never notice which JWT library is used |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | Replaces the core authentication mechanism; every authenticated request depends on it. A subtle incompatibility could break all users. |
| Refactor risk | **High** | Must ensure token format backward compatibility, adjust `JwtAuthenticationFilter`, update `ProductionSafetyConfig`, update all auth tests |
| Evidence the problem exists | **Low** | The custom implementation uses HMAC-SHA256 correctly, includes constant-time comparison, and enforces minimum 32-byte secrets. No audit has flagged it. The concern is theoretical: "security auditors will flag it" — but no audit is scheduled. |

**Disposition: Do only if a real problem appears**

**Rationale:** The custom JWT is 131 lines of straightforward code. It does exactly what a standard library would do for the current use case: HMAC-SHA256 signing, base64url encoding, expiry checking, constant-time comparison. There are no advanced features needed (no key rotation, no algorithm negotiation, no JWS/JWE). Replacing it is high risk for zero user-visible benefit during the V17 pilot. Post-V17, when the system needs key rotation or multiple algorithm support, migrate then.

**Estimated effort:** 2-3 days (if needed)

**Why the original was overstated:** The audit treated "custom crypto" as an automatic Tier 0 blocker. But this isn't custom cryptography — it's standard HMAC-SHA256 using `javax.crypto.Mac`, which is the Java platform's own crypto primitive. The code is more similar to "using the standard crypto API directly instead of through a JWT wrapper" than to "rolling your own crypto." The real risk is in custom key derivation or custom algorithms, neither of which are present here.

---

### T0-6: Login Rate Limiting

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | Login is a public endpoint; brute force is the most basic attack on any public auth endpoint |
| User impact | **Medium** | Users affected by account compromise if brute force succeeds |
| Operational impact | **Medium** | Credential stuffing attacks consume resources |
| Implementation risk | **Low** | Add a filter or interceptor; does not change existing behavior for legitimate logins |
| Refactor risk | **Low** | Additive; can be disabled by configuration |
| Evidence the problem exists | **High** | The other public endpoints (recovery, access requests) already have throttling. Login is the only public endpoint without it. This is a concrete gap. |

**Disposition: Must do before V17** ~~✓ COMPLETED~~

**Revised scope:** Simple in-memory rate limiter: 5 failed attempts per email per 15 minutes. Returns 429 with `Retry-After` header. No Redis needed for a single-instance Hugging Face Space.

**Estimated effort:** 1 day (down from 1-2)

---

### T0-7: Metrics / Prometheus

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | The deployment will not fail without metrics; issues will be harder to diagnose |
| User impact | **Low** | Users never interact with metrics |
| Operational impact | **Medium** | Without metrics, incident diagnosis relies on logs and the monitoring proof script |
| Implementation risk | **Medium** | Adding Micrometer is safe; exposing `/actuator/prometheus` requires security consideration |
| Refactor risk | **Low** | Additive; no existing code changes |
| Evidence the problem exists | **Medium** | The deployed monitoring proof script (`deployed-monitoring-proof.ps1`) already samples endpoint health with latency budgets. The activation doc lists monitoring as required proof. But the existing script provides minimum viable observability. |

**Disposition: Do after V17**

**Rationale:** The deployed monitoring proof script already provides the minimum observability needed for the first pilot: it samples API health, measures latency, and can be run on a schedule. Full Prometheus/Micrometer integration is valuable but not a deployment blocker — the pilot can operate with script-based monitoring. The activation doc says "monitoring and alerting" must detect problems, but it doesn't specify Prometheus. The existing script satisfies the letter of the requirement for a first deployment. Post-V17, add Prometheus when the operational need for continuous metrics becomes clear.

**Estimated effort:** 3-5 days (if done)

**Why the original was overstated:** The audit treated "no metrics" as equivalent to "no monitoring," but the monitoring proof script already provides basic health sampling. The jump from "basic health checks" to "full Prometheus stack with Grafana dashboards" is an operational improvement, not a deployment gate.

---

### T1-1: Authorization Aspect Extraction

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No current auth bypass; the pattern works |
| User impact | **Low** | Users never notice how auth is implemented |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | Rewrites auth in every service method; AOP ordering bugs are subtle |
| Refactor risk | **High** | Touches every service and every test; hard to partially roll back |
| Evidence the problem exists | **Low** | No auth bypass has been found. The concern — "hard to audit" — is an architectural preference, not a measurable risk. |

**Disposition: Never do unless the architecture changes significantly**

**Rationale:** The current `CurrentUserService` pattern is explicit, readable, and debuggable. Every authorization check is visible in the service method where the business logic lives. Moving checks to annotations via AOP does not reduce the number of places where auth must be correct — it just moves them. An annotation can be missed just as easily as a method call. The stated benefit ("auditable in one place") is offset by the risk of AOP ordering bugs, annotation inheritance issues, and the difficulty of debugging aspect-driven authorization. This is a style preference, not a security fix.

**If a real auth bypass is found**, the correct response is to add a targeted test for that specific bypass, not to restructure the entire auth model.

---

### T1-2: Domain Extraction from Large Services

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker; services work as-is |
| User impact | **Low** | Users never notice which class a method lives in |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | Moves hundreds of methods; import changes across the codebase |
| Refactor risk | **High** | Large scope; domain event introduction changes runtime behavior |
| Evidence the problem exists | **Low** | No bug has been traced to service size. The concern is "cognitive load," which is a developer preference. |

**Disposition: Never do unless the architecture changes significantly**

**Rationale:** This is pure file organization. The V17 refactoring rule explicitly prohibits it: "Cosmetic, speculative, or architecture-ideal refactoring is out of scope." The only valid reason would be "real duplication or coupling that blocks the deployment path" — and no such blockage exists. Post-V17, if a specific service becomes genuinely unmaintainable (bugs take longer to fix, changes break other changes), split that specific service then.

---

### T1-3: useApi Data-Fetching Hook

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | New hook + refactoring pages to use it |
| Refactor risk | **Medium** | Changes data-fetching pattern in multiple components |
| Evidence the problem exists | **Low** | The repeated pattern works; no bugs from duplication |

**Disposition: Do after V17**

**Rationale:** Valuable for developer experience and reducing boilerplate, but not a deployment blocker. Do this when adding new pages or modifying existing data-fetching logic, not as a standalone refactor.

---

### T1-4: API Client Split

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | Changes import paths across all pages |
| Refactor risk | **Medium** | Broad but mechanical changes |
| Evidence the problem exists | **Low** | No merge conflicts reported; no bugs from file size |

**Disposition: Do after V17**

**Rationale:** File organization. The single-file API client works and has no bugs. Split it when the file becomes genuinely hard to work with (merge conflicts, slow IDE navigation), not preemptively.

---

### T1-5: Monolithic Page Splits

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | 8-12 days of changes across 5,600+ lines of UI code |
| Refactor risk | **High** | Large scope; easy to introduce subtle state bugs during extraction |
| Evidence the problem exists | **Low** | Pages work. No user-reported issues from component size. |

**Disposition: Do after V17**

**Rationale:** This is the single largest refactor in the plan (8-12 days) with the highest regression risk. It has zero effect on whether V17 deploys successfully. Post-V17, split pages incrementally when adding features or fixing bugs in specific pages.

---

### T1-6: Optimistic Locking on Hot Entities

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | Concurrent writes could cause silent data loss, but pessimistic locks already protect the most critical path (inventory) |
| User impact | **Medium** | Data corruption would affect users, but only under concurrent access |
| Operational impact | **Low** | No operational impact without the problem occurring |
| Implementation risk | **Medium** | Adds `@Version` fields and a migration; `ApiExceptionHandler` already handles optimistic lock exceptions |
| Refactor risk | **Medium** | Migration required; API responses may include version field |
| Evidence the problem exists | **Low** | The system uses pessimistic write locks for inventory operations (`WarehouseInventoryRepository`). No concurrent-modification bug has been reported. The risk exists but is mitigated by existing locking. |

**Disposition: Do only if a real problem appears**

**Rationale:** The most critical entity (`WarehouseInventory`) already uses `SELECT ... FOR UPDATE` (pessimistic write lock). Optimistic locking would add defense-in-depth for entities like `CustomerOrder` and `FulfillmentAllocation` that don't have pessimistic locks. But in a small B2B pilot, concurrent modifications to the same order or allocation are unlikely. If a data corruption incident occurs, add `@Version` then. The migration and code changes are small and well-understood.

---

### T1-7: @BatchSize on @OneToMany

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Performance optimization, not a correctness issue |
| User impact | **Low** | Faster queries are nice but not blocking |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Add annotations; no behavior change |
| Refactor risk | **Low** | Additive; can be removed |
| Evidence the problem exists | **Low** | No performance issue reported. Pagination (T0-1 revised) will reduce the number of parent entities loaded, reducing N+1 impact. |

**Disposition: Do after V17**

**Rationale:** This is a 1-2 day, low-risk, additive change. It's safe to do, but it's not urgent. If pagination is implemented, the N+1 impact is significantly reduced because fewer parent entities are loaded per request. Do this opportunistically when working on the entity layer for other reasons, or post-V17 when performance evidence from production justifies it.

---

### T1-8: OrderService N+1 Fix

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | The N+1 pattern is real and measurable |
| User impact | **Medium** | Slow order list page affects user experience |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Add a new repository query; does not change existing queries |
| Refactor risk | **Low** | Additive; old query remains for detail pages |
| Evidence the problem exists | **High** | `OrderService.findAll()` line 143 calls `get(order.getId())` in a stream — provable N+1 |

**Disposition: Must do before V17** — combined with T0-1 pagination.

**Revised scope:** This is not a separate task. When implementing pagination for the order list endpoint (T0-1), the N+1 pattern must be fixed as part of the same change. Creating a `findAllWithMerchant()` query is a prerequisite for an efficient paginated order list.

**Estimated effort:** Included in T0-1.

---

### T1-9: Token Refresh / Rotation

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | 1-hour token expiry is acceptable for a pilot |
| User impact | **Medium** | Users must re-login every hour, which is annoying |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | New auth endpoint, database table, token rotation logic, frontend changes |
| Refactor risk | **High** | Changes the auth flow end-to-end; hard to partially roll back |
| Evidence the problem exists | **Low** | No user complaints about session expiry. The pilot has not started. |

**Disposition: Do after V17**

**Rationale:** The 1-hour re-login is a quality-of-life issue, not a deployment blocker. In a small pilot where users are actively testing, re-authentication every hour is tolerable. Post-V17, implement refresh tokens when session length becomes a real complaint. The effort is significant (3-5 days) and the risk is high (changes the entire auth flow).

---

### T1-10: Authorization Boundary Tests

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | This is the correct mitigation for T0-2 (tenant isolation): tests that catch any future leak |
| User impact | **Low** | Users don't see tests |
| Operational impact | **Medium** | Tests prevent regressions that could cause security incidents |
| Implementation risk | **Low** | Adds tests; does not change production code |
| Refactor risk | **Low** | Additive; tests can be adjusted independently |
| Evidence the problem exists | **Medium** | No auth bypass found, but no tests exist to catch one either. The absence of tests is itself the risk. |

**Disposition: Must do before V17**

**Revised scope:** This is the correct replacement for T0-2 (Hibernate `@Filter`). Instead of restructuring the data access layer, add tests that verify:
1. Tenant A cannot access Tenant B's orders, inventory, allocations, or notifications.
2. MERCHANT users cannot access ADMIN endpoints.
3. WAREHOUSE_OPERATOR users cannot access MERCHANT-only endpoints.
4. SUSPENDED tenant users cannot perform mutations.

Target the most sensitive endpoints: order management, inventory mutation, user management, admin endpoints.

**Estimated effort:** 3-5 days (focused on the most critical endpoints, not all controllers)

**Why this replaces T0-2:** Hibernate `@Filter` prevents future mistakes passively but has high implementation risk. Authorization boundary tests actively catch mistakes and have zero implementation risk. Tests are the safer path for V17.

---

### T1-11: Concurrency Tests for Inventory Allocation

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | Inventory over-reservation would be a real business problem |
| User impact | **Medium** | Selling more stock than exists affects merchants |
| Operational impact | **Low** | No operational impact until the problem occurs |
| Implementation risk | **Low** | Adds tests; does not change production code |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **Low** | Pessimistic write locks are already in place. No over-reservation bug reported. |

**Disposition: Do only if a real problem appears**

**Rationale:** The pessimistic write locks on `WarehouseInventoryRepository` already protect against over-reservation at the database level. A concurrency test would verify this, but the locking mechanism is well-understood and commonly used. If an over-reservation incident occurs, add the test then (and investigate whether the pessimistic lock was bypassed).

---

### T1-12: Load Test Suite

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | Load testing would reveal performance bottlenecks before users hit them |
| User impact | **Low** | Users don't interact with load tests |
| Operational impact | **Medium** | Provides baseline for capacity planning |
| Implementation risk | **Low** | Adds scripts; does not change production code |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **Medium** | The `load-smoke.ps1` script already runs 25 concurrent users × 8 requests. The V17 pilot capacity is small. |

**Disposition: Do after V17**

**Rationale:** The existing `load-smoke.ps1` script provides basic load validation for the V17 pilot. A full k6/Gatling suite is valuable but not required before deployment. Post-V17, build a proper load test suite when capacity planning needs demand it.

---

### T1-13: Migration Rollback Testing

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | A failed production migration with no rollback plan means downtime |
| User impact | **High** | Extended downtime affects all users |
| Operational impact | **High** | Without a rollback plan, the operator has no recovery path for migration failures |
| Implementation risk | **Low** | Adds a test step and documentation |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **High** | Flyway Community edition does not support `undo`. No rollback documentation exists. Production deployment will run migrations against live data. |

**Disposition: Must do before V17**

**Revised scope:**
1. Verify all 18 migrations apply cleanly to an empty database (already done in CI).
2. Document a manual rollback strategy for each migration (the SQL to reverse each change).
3. Test that the documented rollback SQL works against a migrated database.

This is documentation and testing, not code changes. The V17 deployment will run these migrations against the Neon database for the first time — having a rollback plan is a basic operational requirement.

**Estimated effort:** 2-3 days (unchanged)

---

### T1-14: Operational Runbook

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | Without a runbook, incident response is ad-hoc |
| User impact | **Medium** | Faster incident resolution means less downtime |
| Operational impact | **High** | The roadmap explicitly lists this as V17 scope |
| Implementation risk | **Low** | Documentation only |
| Refactor risk | **Low** | Documentation only |
| Evidence the problem exists | **High** | The roadmap (line 97) lists "public operational runbooks" as V17 scope. No runbook exists. |

**Disposition: Must do before V17**

**Revised scope:** Create a focused runbook covering:
1. Incident classification and escalation
2. Rollback procedure (how to redeploy a previous backend version on Hugging Face, how to restore Neon from PITR)
3. Database recovery (Neon PITR restore steps)
4. Common failure modes and responses (backend OOM, database connection failure, email provider failure)

Do not wait for metrics (T0-7) to write this. The runbook should reference the monitoring proof script for health checks, not Prometheus.

**Estimated effort:** 2-3 days (focused scope, not waiting for metrics)

---

### T2-1: Package-by-Domain Reorganization

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | Moves 276 files; changes every import |
| Refactor risk | **High** | Massive scope; merge conflicts with any in-flight work |
| Evidence the problem exists | **Low** | No bug traced to package structure |

**Disposition: Never do unless the architecture changes significantly**

**Rationale:** This is the definition of "cosmetic refactoring" that the V17 rule prohibits. Package-by-domain is a legitimate organizational strategy, but so is package-by-layer. The current structure is consistent and searchable. Revisit only if the codebase grows significantly or if bounded contexts are extracted into separate services.

---

### T2-2: Frontend Type Generation from OpenAPI

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | New build step; generated types may not match hand-written ones exactly |
| Refactor risk | **Medium** | Replaces all hand-written types |
| Evidence the problem exists | **Low** | No runtime type-mismatch bug reported |

**Disposition: Do after V17**

**Rationale:** Valuable for long-term maintainability, but requires a stable OpenAPI spec and careful migration. Post-V17 work.

---

### T2-3: Form Draft Hook

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | Refactors form state management |
| Refactor risk | **Medium** | Changes component internals |
| Evidence the problem exists | **Low** | No form bug traced to the draft pattern |

**Disposition: Do after V17**

---

### T2-4: Notification Polling Visibility

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | Unnecessary API traffic in background tabs, but no user-visible bug |
| Operational impact | **Low** | Minor resource waste |
| Implementation risk | **Low** | Small, focused change |
| Refactor risk | **Low** | Additive; easy to revert |
| Evidence the problem exists | **Low** | No performance issue traced to background polling. V17 pilot will have few concurrent users. |

**Disposition: Do only if a real problem appears**

**Rationale:** In a small pilot, background tab polling is negligible. If API traffic from idle tabs becomes a measurable problem, add `visibilitychange` handling — it's a 1-day change.

---

### T2-5: Route-Based Code Splitting

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | Faster initial load on slow connections, but current 508 KB JS gzips to 137 KB — acceptable |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | React.lazy + Suspense is well-understood |
| Refactor risk | **Low** | Changes import style in App.tsx |
| Evidence the problem exists | **Low** | Performance readiness report shows bundle within budget. No load-time complaint. |

**Disposition: Do after V17**

**Rationale:** The current bundle (508 KB / 137 KB gzip) passes the performance budget. Code splitting is a good practice but not urgent. Do it when the bundle grows enough to matter.

---

### T2-6: ConfigurationProperties for ProductionSafetyConfig

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker; 21 `@Value` params work |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Type-safe refactoring |
| Refactor risk | **Low** | Localized to one config class |
| Evidence the problem exists | **Low** | No configuration error traced to `@Value` usage |

**Disposition: Do after V17**

**Rationale:** This is a 1-2 day cleanup that improves developer experience but has no deployment impact. Do it when modifying `ProductionSafetyConfig` for other reasons, or post-V17.

---

### T2-7: Accessibility Testing

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Medium** | Accessibility affects users with disabilities |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Additive test infrastructure |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **Low** | No a11y complaint or requirement for V17 pilot |

**Disposition: Do after V17**

**Rationale:** Important for long-term product quality but not a V17 deployment gate. The V17 pilot serves a small set of known users. Post-V17, integrate axe-core before broader distribution.

---

### T2-8: Network Failure Simulation Tests

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | Error states already display in the current UI |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Adds tests |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **Low** | No UI crash from API failure reported |

**Disposition: Do after V17**

---

### T2-9: E2E Coverage Audit

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Audit and documentation |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **Low** | No uncaught bug traced to E2E gap |

**Disposition: Do after V17**

---

### T2-10: Bundle Size Tracking

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Additive CI step |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **Low** | Bundle within budget per performance readiness report |

**Disposition: Do after V17**

---

### T2-11: Pre-Commit Hooks

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Developer tooling |
| Refactor risk | **Low** | Can be disabled with `--no-verify` |
| Evidence the problem exists | **Low** | CI catches issues; pre-commit is a convenience |

**Disposition: Do after V17**

---

### T2-12: Dependabot Configuration

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | Automated security patches for dependencies |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Configuration file only |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **Medium** | No known vulnerable dependencies, but tracking is a good practice |

**Disposition: Do after V17** — but this is a 0.5-day task that can be done at any time. It's safe and low-risk but not a deployment gate.

---

### T2-13: JSONB Schema Validation

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | Data quality issue, not a user-visible bug |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | Adds constraints that could reject existing data |
| Refactor risk | **Medium** | Migration required; could break existing writes |
| Evidence the problem exists | **Low** | No invalid-data bug reported |

**Disposition: Do only if a real problem appears**

**Rationale:** JSONB attributes and metadata are written by the application code, which already structures them correctly. Adding database-level constraints provides defense-in-depth but could reject data that the application intentionally produces. Only add constraints if data quality issues are observed.

---

### T2-14: CI Duration Optimization

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | Developer experience, not production |
| Implementation risk | **Medium** | Changes CI workflow structure |
| Refactor risk | **Medium** | Could introduce flaky gate behavior |
| Evidence the problem exists | **Low** | CI duration is not blocking development |

**Disposition: Do after V17**

---

### T2-15: CONTRIBUTING.md

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Documentation only |
| Refactor risk | **Low** | Documentation only |
| Evidence the problem exists | **Low** | Repository is not yet accepting external contributions |

**Disposition: Do after V17**

---

### T2-16: CHANGELOG.md

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Documentation only |
| Refactor risk | **Low** | Documentation only |
| Evidence the problem exists | **Low** | Version history exists in git |

**Disposition: Do after V17**

---

### T2-17: Database Schema Documentation

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | Slightly faster onboarding |
| Implementation risk | **Low** | Documentation generation |
| Refactor risk | **Low** | Documentation only |
| Evidence the problem exists | **Low** | Schema is documented via Flyway migrations and entity classes |

**Disposition: Do after V17**

---

### T3-1: API Versioning Strategy

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Documentation only |
| Refactor risk | **Low** | Documentation only |
| Evidence the problem exists | **Low** | Only one API consumer (the frontend); no versioning need yet |

**Disposition: Do after V17** — when a second consumer or breaking change requires it.

---

### T3-2: FulfillmentException.status Enum

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Small, localized change |
| Refactor risk | **Low** | Migration required but simple |
| Evidence the problem exists | **Low** | No bug traced to string status |

**Disposition: Never do unless the architecture changes significantly**

**Rationale:** This is cosmetic consistency. The string values work. No bug has been caused by the string type. An enum would be slightly nicer, but the change requires a Flyway migration for a CHECK constraint and is pure churn with zero measurable benefit.

---

### T3-3: ShipmentPackage Status/Event Enums

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Small change |
| Refactor risk | **Low** | Migration required |
| Evidence the problem exists | **Low** | No bug traced to string types |

**Disposition: Never do unless the architecture changes significantly**

**Rationale:** Same as T3-2. Cosmetic consistency with no measurable benefit.

---

### T3-4: Auth Token Key Rename

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | Migration logic must preserve existing sessions |
| Refactor risk | **Medium** | Could log out all existing users if migration fails |
| Evidence the problem exists | **Low** | The legacy key name has caused no problems |

**Disposition: Never do unless the architecture changes significantly**

**Rationale:** Renaming a localStorage key has zero functional benefit and non-trivial migration risk (every existing session must be preserved). The old name is a cosmetic inconsistency, not a bug.

---

### T3-5: Remove Ngrok Header

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Removes dead code |
| Refactor risk | **Low** | Removes dead code |
| Evidence the problem exists | **Medium** | The roadmap explicitly states the ngrok lane is replaced. Dead code exists in the API client. |

**Disposition: Do after V17**

**Rationale:** This is safe and removes dead code, but it has no urgency. Do it when next modifying `api/client.ts`, or post-V17 as cleanup.

---

### T3-6: CSRF Disable Comment

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Adds a comment |
| Refactor risk | **Low** | Adds a comment |
| Evidence the problem exists | **Low** | The design decision is correct; documentation is nice-to-have |

**Disposition: Do after V17**

**Rationale:** Adding a comment is trivially safe but not urgent. Do it when next editing `SecurityConfig.java`.

---

### T3-7: Docker Compose Health Check

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Local development convenience, not production |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | Improves local development reliability |
| Implementation risk | **Low** | Additive |
| Refactor risk | **Low** | Additive |
| Evidence the problem exists | **Medium** | Frontend may start before backend is ready in local Docker |

**Disposition: Do after V17** — or include as part of T0-4 (health endpoints) if doing that task.

---

### T3-8: PowerShell Script Linting

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Additive CI step |
| Refactor risk | **Medium** | Could flag existing scripts that work but violate style rules |
| Evidence the problem exists | **Low** | No script bug traced to lack of linting |

**Disposition: Do after V17**

---

## Consolidated Implementation Sequence

### Must Do Before V17 (6 tasks, ~10-14 days)

These are the only tasks that should proceed before V17 deployment. Everything else waits.

| Seq | Task ID | Title | Effort | Dependency |
|-----|---------|-------|--------|------------|
| 1 | T0-4 | Health/Readiness Endpoints with Actuator | 1-2 days | None |
| 2 | T0-6 | Login Rate Limiting | 1 day | None |
| 3 | T0-1+T1-8 | Pagination + Order N+1 Fix (narrowed scope) | 3-4 days | None |
| 4 | T1-10 | Authorization Boundary Tests | 3-5 days | None |
| 5 | T0-3 | Backup/Restore Verification (Neon PITR) | 1-2 days | None |
| 6 | T1-13 | Migration Rollback Documentation | 2-3 days | None |

Plus one documentation task that can be done in parallel:

| Seq | Task ID | Title | Effort | Dependency |
|-----|---------|-------|--------|------------|
| 7 | T1-14 | Operational Runbook | 2-3 days | None |

**Execution order:**
- Tasks 1 and 2 are independent and small — do them first for quick wins.
- Task 3 is the largest code change — start after 1/2, test carefully.
- Tasks 4, 5, and 6 are independent of code changes — can be done in parallel with 3.
- Task 7 (runbook) can start immediately and is documentation-only.

**Total estimated effort:** 10-14 days for code tasks + 2-3 days for runbook.

### Do After V17 (22 tasks)

These are valuable improvements that should proceed after V17 deployment proof is complete, prioritized by actual pain points observed in production.

**First wave — operational improvements (do within 2 weeks of V17):**

| Task ID | Title | Effort |
|---------|-------|--------|
| T0-7 | Metrics / Prometheus Integration | 3-5 days |
| T0-5 | Standard JWT Library Migration | 2-3 days |
| T1-12 | Load Test Suite | 3-5 days |
| T1-9 | Token Refresh / Rotation | 3-5 days |

**Second wave — developer experience (do within 2 months of V17):**

| Task ID | Title | Effort |
|---------|-------|--------|
| T1-3 | useApi Data-Fetching Hook | 2-3 days |
| T1-4 | API Client Split | 3-4 days |
| T1-5 | Monolithic Page Splits | 8-12 days |
| T2-6 | ConfigurationProperties | 1-2 days |
| T1-7 | @BatchSize on @OneToMany | 1-2 days |
| T2-12 | Dependabot Configuration | 0.5 days |

**Third wave — quality and documentation (do as needed):**

| Task ID | Title | Effort |
|---------|-------|--------|
| T2-2 | Frontend Type Generation | 5-7 days |
| T2-3 | Form Draft Hook | 2-3 days |
| T2-5 | Route-Based Code Splitting | 1-2 days |
| T2-7 | Accessibility Testing | 2-3 days |
| T2-8 | Network Failure Simulation | 2-3 days |
| T2-9 | E2E Coverage Audit | 3-5 days |
| T2-10 | Bundle Size Tracking | 1 day |
| T2-11 | Pre-Commit Hooks | 1-2 days |
| T2-14 | CI Duration Optimization | 2-3 days |
| T2-15 | CONTRIBUTING.md | 1-2 days |
| T2-16 | CHANGELOG.md | 1-2 days |
| T2-17 | Schema Documentation | 1-2 days |
| T3-1 | API Versioning Strategy | 2-3 days |

### Do Only If a Real Problem Appears (5 tasks)

| Task ID | Title | Trigger Condition |
|---------|-------|-------------------|
| T0-2 | Hibernate @Filter for Tenant Isolation | A cross-tenant data leak is found in testing or production |
| T1-6 | Optimistic Locking | Concurrent-modification data corruption is observed |
| T1-11 | Concurrency Tests for Inventory | Inventory over-reservation occurs under load |
| T2-4 | Notification Polling Visibility | API traffic from background tabs becomes a measurable cost |
| T2-13 | JSONB Schema Validation | Invalid or inconsistent JSONB data causes query failures |

### Never Do Unless Architecture Changes Significantly (6 tasks)

| Task ID | Title | Why Never |
|---------|-------|-----------|
| T1-1 | Authorization Aspect Extraction | Current pattern works; AOP migration is style, not safety |
| T1-2 | Domain Extraction from Large Services | File organization with no measurable benefit |
| T2-1 | Package-by-Domain Reorganization | Massive cosmetic refactor prohibited by V17 rule |
| T3-2 | FulfillmentException.status Enum | String works; no bug; migration for consistency only |
| T3-3 | ShipmentPackage Status Enums | String works; no bug; migration for consistency only |
| T3-4 | Auth Token Key Rename | Migration risk > cosmetic benefit |

### Treated Elsewhere or Deferred (4 tasks)

| Task ID | Title | Disposition |
|---------|-------|-------------|
| T1-8 | OrderService N+1 Fix | Merged into T0-1 (pagination) — same code change |
| T3-5 | Remove Ngrok Header | Do when modifying `api/client.ts` for other reasons |
| T3-6 | CSRF Disable Comment | Do when editing `SecurityConfig.java` for other reasons |
| T3-7 | Docker Compose Health Check | Include as part of T0-4 (health endpoints) |

### Removed from Scope

No tasks were removed from scope. All 46 original tasks are accounted for.

---

## What Changed From REFACTOR_PLAN.md

### Downgraded from "Must do before V17" to later:

| Task | Original | New | Why |
|------|----------|-----|-----|
| T0-2 Tenant Isolation @Filter | Tier 0 / Must do | Do only if problem | Application-level filtering works; Hibernate filter has high regression risk; no evidence of leak |
| T0-5 Standard JWT Library | Tier 0 / Must do | Do only if problem | Custom JWT uses standard HMAC-SHA256 correctly; no vulnerability; replacement is high risk for zero user benefit |
| T0-7 Metrics / Prometheus | Tier 0 / Must do | Do after V17 | Monitoring proof script provides minimum viable observability; Prometheus is an upgrade, not a gate |

### Upgraded or newly required:

| Task | Original | New | Why |
|------|----------|-----|-----|
| T1-10 Authorization Boundary Tests | Tier 1 / After auth extraction | Must do before V17 | This is the correct mitigation for tenant isolation risk — tests catch leaks, Hibernate filter just changes how queries work |
| T1-13 Migration Rollback Documentation | Tier 1 / Post-V17 | Must do before V17 | Running migrations against production data without a rollback plan is an operational hazard |
| T1-14 Operational Runbook | Tier 1 / After metrics | Must do before V17 | The roadmap requires it; does not depend on Prometheus |

### Reclassified as "Never do":

| Task | Original | New | Why |
|------|----------|-----|-----|
| T1-1 Authorization Aspect | Tier 1 | Never do | Architectural preference; current pattern works; AOP is not safer than explicit calls |
| T1-2 Domain Extraction | Tier 1 | Never do | File organization with no measurable benefit; prohibited by V17 rule |
| T2-1 Package Reorg | Tier 2 | Never do | Cosmetic refactor prohibited by V17 rule |
| T3-2/T3-3 String-to-Enum | Tier 3 | Never do | No bug; migration for consistency only |
| T3-4 Token Key Rename | Tier 3 | Never do | Migration risk exceeds cosmetic benefit |

### Merged:

| Task | Into | Why |
|------|------|-----|
| T1-8 OrderService N+1 | T0-1 Pagination | Same code change; fixing N+1 is a prerequisite for efficient pagination |

---

## Architectural Preference vs. Measurable Business Value

The following original findings represent architectural preference, not measurable business value for V17:

1. **"Authorization not separated from business logic" (ARCH-1)** — The pattern of calling `CurrentUserService.requireAdminOrTenant()` in service methods is explicit, readable, and debuggable. Moving to AOP annotations does not reduce the number of places where auth must be correct — it just makes them less visible. The supposed audit benefit ("check annotations instead of reading every method") is offset by AOP's opacity at runtime.

2. **"No package-by-domain organization" (ARCH-2)** — Package-by-layer is a valid organizational strategy used by many successful projects. The cognitive cost of navigating flat packages is a developer preference, not a deployment risk.

3. **"Service layer violates domain boundaries" (ARCH-3)** — Cross-domain mutations between services exist, but they work correctly. Introducing domain events is an architectural ideal that adds complexity (event routing, eventual consistency, error handling) for no user-visible benefit during V17.

4. **"Custom JWT implementation" (SEC-1)** — The implementation uses Java's standard `javax.crypto.Mac` with HMAC-SHA256, constant-time comparison, and minimum secret length. This is not "custom crypto" — it's using the standard crypto API directly instead of through a JWT wrapper. The code does exactly what `spring-boot-starter-oauth2-resource-server` would do for the current use case.

5. **"Monolithic API client" (FE-1) / "Monolithic pages" (FE-2)** — File size is a developer convenience metric, not a user-facing or deployment metric. The pages work. Splitting them is 8-12 days of risk for zero user benefit.

6. **"String statuses instead of enums" (BE-4, BE-6)** — Type safety is a developer preference. The string values are correct, consistent within each usage, and have caused no bugs. Adding enums requires Flyway migrations for CHECK constraints — operational risk for cosmetic gain.

---

## Risk Summary

### Risks of doing too much before V17

1. **Regression risk** — Every code change risks breaking something that currently works. The V16.2 convergence proof was hard-won; each refactor risks re-introducing cross-surface defects.
2. **Schedule risk** — The original plan had 95-141 days of work. Even the revised "Must do" list is 10-14 days. Every day spent refactoring is a day V17 deployment is delayed.
3. **Scope creep risk** — "While we're fixing pagination, we might as well refactor the API client" — this is how 7 tasks become 46 tasks.
4. **Testing risk** — Refactoring invalidates existing tests, requiring test updates that themselves may introduce false positives or false negatives.

### Risks of doing too little before V17

1. **OOM from unbounded queries** — Mitigated by T0-1 (pagination with hard caps).
2. **Brute-force attacks on login** — Mitigated by T0-6 (rate limiting).
3. **Undetected tenant isolation bugs** — Mitigated by T1-10 (authorization boundary tests), not by T0-2 (Hibernate filter).
4. **No operational recovery path** — Mitigated by T0-3 (backup/restore), T1-13 (migration rollback), and T1-14 (runbook).
5. **No health monitoring** — Mitigated by T0-4 (actuator health endpoint).

### The safest path

Do the 7 "Must do" tasks. Deploy V17. Then let production evidence — not theoretical concerns — drive the next wave of improvements.

---

## Script-Code Alignment Audit

> Scripts must validate what the code implements, for both local and deployment. Docs, diagrams, and CI must align with all three.

### Backend: Controller-to-Scenario Coverage

17 backend controllers mapped against 17+ API smoke scenarios:

| Controller | Scenarios | Status |
|---|---|---|
| AuthController | 00, 02, 14 | Covered; rate limiting added in scenario 17 |
| AccessRequestController | 14 | Good |
| AdminControlController | 05 | Good |
| AdminOutboxController | 13 | Good |
| AdminUserController | 02, 05 | Good |
| AssistantController | 16 | Good (includes cross-tenant refusal) |
| DashboardController | 09 | Basic |
| FulfillmentController | 06, 09 | Good |
| HealthController | 18 | **Added** -- scenario 18 validates `/api/v1/health` and `/actuator/health` |
| InventoryController | 01 | Good |
| MerchantWarehouseController | 01, 03 | Good |
| NotificationController | 04 | Good |
| OperationalDetailController | 10 | Good |
| OrderController | 06, 07 | Good |
| ServiceAccountabilityController | 04 | Good |
| TenantController | 01 | Good |
| WarehouseController | 01, 09 | Good |

**Gaps closed:**
1. **Login rate limiting** (T0-6) -- scenario 17 sends 6 failed logins, verifies 429 with `Retry-After`, confirms per-email isolation
2. **Health endpoint** (T0-4) -- scenario 18 validates both `/api/v1/health` (public) and `/actuator/health` (with DB indicator)

**Remaining gap:**
- **Authorization boundaries** (T1-10) -- scenarios 02 and 11 include some 403 checks but lack systematic cross-tenant isolation tests. T1-10 is a separate task for dedicated backend unit/integration tests.

### Frontend (Web): Route Coverage

`full-tour.spec.ts` (Playwright) navigates all routes with all 5 roles (owner, merchant, warehouse, support-admin, auditor). `ui-input-tour` validates public auth UI input. Page-level `.test.tsx` files cover component logic. **No gap for V17.**

### Mobile (Android): Build and Proof Coverage

7 scripts cover: build config, signed APK assembly, login proof, visual tour proof, device sync, native tour, release shape check. **No gap for V17.**

### Deployment Scripts

| Script | Status | Issue Found |
|---|---|---|
| huggingface-vercel-check | Works | Static shape check (config files present and correct) |
| huggingface-space-sync | **Fixed** | Was missing robocopy verification, had unreliable Python stdin piping, no exit code checking |
| docker-compose config | Works | Config validation only |

### CI Workflow Alignment

CI (`merhouse-quality-gate.yml`) runs: backend tests, frontend tests, API smoke (now includes rate limiting and health), seed-demo, frontend-full-tour, v17-production-readiness, public-readiness (now uses PowerShell-native token scanning instead of `rg`), HF/Vercel check, performance-readiness, mobile-shell-check, markdown-check.

**CI gaps closed:**
- `public-readiness.ps1` no longer depends on `rg` (ripgrep) -- uses `Get-ChildItem` + `Select-String`
- API smoke now validates T0-4 (health) and T0-6 (rate limiting) at the integration level

---

## Implementation Log

### T0-4: Health/Readiness Endpoints — COMPLETED

**Date:** 2026-06-13

**Changes made:**

1. **`backend/pom.xml`** — Added `spring-boot-starter-actuator` dependency
2. **`backend/src/main/resources/application.properties`** — Added actuator configuration:
   - `management.endpoints.web.exposure.include=health` (only health endpoint exposed)
   - `management.endpoint.health.show-details=when-authorized` (details visible to authenticated users only)
   - `management.endpoint.health.probes.add-additional-paths=true` (enables `/actuator/health/liveness` and `/actuator/health/readiness`)
   - `management.health.livenessstate.enabled=true`
   - `management.health.readinessstate.enabled=true`
3. **`backend/src/main/java/com/merhouse/web/HealthController.java`** — Rewrote to inject `DataSource` and perform a real DB connectivity check via `Connection.isValid(2)`. Returns `UP` when DB is reachable, `DOWN` when it's not.
4. **`backend/src/main/java/com/merhouse/config/SecurityConfig.java`** — Added `/actuator/health` and `/actuator/health/**` to permit-all rules
5. **`backend/src/test/java/com/merhouse/web/ApiControllerTest.java`** — Updated health test to mock `DataSource`, added new test for DOWN state
6. **`docker-compose.yml`** — Added health check to backend service (`curl -sf http://localhost:8080/api/v1/health`), changed frontend `depends_on` from simple dependency to `condition: service_healthy` (also covers T3-7)

**Decisions:**
- Used `DataSource` injection in `HealthController` instead of `HealthEndpoint` because `@WebMvcTest` slices don't auto-configure actuator beans. The DataSource approach is simpler and directly tests DB connectivity.
- Actuator `/actuator/health` provides detailed health information (DB, disk, SMTP) for authenticated users and monitoring tools.
- `/api/v1/health` remains the public backward-compatible endpoint referenced by deployment docs and scripts.

**Test proof:** 204 tests pass, 0 failures, 0 errors (excluding Testcontainers integration tests that require Docker).

### T0-6: Login Rate Limiting — COMPLETED

**Date:** 2026-06-13

**Changes made:**

1. **`backend/src/main/java/com/merhouse/security/LoginRateLimiter.java`** — New component: in-memory rate limiter tracking failed login attempts per normalized email. Blocks after 5 failures within 15 minutes. Uses `ConcurrentHashMap` with `AttemptTracker` records. Provides `isBlocked()`, `recordFailure()`, `recordSuccess()`, `retryAfterSeconds()`, and `cleanup()` methods.
2. **`backend/src/main/java/com/merhouse/security/LoginRateLimitExceededException.java`** — New exception carrying `retryAfterSeconds`. Mapped to 429 with `Retry-After` header in the exception handler.
3. **`backend/src/main/java/com/merhouse/service/AuthService.java`** — Integrated `LoginRateLimiter`: checks `isBlocked()` before authentication, records failures on bad credentials, records success on valid login.
4. **`backend/src/main/java/com/merhouse/web/ApiExceptionHandler.java`** — Added `@ExceptionHandler(LoginRateLimitExceededException.class)` returning 429 with `Retry-After` header.
5. **`backend/src/test/java/com/merhouse/security/LoginRateLimiterTest.java`** — 7 unit tests covering: initial state, blocking after max attempts, success resets counter, retry-after header value, independent email tracking, case-insensitive normalization, expired entry cleanup.
6. **`backend/src/test/java/com/merhouse/service/AuthServiceTest.java`** — Updated to inject `LoginRateLimiter` mock, added test for blocked email returning 429.
7. **`backend/src/test/java/com/merhouse/web/AuthControllerTest.java`** — Added test verifying 429 response with `Retry-After` header when rate-limited.

**Decisions:**
- Used in-memory `ConcurrentHashMap` instead of Redis because V17 runs as a single Hugging Face Space instance. Post-V17, if multi-instance deployment is needed, replace with Redis-backed rate limiting.
- Rate limit applies per normalized email (lowercase, trimmed), not per IP. This prevents brute-force on specific accounts while allowing legitimate users on shared networks.
- Default: 5 failed attempts per 15 minutes. Successful login resets the counter.

**Test proof:** 213 tests pass, 0 failures, 0 errors.

### Script-Code Alignment Fixes — COMPLETED

**Date:** 2026-06-14

**Changes made:**

1. **`scripts/quality/public-readiness.ps1`** — Replaced `rg` (ripgrep) dependency with PowerShell-native `Get-ChildItem` + `Select-String` for token-shaped value scanning. Removed external tool dependency from CI and local runs.

2. **`scripts/deploy/huggingface-space-sync.ps1`** — Four fixes:
   - Removed `/NFL /NDL` from robocopy so copied files are visible in output
   - Added post-robocopy verification that `mvnw`, `pom.xml`, and `src/` exist in the checkout
   - Replaced unreliable Python stdin piping with temp file execution
   - Added `$LASTEXITCODE` check after Python execution

3. **`scripts/api/scenarios/17-login-rate-limit.ps1`** — New scenario validating T0-6 at integration level: 5 failed logins expect 401, 6th expects 429 with `Retry-After`, different email still works.

4. **`scripts/api/scenarios/18-health-endpoint.ps1`** — New scenario validating T0-4 at integration level: `/api/v1/health` returns UP, `/actuator/health` includes database health indicator.

5. **`scripts/api/run-all.ps1`** — Added scenarios 17 and 18 to the smoke suite.

**Decisions:**
- Rate limit test uses `Invoke-WebRequest` for the 429 check to capture response headers (Retry-After), since `Invoke-ExpectedHttpFailure` only checks status codes.
- Health scenario uses `ConvertTo-Json` string matching for actuator response format flexibility across Spring Boot versions.
- Python temp file in `huggingface-space-sync.ps1` uses GUID-named files to avoid collisions, cleaned up in `finally` block.
