# Deployment-Ready Local Certification

V16 prepares MerHouse for future deployment without deploying it now. The phase proves that the codebase, configuration, docs, scripts, and local runtime are shaped for deployment later while every external dependency remains local, mocked, or explicitly deferred.

## Boundary

V16 is not a SaaS launch. It does not provision cloud infrastructure, send email, SMS, push, or webhook traffic, activate realtime infrastructure, or claim production monitoring. Actual production activation is deferred to a later optional phase.

## Local Mock Contracts

| Dependency | Local proof | Future replacement |
| --- | --- | --- |
| Notification delivery | Recipient-scoped in-app delivery records, preferences, provider status, and action inbox proof. | Email, SMS, push, or webhook delivery with callbacks, bounce handling, and deliverability monitoring. |
| Password recovery delivery | Local reset records with token echo disabled by default; API smoke can enable token echo only for local proof. | Provider-backed reset delivery and recovery runbook. |
| Carrier/provider handoff | Local outbox events and carrier-dispatch records. | Real carrier or delivery-provider adapter with idempotent callbacks and retry policy. |
| Assistant/model behavior | Deterministic prototype-local review assistance and audit records. | Optional local or provider-backed model runtime with prompt/data boundary proof. |
| Monitoring-style health | Health endpoint, readiness checks, quality scripts, and local proof reports. | Production monitoring, alerting, log retention, and incident response. |
| Backup/restore | Local dry-run script path and schema/data proof against the Docker database when requested. | Production backup schedule, restore drill, rollback procedure, and retention policy. |

## Account Settings

Authenticated users have `/account` for self-service account context and password changes. The page is deliberately narrow: it shows email, role, tenant id, enabled state, created timestamp, local security notes, and links back to Alerts and Service Review. Users can change their own password only by providing the current password. Email, role, tenant, and enabled-state governance remain under platform account management.

## Proof Commands

Daily quality remains:

```powershell
.\scripts\quality\check.ps1 -IncludeE2E -SkipCompose
```

V16 deployment-ready proof uses the separate gate:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -SkipCompose
```

When the seeded local stack is running and API smoke proof is desired:

```powershell
.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose
```

## Current Closeout Proof

The V16 local certification closeout on 2026-06-08 used the rebuilt local Docker stack and did not perform real deployment.

- `.\scripts\quality\deployment-readiness.ps1 -IncludeE2E -IncludeApiSmoke -SkipCompose` passed, covering markdown proof, public-readiness proof, backend tests, frontend lint/build/Vitest, Playwright E2E, and API smoke.
- API smoke passed against the running local stack and wrote `reports/api-smoke-test-20260608-124336.summary.md`.
- Live browser QC checked 152 routed desktop/narrow records across public auth, owner/platform, support admin, auditor, merchant, warehouse, service review, assistant, notifications, account settings, and operational detail routes with 0 horizontal overflow findings, 0 unnamed buttons or links, 0 unlabeled form controls, 0 real forbidden/unauthorized app states, and 0 console errors.
- Live action proof covered fresh local stakeholders and operating records through relationship setup, inbound receiving, stock readiness, order allocation, notifications, warehouse fulfillment, account settings, and service review.

## Future Activation Checklist

- Replace local notification and recovery delivery with configured providers.
- Replace local carrier/provider records with real provider adapters.
- Decide whether assistant behavior stays deterministic, local-model-backed, or provider-backed.
- Add production monitoring, alerting, logs, backup/restore, rollback, and incident-response runbooks.
- Re-run public-readiness certification before publishing the repository.
