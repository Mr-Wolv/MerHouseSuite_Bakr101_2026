# Agentic Operations Assistance

V14 introduces prototype-local assistant behavior for MerHouse operations. The first implementation is deterministic application logic, not provider-backed AI. It records auditable interactions, returns scoped summaries or review-only suggestions, supports explicit human accept/reject decisions for suggestions, and refuses unsupported or over-authority requests.

V15.2 is reserved for the local AI-agent architecture decision. Until that version is implemented and proven, the shipped assistant should be described as deterministic risk triage rather than an autonomous AI agent.

## Supported Scope

- `PLATFORM_OVERVIEW`: platform roles can summarize platform control-plane risk indicators.
- `MERCHANT_OPERATIONS`: merchant users can summarize only their own tenant; platform roles must provide a target merchant tenant id.
- `WAREHOUSE_OPERATIONS`: warehouse operators can summarize only their own tenant; platform roles must provide a target warehouse-provider tenant id.

The assistant can provide summaries and review suggestions. Suggestions are deterministic risk triage, not free-form automation: the service ranks the scoped metrics it is allowed to read and names one next review queue with a reason. Platform suggestions prioritize failed outbox delivery, failed shipments, fulfillment exceptions, service claims and disputes, access requests, and service reviews. Merchant and warehouse suggestions prioritize open exceptions, backorders, stock risk, inbound work, active workload, and readiness checks when no queue is open.

A pending suggestion can be accepted or rejected by the same authenticated actor who requested it. Accepting a suggestion records agreement with the suggested review path; it does not mutate operational records, approve access, change shipment state, alter inventory, create orders, settle service statements, reset passwords, or perform provider delivery.

## Intelligence Boundary

The V14 assistant is prototype-local until Pre-V16 and V16 certification. The app source must not contain private prompts, provider keys, customer data snapshots, internal endpoints, or production deployment assumptions. Current responses are generated from existing local application services and stored in `assistant_interactions` with `prototype_local=true`. Suggestion decisions are stored on the same row as `action_status`, `decision_note`, `decided_by_user_id`, and `decided_at`.

The assistant is expected to be useful within that boundary: it should not merely repeat counters when the user asks what comes next. It should choose a scoped queue, explain why that queue comes before lower-risk work, and refuse mutation requests instead of taking action.

## V15.2 Local AI-Agent Direction

The intended local AI-agent shape is:

```text
frontend -> backend -> agent-service -> local-model-runtime
                    -> backend-approved tools -> audit/database
```

The backend remains the source of truth for identity, role and tenant boundaries, tool authorization, validation, audit records, and any operational mutation. The agent-service may reason over approved context and propose plans, but it must not connect directly to the database or execute privileged operations outside backend-mediated APIs.

The local model runtime can be Dockerized beside the rest of the stack. Candidate runtimes include Ollama, llama.cpp, vLLM, or another local model server chosen during V15.2. The architecture must include model-runtime-off behavior: when the local model is unavailable, core MerHouse workflows continue and the assistant falls back to deterministic triage or a clear unavailable state.

Before Pre-V16 begins, V15.2 must either implement a first read-only local agent slice or close with an architecture-only decision and explicit blockers. Required proof includes tenant/role boundary tests for every agent-visible tool, human approval for risky actions, audit records for tool calls and decisions, eval cases for useful next-step suggestions and refusals, and publication-boundary proof that prompts, model settings, traces, and generated reports do not leak into `backend/` or `frontend`.

## Audit And Refusal Model

Every assistant request stores an `assistant_interactions` row and records an admin audit event with one of:

- `ASSISTANT_SUMMARY`
- `ASSISTANT_SUGGESTION`
- `ASSISTANT_REFUSAL`
- `ASSISTANT_SUGGESTION_ACCEPTED`
- `ASSISTANT_SUGGESTION_REJECTED`

Refusals are expected behavior for unsupported mutations, cross-tenant requests, missing or unknown platform target tenant ids, target tenants that do not match the requested operational scope, or scopes outside the actor's role authority. Refusals are recorded with the same audit path as successful summaries so reviewers can prove that the assistant did not silently ignore boundary pressure. Suggestion accept/reject decisions are also audited so reviewers can distinguish proposed guidance from explicit human agreement.

## API

- `POST /api/v1/assistant/interactions`
- `GET /api/v1/assistant/interactions?limit=25`
- `POST /api/v1/assistant/interactions/{id}/accept`
- `POST /api/v1/assistant/interactions/{id}/reject`

The history endpoint returns only the authenticated actor's own assistant interactions. Platform audit review remains available through the existing admin audit surface.

## Platform Review

The admin audit page includes assistant-specific summary counts and an assistant-only event filter. Platform roles, including `AUDITOR`, can review assistant summaries, suggestions, refusals, accepted suggestions, and rejected suggestions through this audit view. Auditors remain read-only: they can request and review assistant output, but they cannot accept or reject pending assistant suggestions.

## Proof Expectations

V14 assistant changes require:

- backend tests for role and tenant boundaries on every assistant-visible operation
- audit proof for summaries, suggestions, refusals, accepted suggestions, and rejected suggestions
- admin/auditor review proof for assistant audit events and read-only auditor behavior
- refusal tests for unsupported mutations, cross-tenant access, and over-authority scope requests
- frontend tests for role-appropriate scope options and visible prototype-local interaction history
- API smoke proof for platform, merchant, and auditor assistant endpoints, current-user history scoping, audit visibility, and smoke-scale concurrent assistant requests
- publication-boundary proof that no private prompts, provider keys, or internal endpoints are hard-coded in `backend/` or `frontend/`

The API smoke suite includes concurrent assistant summary requests to catch obvious transactional or persistence regressions. It is not maximum-load or production stress certification; measuring practical load limits remains a Pre-V16 gate.
