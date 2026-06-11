# Agentic Operations Assistance

V14 introduces deterministic local assistant behavior for MerHouse operations. The first implementation is application logic, not provider-backed AI. It records auditable interactions, returns scoped summaries or review-only suggestions, supports explicit human accept/reject decisions for suggestions, and refuses unsupported or over-authority requests.

Future model-backed or provider-backed agent activation belongs to V17 or later unless the roadmap is deliberately changed. Until that future work is implemented and proven, the shipped assistant should be described as deterministic risk triage rather than an autonomous AI agent. The V17 target is not just chat completion: it is bounded agentic work through backend-approved tools, human approval for risky actions, and complete audit evidence.

V17 v1 introduces the runtime seam without mutation authority. `AssistantService` owns authenticated request persistence, history scoping, suggestion decisions, and audit records; `AssistantRuntime` owns read-plus-draft generation through the deterministic `DeterministicAssistantRuntime` implementation. Assistant interactions record `agentMode`, optional `agentModelName`, `agenticWork=read-plus-draft`, `mutationPolicy`, and `runtime` metadata so deployed proof can distinguish deterministic local drafts from any later model-backed runtime.

For the first deployed V17 release, this is intentionally the only prototype-grade product capability. The rest of V17 should converge on professional deployment proof for the existing web/backend, email, operations, and Android release paths. The assistant must therefore stay clearly labeled as read-plus-draft and must not become a hidden deployment blocker for model/provider work.

Public deployment safety currently accepts only `MERHOUSE_AGENT_MODE=deterministic` with a bounded `MERHOUSE_AGENT_TIMEOUT_SECONDS` value from 1 to 60. Non-deterministic or provider-backed modes must fail startup and deployment env audit until a real runtime adapter, authorization model, unavailable-state behavior, and proof suite are implemented.

## Supported Scope

- `PLATFORM_OVERVIEW`: platform roles can summarize platform control-plane risk indicators.
- `MERCHANT_OPERATIONS`: merchant users can summarize only their own tenant; platform roles must provide a target merchant tenant id.
- `WAREHOUSE_OPERATIONS`: warehouse operators can summarize only their own tenant; platform roles must provide a target warehouse-provider tenant id.

The assistant can provide summaries and review suggestions. Suggestions are deterministic risk triage, not free-form automation: the service ranks the scoped metrics it is allowed to read and names one next review queue with a reason. Platform suggestions prioritize failed outbox delivery, failed shipments, fulfillment exceptions, service claims and disputes, access requests, and service reviews. Merchant and warehouse suggestions prioritize open exceptions, backorders, stock risk, inbound work, active workload, and readiness checks when no queue is open.

A pending suggestion can be accepted or rejected by the same authenticated actor who requested it. Accepting a suggestion records agreement with the suggested review path; it does not mutate operational records, approve access, change shipment state, alter inventory, create orders, settle service statements, reset passwords, or perform provider delivery.

## Intelligence Boundary

The V14 assistant remains deterministic local proof behavior through V16.2. V17 keeps that deterministic behavior as the default runtime while separating the runtime boundary for later model-backed activation. Current responses are generated from existing local application services and stored in `assistant_interactions` with `prototype_local=true`, a legacy schema flag that marks the interaction as local review evidence rather than provider-backed output. Suggestion decisions are stored on the same row as `action_status`, `decision_note`, `decided_by_user_id`, and `decided_at`.

The assistant is expected to be useful within that boundary: it should not merely repeat counters when the user asks what comes next. It should choose a scoped queue, explain why that queue comes before lower-risk work, and refuse mutation requests instead of taking action.

## Future Agent Direction

The intended local AI-agent shape is:

```text
frontend -> backend -> agent-service -> local-model-runtime
                    -> backend-approved tools -> audit/database
```

The backend remains the source of truth for identity, role and tenant boundaries, tool authorization, validation, audit records, and any operational mutation. The current in-process `AssistantRuntime` receives a bounded `AssistantRuntimeRequest`, reads only approved backend services for the requested scope, and returns an `AssistantDraft` containing response text, metadata, and audit reason. A later external agent-service may reason over approved context and propose plans, but it must not connect directly to the database or execute privileged operations outside backend-mediated APIs.

The local model runtime can be Dockerized beside the rest of the stack. Candidate runtimes include Ollama, llama.cpp, vLLM, or another local model server chosen during the future activation phase. The architecture must keep model-runtime-off behavior: when the local model is unavailable, core MerHouse workflows continue and the assistant falls back to deterministic triage or a clear unavailable state.

Before any provider-backed or model-backed assistant activation begins, the local AI-agent direction must either implement a first read-only local agent slice or close with an architecture-only decision and explicit blockers. Required proof includes tenant/role boundary tests for every agent-visible tool, human approval for risky actions, audit records for tool calls and decisions, eval cases for useful next-step suggestions and refusals, fallback behavior when the model/runtime is unavailable, and proof that model configuration, provider credentials, and generated traces stay local or secret-managed unless they are deliberately documented for the repository.

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
- frontend tests for role-appropriate scope options and visible local assistant interaction history
- API smoke proof for platform, merchant, and auditor assistant endpoints, current-user history scoping, audit visibility, and smoke-scale concurrent assistant requests
- publication-boundary proof that assistant runtime configuration stays externalized and local-only artifacts stay out of Git

The API smoke suite includes concurrent assistant summary requests to catch obvious transactional or persistence regressions. It is not maximum-load or production stress certification; measuring practical load limits remains V17 production activation work or later.
