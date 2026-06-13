# MerHouse Scripts Refactor Sequence

> **Purpose:** Evaluate every script in `scripts/` against the single goal: the safest path to a successful V17 deployment.
> **Constraint:** The V17 refactoring rule (`docs/architecture/roadmap.md` line 110) permits changes only for failing proof, deployment blockers, security/runtime boundary issues, performance bottlenecks, real coupling that blocks deployment, or documented defects. Everything else waits.
> **Method:** Each refactoring task is scored on six dimensions, then assigned one of four dispositions. Architectural preferences are challenged and flagged where they promote style over measurable deployment value.

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

## Script Inventory

56 scripts across 6 subdirectories:

| Directory | Scripts | Total Lines | Purpose |
|-----------|---------|-------------|---------|
| `scripts/api/` | 1 runner + 4 lib + 17 scenarios | ~15,000 | API smoke test suite |
| `scripts/deploy/` | 2 | ~230 | Deployment shape checks and Space sync |
| `scripts/local/` | 5 | ~1,200 | Local stack start/stop/seed/dev helpers |
| `scripts/maintenance/` | 1 | ~110 | Report cleanup |
| `scripts/proof/` | 5 android + 10 release + 2 web + 2 lib | ~18,000 | V17 deployment proof scripts |
| `scripts/quality/` | 9 | ~5,200 | Local quality gate and readiness checks |

---

## Self-Challenge Summary

Before the task-by-task evaluation, here are the key places where refactoring enthusiasm must be checked against deployment value:

1. **HTTP client consolidation (4 implementations) → Do only if a real problem appears.** The four HTTP helpers (`Invoke-Json` in api/lib, `Invoke-Api` in seed-demo, `Invoke-ApiJson` in native-android-tour, ad-hoc `Invoke-RestMethod` in deployed-v17-proof) serve different contexts with different needs. The api/lib version uses a context hashtable; seed-demo uses a closure over `$apiBaseUrl`; native-android-tour adds ADB-specific error handling; deployed-v17-proof has custom auth header management. Consolidating them is 3-5 days of high-risk refactoring touching every script that makes HTTP calls, with zero user-visible benefit.

2. **Credential parameter boilerplate (4+ tour scripts) → Never do unless architecture changes significantly.** The repeated `-AdminEmail`, `-AdminPassword`, `-MerchantEmail`, etc. parameter blocks are boilerplate, but they work. Extracting a shared credential object would change the public interface of every proof script, breaking CI workflow invocations and operator muscle memory. The "fix" is worse than the problem.

3. **Proof fixture generator breakup (2 scripts, 870 + 687 lines) → Do after V17.** `deployed-v17-proof-attachment-check.ps1` and `v17-cutover-readiness-check.ps1` are large, but they are test fixture generators. Extracting fixture JSON into separate files is good hygiene but has no deployment impact. The scripts work correctly as-is.

4. **Monolithic native-android-tour.ps1 (863 lines) → Do after V17.** The script is large but self-contained. It includes SDK detection, ADB management, screenshot capture, and report generation. Splitting it into modules would improve maintainability but has high refactor risk and zero deployment impact.

5. **Package-by-purpose reorganization → Never do unless architecture changes significantly.** Moving scripts between subdirectories (e.g., merging `proof/lib/` into a top-level `lib/`) is folder organization, not a deployment blocker. The current layout is consistent and navigable.

---

## Task Evaluations

### S0-1: Fix Corrupted Function Names in tour-report-lib.ps1

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **High** | Any proof script dot-sourcing this library will fail at runtime |
| User impact | **Low** | Users don't run proof scripts directly |
| Operational impact | **High** | Proof scripts cannot produce V17 deployment evidence |
| Implementation risk | **Low** | Three single-word replacements |
| Refactor risk | **Low** | No behavior change; fixes broken behavior |
| Evidence the problem exists | **High** | `ooin-Path` on lines 13, 28 and `ConvertFrom-oson` on line 59 are not valid PowerShell cmdlets |

