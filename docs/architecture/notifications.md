# Notifications

MerHouse V13 provides a local notification foundation. It records account-lifecycle delivery history and exposes per-user notification preferences without connecting to an external provider.

This is prototype-local behavior. The backend stores delivery records for visibility and proof, but it does not send email, SMS, push, webhooks, or provider traffic. Production delivery, provider credentials, callback endpoints, bounce handling, and deliverability monitoring remain Pre-V16 and V16 work.

## Model

Notification preferences are scoped to one user, topic, and channel.

Topics:

- `ACCOUNT_LIFECYCLE`
- `OPERATIONS`
- `SERVICE_ACCOUNTABILITY`
- `OUTBOX_HEALTH`

Channels:

- `IN_APP`
- `EMAIL_PROTOTYPE`

Delivery records are scoped to the recipient user and tenant. They include topic, channel, status, title, body, optional source type and source id, creation time, read time, and a `prototypeLocal` flag.

Delivery statuses:

- `RECORDED`: the local in-app record is available to the recipient.
- `READ`: the recipient marked the local record as read.
- `SKIPPED_BY_PREFERENCE`: the event was kept in history, but the recipient disabled the matching in-app preference.

Delivery stages:

- `PREPARED`: reserved for future provider-ready delivery preparation before local or provider dispatch is completed.
- `LOCAL_RECORDED`: the V13 local record was persisted for the recipient.
- `SKIPPED_BY_PREFERENCE`: the event was retained as local history after the user disabled the matching in-app preference.

Provider statuses:

- `NOT_CONFIGURED`: V13 has no external delivery provider configured. This is the expected status for local prototype records.
- `READY_FOR_PROVIDER`: reserved for a later provider-backed delivery handoff after Pre-V16 and V16 certification.

## Account Lifecycle Hooks

Password-reset requests for enabled users create a local `ACCOUNT_LIFECYCLE` delivery record titled `Password reset prepared`.

Approved access requests converted into tenant and user records create a local `ACCOUNT_LIFECYCLE` delivery record titled `Account ready`.

Both hooks are deliberately worded and labeled as prototype-local. They provide delivery history and UI proof without pretending that production messaging exists.

Both hooks currently store `deliveryStage=LOCAL_RECORDED`, `providerStatus=NOT_CONFIGURED`, and `prototypeLocal=true`. That gives future provider integration a stable slot while keeping V13 honest: reset links and account-ready messages are prepared as local delivery records only.

## V15.5 Connected Alert Direction

V15.5 extends the local notification foundation from account-lifecycle proof into connected operational handoff proof. The goal is still local, recipient-scoped alerting, not provider-backed delivery.

Connected operational alerts should answer:

- who created the event
- who needs to act next
- which object the event belongs to through `sourceType` and `sourceId`
- where the recipient should inspect the current state
- whether the event is action-needed, reviewable history, or resolved

The first V15.5 implementation records local in-app alerts for merchant-warehouse relationship and inbound stock handoffs:

- merchant requests warehouse service: warehouse operators for that provider receive an action alert, and platform owner/admin/support-admin users receive a governance review alert
- warehouse activates service: merchant users receive a review alert that inbound and warehouse work can begin
- merchant submits an inbound stock request or submits a draft: warehouse operators for that provider receive an action alert tied to the `InboundStockRequest`
- merchant cancels an inbound request: warehouse operators receive a no-action-needed update
- warehouse approves, starts receiving, receives, or rejects inbound stock: merchant users receive a review/action alert tied to the `InboundStockRequest`

The second V15.5 implementation records local in-app alerts for fulfillment and shipment handoffs:

- warehouse moves an allocation to picking or packed: merchant users receive progress alerts tied to the `FulfillmentAllocation`
- warehouse creates a shipment and package evidence: merchant users receive a handoff alert tied to the `Shipment`, including carrier, tracking number, and package count
- warehouse marks a shipment delivered, failed, or returned: merchant users receive a status alert tied to the `Shipment`
- warehouse reports a fulfillment exception: merchant users receive a review alert tied to the `FulfillmentException`
- merchant resolves a fulfillment exception: warehouse operators for that provider receive a resolved alert tied to the `FulfillmentException`

The third V15.5 implementation records local in-app alerts for outbox diagnostics and service-accountability handoffs:

- outbox processor failures: owner/admin/support-admin users receive an outbox-health alert tied to the failed aggregate source
- outbox retry and dead-letter actions: owner/admin/support-admin users receive a follow-up alert tied to the aggregate source
- merchant proposes a service agreement: warehouse operators receive a service-accountability alert tied to the `ServiceAgreement`
- warehouse accepts a service agreement: merchant users receive a service-accountability alert tied to the `ServiceAgreement`
- service statements, disputes, claims, reviews, and their resolution steps: the counterparty receives a service-accountability alert tied to the statement, dispute, claim, or review record; platform/admin actions alert both merchant and warehouse parties

Every connected alert must remain tenant-scoped, role-appropriate, and safe for the future public `backend/` and `frontend/` source boundary.

The V15.5 closeout pass adds source navigation for connected local alerts. When a delivery has a routed source, the notification card links to that work surface:

- operational detail routes for `InboundStockRequest`, `FulfillmentAllocation`, `InventoryItem`, `MerchantWarehouseRelationship`, and `Shipment`
- `/service-accountability` for service agreements, statements, disputes, claims, and reviews
- `/admin/outbox` for outbox-health alerts

Sources without a safe routed surface stay visible as source chips only; they should not render dead links.

Provider-backed email, SMS, push, webhook, and realtime delivery remain Pre-V16/V16 work. V15.5 may add local in-app delivery records and UI source semantics, but it must not claim production delivery.

## API

Authenticated users can access only their own notification records:

- `GET /api/v1/notifications/summary`
- `GET /api/v1/notifications/preferences`
- `PATCH /api/v1/notifications/preferences`
- `GET /api/v1/notifications/deliveries?limit=50`
- `PATCH /api/v1/notifications/deliveries/{id}/read`

Backend authorization is user-scoped. Marking another user's delivery as read is rejected.

The summary endpoint returns the current user's unread count and latest delivery timestamp. It is intended for lightweight app-shell refresh and badge rendering.

## Visibility Rules

Notification visibility is recipient-scoped, not role-broadcast. Platform users, support admins, auditors, merchants, and warehouse operators all use the same notification endpoints, but each request is scoped to the authenticated user id from the security principal.

Rules:

- Users can read only their own notification summary, preferences, and delivery history.
- Users can update only their own preferences.
- Users can mark only their own delivery records as read.
- Tenant and role context can shape which events are recorded later, but it must not let one account read another account's delivery history.
- Platform-admin roles do not receive cross-user notification visibility through the user notification API.

## Frontend

The React console exposes `/notifications` for all authenticated roles through the `Alerts` navigation item. The page shows:

- unread and delivery-record counts
- all preference rows and enable/disable actions
- local delivery history
- prototype-local labels
- delivery stage and provider status labels
- mark-read actions for unread records
- background refresh for delivery history

## Live Update Direction

V13 uses a lightweight polling refresh path for notification summary and delivery history. This proves user-visible freshness, role-scoped visibility, and app-shell alert counts without introducing realtime infrastructure too early.

The app shell polls the current user's notification summary and displays an unread count on the `Alerts` navigation item. The notification page refreshes delivery history in the background, and still refreshes immediately after preference or read-state changes.

SSE or WebSockets should be treated as a later deliberate architecture decision:

- Use SSE if MerHouse needs one-way server-to-browser updates for notifications and dashboards.
- Use WebSockets only if MerHouse needs bidirectional realtime collaboration or command streams.

Until that decision is made, polling remains the V13 implementation path.

## Publication Boundary

No provider credentials, private endpoints, webhook secrets, tokens, customer data, or operational reports are required or embedded in `backend/` or `frontend/` for this foundation. Provider-backed delivery must be introduced later through externalized configuration and V16 secret-management proof.

## Proof

Focused proof:

```powershell
cd backend
.\mvnw -q "-Dtest=NotificationServiceTest,AuthRecoveryServiceTest,AccessRequestServiceTest" test
.\mvnw -q "-Dtest=NotificationServiceTest,NotificationControllerTest,AuthRecoveryServiceTest,AccessRequestServiceTest" test

cd ..\frontend
npm test -- --run src/pages/NotificationCenterPage.test.tsx src/components/AppLayout.test.tsx src/api/client.test.ts
npm run lint
```

The Playwright full tour includes notification-recipient proof: a password-reset delivery created for one admin account is visible to that account and absent for a support-admin account. It also includes multi-role notification preference proof: a merchant preference change affects merchant delivery state without leaking to a warehouse operator, while the warehouse operator still receives its own local lifecycle delivery.

The V13 close-out proof also ran the broad backend, frontend, Playwright, migration, markdown, and publication-boundary checks from the roadmap change-quality rule.
