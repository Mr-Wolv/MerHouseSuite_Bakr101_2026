# V13 Notifications Foundation

## Durable Docs

- [[docs/architecture/notifications|Notifications]]
- [[docs/architecture/account-lifecycle|Account lifecycle]]
- [[docs/development/frontend|Frontend guide]]
- [[docs/architecture/roadmap#V13: Notifications, Live Updates, And Account Lifecycle Delivery|Roadmap V13]]

## What Exists

- User-scoped notification preferences for account lifecycle, operations, service accountability, and outbox health.
- Prototype-local delivery history for in-app records.
- Account lifecycle hooks for password-reset preparation and access-request conversion.
- `/notifications` route for authenticated roles.
- Notification summary endpoint for unread count and latest delivery timestamp.
- App-shell `Alerts` badge and polling refresh.
- Notification page delivery-history polling.
- Recipient-scoped visibility proof for notification summary, preferences, delivery history, and mark-read actions.
- Production-shaped delivery stage and provider status fields on delivery records.

## Boundaries

- No provider credentials.
- No private endpoints.
- No real external email, SMS, push, or webhook delivery.
- Production delivery remains Pre-V16/V16 certification work.
- Platform roles do not get cross-user notification visibility through `/api/v1/notifications/*`.
- V13 delivery records should show `LOCAL_RECORDED`, `NOT_CONFIGURED`, and `prototypeLocal=true` until provider delivery is deliberately certified.

## Live Update Decision

- V13 uses lightweight polling for notification summary, delivery history freshness, and app-shell alert counts.
- SSE is a later candidate if one-way server-to-browser updates become valuable.
- WebSockets are reserved for a future need for bidirectional realtime collaboration or command streams.

## Focused Proof

```powershell
cd backend
.\mvnw -q "-Dtest=NotificationServiceTest,AuthRecoveryServiceTest,AccessRequestServiceTest" test
.\mvnw -q "-Dtest=NotificationServiceTest,NotificationControllerTest,AuthRecoveryServiceTest,AccessRequestServiceTest" test
.\mvnw -q test

cd ..\frontend
npm test -- --run src/pages/NotificationCenterPage.test.tsx src/components/AppLayout.test.tsx src/api/client.test.ts
npm run lint
npm run build
npm test -- --run

cd ..
.\scripts\local\start.ps1 -ResetDatabase
.\scripts\local\seed-demo.ps1 -CreateReviewAccounts -SuppressCredentialOutput
.\scripts\quality\frontend-check.ps1 -SkipInstall -IncludeE2E
.\scripts\quality\markdown-check.ps1
.\scripts\quality\public-readiness.ps1 -SkipCompose
```

## Completed V13 Proof

- Full backend test pass, including Flyway empty-database migration proof for 16 migrations.
- Frontend lint, production build, and full Vitest.
- Playwright browser proof on a rebuilt seeded local stack.
- Live `/notifications` browser smoke showing `Password reset prepared`, `Local recorded`, `Provider not configured`, and `Prototype-local`.
- Markdown link proof.
- Public-readiness proof.