**Disposition: Must do before V17**

**Scope:** Fix three corrupted function names in `scripts/proof/lib/tour-report-lib.ps1`:
- Line 13: `ooin-Path` → `Join-Path`
- Line 28: `ooin-Path` → `Join-Path`
- Line 59: `ConvertFrom-oson` → `ConvertFrom-Json`

**Estimated effort:** 5 minutes

---

### S0-2: Shared Common Library (Project Root + Path Resolution)

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | Inconsistent `$projectRoot` computation has 3 different patterns; a subtle bug in any one breaks that script silently |
| User impact | **Low** | Users don't see which path resolution pattern a script uses |
| Operational impact | **Medium** | When a script fails because `$projectRoot` resolved to the wrong directory, diagnosis is non-obvious |
| Implementation risk | **Low** | Additive library; mechanical replacement in each script |
| Refactor risk | **Low** | Each script change is a 2-line replacement; rollback is trivial per-script |
| Evidence the problem exists | **High** | Grep shows 25+ instances with 3 distinct patterns: `Split-Path -Parent (Split-Path -Parent ...)`, `Resolve-Path (Join-Path $PSScriptRoot "..\..")`, and `(Resolve-Path (...)).Path`. The `IsPathRooted` ternary appears 25+ times across 15+ files. |

**Disposition: Must do before V17**

**Revised scope:**
1. Create `scripts/lib/common.ps1` with two functions:
   - `Get-MerHouseProjectRoot` — resolves project root from any script depth using `$PSScriptRoot` traversal
   - `Resolve-MerHousePath` — replaces the `IsPathRooted` ternary pattern
2. Dot-source `common.ps1` in every script that resolves `$projectRoot` or paths
3. Replace inline `$projectRoot` computation with `Get-MerHouseProjectRoot`
4. Replace inline `IsPathRooted` ternaries with `Resolve-MerHousePath`

**Estimated effort:** 2-3 hours

**Why this qualifies:** The three different `$projectRoot` patterns are a maintenance hazard. A script moved between directories (e.g., from `scripts/quality/` to `scripts/proof/release/`) silently resolves to the wrong root because the `Split-Path` depth changes. The common library eliminates this class of bug.

---

### S0-3: Extract Invoke-Checked Helper

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | The 3 copies are identical; no divergence bug exists yet |
| User impact | **Low** | Users never see helper functions |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Extract to shared library; dot-source in 3 scripts |
| Refactor risk | **Low** | 3 scripts changed; function signature is stable |
| Evidence the problem exists | **Medium** | 3 identical copies in `public-readiness.ps1`, `v17-production-readiness.ps1`, `deployed-v17-proof.ps1`. A future bug fix must be applied 3 times. |

**Disposition: Do after V17**

**Rationale:** The duplication is real but the copies are identical today. The risk of divergence exists but has not materialized. Extract to `scripts/lib/proof-helpers.ps1` post-V17 when modifying any of these scripts for other reasons.

---

### S0-4: Extract Assert-ProofTimestamp

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | 2 copies; one is nested inside another function |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Extract and dot-source |
| Refactor risk | **Low** | 2 scripts affected |
| Evidence the problem exists | **Low** | Copies are identical; no divergence observed |

**Disposition: Do after V17**

---

### S0-5: Extract Assert-NoSecretLeak

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Medium** | Secret leak detection is a security boundary; divergence between copies could miss a leak pattern |
| User impact | **Low** | Users don't see assertion functions |
| Operational impact | **Medium** | A missed leak pattern in one copy means evidence artifacts could contain secrets |
| Implementation risk | **Low** | Extract and dot-source |
| Refactor risk | **Low** | 2 scripts affected |
| Evidence the problem exists | **Medium** | The function is 80+ lines of recursive JSON traversal. Two copies in `deployed-v17-proof.ps1` and `deployed-v17-proof-attachment-check.ps1`. Adding a new sensitive field pattern requires updating both copies. |

**Disposition: Do after V17** — but prioritize within the first post-V17 wave because secret leak detection is a security boundary.

---

### S0-6: Extract Assert-SafeEvidenceText

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | 3 copies with slightly different regex patterns |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | The 3 copies have slightly different rejection messages and regex patterns; consolidation must preserve each script's specific rules |
| Refactor risk | **Low** | 3 scripts affected |
| Evidence the problem exists | **Low** | The copies differ in their regex patterns (one rejects `webhook`, another rejects `token`, etc.). This is intentional per-script customization, not accidental divergence. |

**Disposition: Do only if a real problem appears**

**Rationale:** The three copies in `v17-alert-routing-proof.ps1`, `v17-email-provider-proof.ps1`, and `v17-live-stakeholder-walkthrough-proof.ps1` have deliberately different rejection patterns matching each proof's specific evidence requirements. Consolidating them into a parameterized shared function is possible but the differences are intentional. Only consolidate if a new proof script needs the same pattern.

---

### S0-7: HTTP Client Consolidation

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | All 4 implementations work correctly in their context |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | Changes the HTTP calling pattern in every script that makes API calls |
| Refactor risk | **High** | 4 implementations with different signatures; must preserve auth handling, error behavior, and context passing |
| Evidence the problem exists | **Low** | No HTTP client bug has been reported. The implementations serve different contexts. |

**Disposition: Do only if a real problem appears**

**Rationale:** The four HTTP helpers have legitimately different interfaces:
- `Invoke-Json` (api/lib/http.ps1): Takes a `$Context` hashtable with `BaseUrl` and `DefaultHeaders`
- `Invoke-Api` (seed-demo.ps1): Closure over `$apiBaseUrl` and `$adminToken`
- `Invoke-ApiJson` (native-android-tour.ps1): Adds ADB port-forwarding error context
- Ad-hoc `Invoke-RestMethod` (deployed-v17-proof.ps1): Custom auth header injection

Consolidating these into a single parameterized function is possible but the risk of breaking the subtle differences (especially ADB error context and seed-demo closure behavior) outweighs the maintenance benefit.

---

### S0-8: Break Up Proof Fixture Generators

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Fixture generators work correctly |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | Extracting JSON fixtures into files changes how the scripts generate test data |
| Refactor risk | **Medium** | 2 scripts, 870 + 687 lines; must preserve exact fixture output |
| Evidence the problem exists | **Low** | No bug in fixture generation |

**Disposition: Do after V17**

**Rationale:** `deployed-v17-proof-attachment-check.ps1` (870 lines) and `v17-cutover-readiness-check.ps1` (687 lines) are large because they generate many fixture JSON files with precise field values. Extracting the fixture data into template JSON files would reduce script size but adds a file-loading dependency and makes it harder to see the fixture structure at a glance. This is test infrastructure cleanup, not deployment work.

---

### S0-9: Split native-android-tour.ps1

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Script works end-to-end |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | 863 lines of tightly coupled SDK detection, ADB management, screenshot capture, and report generation |
| Refactor risk | **High** | State flows through script-scoped variables; extraction into modules requires careful interface design |
| Evidence the problem exists | **Low** | No bug traced to script size |

**Disposition: Do after V17**

---

### S0-10: Consolidate Library Layer (api/lib + proof/lib → scripts/lib)

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | No deployment blocker |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | Changes dot-source paths in 20+ scripts |
| Refactor risk | **Medium** | Must update every script that dot-sources from api/lib or proof/lib |
| Evidence the problem exists | **Low** | The current layout works; api/lib serves API smoke tests, proof/lib serves proof scripts |

**Disposition: Do after V17**

**Rationale:** The current `api/lib/` and `proof/lib/` split reflects the two main script families. Moving everything to a flat `scripts/lib/` is organizational preference. The S0-2 common library (`scripts/lib/common.ps1`) already creates the top-level `lib/` directory without requiring full consolidation. Post-V17, if the number of shared libraries grows, consolidate then.

---

### S0-11: Deduplicate api-smoke.ps1 Wrapper

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Wrapper works correctly |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Small localized change |
| Refactor risk | **Low** | 1 script |
| Evidence the problem exists | **Low** | The wrapper adds path normalization before calling run-all.ps1; this is intentional defense-in-depth |

**Disposition: Never do unless architecture changes significantly**

**Rationale:** `quality/api-smoke.ps1` wraps `api/run-all.ps1` with additional URL normalization and path resolution. This is intentional: the quality gate script validates inputs before delegating to the runner. Removing the wrapper eliminates a validation layer.

---

### S0-12: seed-demo.ps1 HTTP Client Extraction

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | seed-demo.ps1 works correctly |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | Changing the HTTP calling pattern in a 765-line script risks breaking seed data creation |
| Refactor risk | **Medium** | The `Invoke-Api` closure depends on script-scoped `$apiBaseUrl` and `$adminToken` |
| Evidence the problem exists | **Low** | No bug in seed-demo HTTP calls |

**Disposition: Do only if a real problem appears**

**Rationale:** The `Invoke-Api` function in `seed-demo.ps1` uses closure variables (`$apiBaseUrl`, `$adminToken`) that are set during script execution. Replacing it with the shared `Invoke-Json` from `api/lib/http.ps1` would require restructuring the script to use a context hashtable, which is a significant change for a seed data script.

---

### S0-13: Extract Read-EnvFile from huggingface-space-sync.ps1

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Function works correctly |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Low** | Extract and dot-source |
| Refactor risk | **Low** | 1 script affected |
| Evidence the problem exists | **Low** | Only one consumer of the function today |

**Disposition: Do after V17**

**Rationale:** `Read-EnvFile` is currently only used by `huggingface-space-sync.ps1`. Extract it to a shared library when a second consumer appears.

---

### S0-14: Credential Parameter Boilerplate

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Parameters work correctly |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **High** | Changes the public interface of every proof script |
| Refactor risk | **High** | CI workflows and operator commands reference specific parameter names |
| Evidence the problem exists | **Low** | The boilerplate is repetitive but functional |

**Disposition: Never do unless architecture changes significantly**

**Rationale:** The repeated credential parameters (`-AdminEmail`, `-AdminPassword`, `-MerchantEmail`, etc.) across `deployed-v17-proof.ps1`, `native-android-tour.ps1`, `frontend-full-tour.ps1`, and others are boilerplate, but they are the public interface of each script. Extracting a shared credential object would break CI workflow invocations, operator muscle memory, and the `-ConfirmXxxProof` safety gates. The repetition is the cost of having independent, self-documenting proof scripts.

---

### S0-15: report.ps1 Monolith (530 lines)

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Report generation works correctly |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | Report functions reference shared context; extraction requires careful interface design |
| Refactor risk | **Medium** | 530 lines of tightly coupled report generation |
| Evidence the problem exists | **Low** | No bug in report generation |

**Disposition: Do after V17**

---

### S0-16: native-mobile-check.ps1 Split

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Script works correctly |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | 457 lines of Android validation with internal state |
| Refactor risk | **Medium** | State flows through script-scoped variables |
| Evidence the problem exists | **Low** | No bug traced to script size |

**Disposition: Do after V17**

---

### S0-17: v17-cutover-readiness.ps1 Validation Engine

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Production risk reduction | **Low** | Validation logic works correctly |
| User impact | **Low** | No user-visible change |
| Operational impact | **Low** | No operational difference |
| Implementation risk | **Medium** | 695 lines of validation with complex manifest parsing |
| Refactor risk | **Medium** | Validation rules are tightly coupled to manifest schema |
| Evidence the problem exists | **Low** | No bug in validation |

**Disposition: Do after V17**

---

## Consolidated Implementation Sequence

### Must Do Before V17 (2 tasks, ~3 hours)

| Seq | Task ID | Title | Effort | Risk |
|-----|---------|-------|--------|------|
| 1 | S0-1 | Fix corrupted function names in tour-report-lib.ps1 | 5 minutes | Critical bug |
| 2 | S0-2 | Shared common library (project root + path resolution) | 2-3 hours | Mechanical |

**Execution order:**
- Task 1 is a 5-minute bug fix — do it first.
- Task 2 creates the common library and updates 25+ scripts — do it second, test parse on each file.

### Do After V17 (8 tasks)

| Task ID | Title | Priority |
|---------|-------|----------|
| S0-5 | Extract Assert-NoSecretLeak | First wave (security boundary) |
| S0-3 | Extract Invoke-Checked | First wave |
| S0-4 | Extract Assert-ProofTimestamp | Second wave |
| S0-8 | Break up proof fixture generators | Second wave |
| S0-9 | Split native-android-tour.ps1 | Second wave |
| S0-10 | Consolidate library layer | Second wave |
| S0-13 | Extract Read-EnvFile | When second consumer appears |
| S0-15 | Split report.ps1 | As needed |
| S0-16 | Split native-mobile-check.ps1 | As needed |
| S0-17 | Split v17-cutover-readiness.ps1 | As needed |

### Do Only If a Real Problem Appears (3 tasks)

| Task ID | Title | Trigger Condition |
|---------|-------|-------------------|
| S0-6 | Extract Assert-SafeEvidenceText | A new proof script needs the same pattern |
| S0-7 | HTTP client consolidation | An HTTP client bug causes a proof failure |
| S0-12 | seed-demo.ps1 HTTP extraction | A seed-demo HTTP bug is found |

### Never Do Unless Architecture Changes Significantly (2 tasks)

| Task ID | Title | Why Never |
|---------|-------|-----------|
| S0-11 | Deduplicate api-smoke.ps1 wrapper | Wrapper adds intentional validation layer |
| S0-14 | Credential parameter boilerplate | Public interface of independent proof scripts |

---

## Duplication Map

The following table shows exactly where each duplicated pattern lives:

### `$projectRoot` resolution (3 variants, 25+ files)

| Variant | Files |
|---------|-------|
| `Split-Path -Parent (Split-Path -Parent $PSScriptRoot)` | backend-check, frontend-check, markdown-check, public-readiness, api-smoke, start, stop, frontend-dev, mobile-shell-check, frontend-deploy-check |
| `Resolve-Path (Join-Path $PSScriptRoot "..\..")` | deployment-readiness, v17-production-readiness, huggingface-space-sync, huggingface-vercel-check, deployed-v17-proof, v17-cutover-readiness, v17-cutover-readiness-check, deployed-v17-proof-attachment-check, performance-readiness, deployed-monitoring-proof, v17-email-provider-proof, v17-alert-routing-proof, v17-live-stakeholder-walkthrough-proof, native-android-tour |
| `(Resolve-Path (...)).Path` | native-android-release-shape-check, load-smoke |

### `IsPathRooted` ternary (25+ instances, 15+ files)

deployment-readiness, huggingface-space-sync, native-android-release-check, v17-cutover-readiness (2x), performance-readiness, v17-email-provider-proof, v17-live-stakeholder-walkthrough-proof, native-android-tour (3x), deployed-v17-proof-attachment-check, v17-cutover-readiness-check, native-android-release-visual-tour-proof, api-smoke, native-android-release-login-proof, mobile-shell-check, deployed-v17-proof (5x), frontend-deploy-check, deployed-monitoring-proof, load-smoke

### `Invoke-Checked` (3 copies)

public-readiness.ps1, v17-production-readiness.ps1, deployed-v17-proof.ps1

### `Assert-ProofTimestamp` (2 copies)

deployed-v17-proof.ps1 (nested inside `Resolve-EvidenceAttachment`), v17-cutover-readiness.ps1

### `Assert-NoSecretLeak` (2 copies)

deployed-v17-proof.ps1, deployed-v17-proof-attachment-check.ps1

### `Assert-SafeEvidenceText` (3 copies)

v17-alert-routing-proof.ps1, v17-email-provider-proof.ps1, v17-live-stakeholder-walkthrough-proof.ps1

### `Read-EnvFile` (1 copy)

huggingface-space-sync.ps1

---

## Architectural Preference vs. Measurable Business Value

The following findings represent architectural preference, not measurable business value for V17:

1. **"Four HTTP client implementations" (S0-7)** — Each serves a different context with different needs. Consolidation is high-risk for zero user benefit.

2. **"Credential parameter boilerplate" (S0-14)** — The repetition is the cost of independent, self-documenting proof scripts with explicit safety gates.

3. **"Library layer fragmentation" (S0-10)** — The api/lib and proof/lib split reflects the two main script families. It is consistent and navigable.

4. **"Monolithic scripts" (S0-8, S0-9, S0-15, S0-16, S0-17)** — Script size is a developer convenience metric. The scripts work correctly. Splitting them is risk without deployment reward.

---

## Risk Summary

### Risks of doing too much before V17

1. **Regression risk** — Every script change risks breaking a proof or quality gate. The CI workflow depends on these scripts.
2. **Schedule risk** — The common library update touches 25+ files. Each must be verified.
3. **Scope creep risk** — "While we're adding common.ps1, we might as well consolidate the HTTP clients" — this is how 2 tasks become 16.

### Risks of doing too little before V17

1. **Broken proof scripts** — The `ooin-Path` / `ConvertFrom-oson` typos in tour-report-lib.ps1 will cause runtime failures for any script that dot-sources it.
2. **Silent path resolution bugs** — Three different `$projectRoot` patterns mean a script moved between directories could silently resolve to the wrong root.

### The safest path

Fix the bug (S0-1). Add the common library (S0-2). Deploy V17. Then let production evidence drive the next wave.

---

## Implementation Log

### S0-1: Fix tour-report-lib.ps1 corrupted function names (COMPLETE)

Fixed 3 corrupted function names in `scripts/proof/lib/tour-report-lib.ps1`:
- Line 13: `ooin-Path` -> `Join-Path`
- Line 28: `ooin-Path` -> `Join-Path`
- Line 59: `ConvertFrom-oson` -> `ConvertFrom-Json`

### S0-2: Create shared common library (COMPLETE)

Created `scripts/lib/common.ps1` with:
- `Get-MerHouseProjectRoot` - replaces 25+ inline `$projectRoot` / `$repoRoot` computations
- `Resolve-MerHousePath` - replaces 25+ `IsPathRooted` ternary path resolution patterns

Updated 30+ scripts across all categories (api, deploy, local, maintenance, proof, quality) to:
- Dot-source the common library
- Use `Get-MerHouseProjectRoot` instead of inline path computation
- Use `Resolve-MerHousePath` instead of `IsPathRooted` ternaries

Parse validation: 63 scripts, 0 failures.

**Runtime fix:** Two scripts accessed `$projectRoot.Path` (a `PathInfo` property from the old `Resolve-Path` pattern). Since `Get-MerHouseProjectRoot` returns a string, `.Path` resolved to `$null`:
- `deployed-v17-proof-attachment-check.ps1`: `$projectRoot.Path.Replace(...)` -> `$projectRoot.Replace(...)`
- `performance-readiness.ps1`: `$projectRoot.Path.Length` -> `$projectRoot.Length`

**Runtime validation:** `v17-production-readiness.ps1` executed successfully through 15/16 checks. The only failure is `public-readiness.ps1` requiring `rg` (ripgrep) which is not installed -- unrelated to the refactoring. All `Get-MerHouseProjectRoot` and `Resolve-MerHousePath` call sites resolved correctly at runtime.
