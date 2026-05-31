CREATE TABLE assistant_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES app_users(id),
    actor_tenant_id UUID NOT NULL REFERENCES tenants(id),
    scope VARCHAR(48) NOT NULL CHECK (scope IN ('PLATFORM_OVERVIEW', 'MERCHANT_OPERATIONS', 'WAREHOUSE_OPERATIONS')),
    response_type VARCHAR(32) NOT NULL CHECK (response_type IN ('SUMMARY', 'SUGGESTION', 'REFUSAL')),
    action_status VARCHAR(32) NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (action_status IN ('NOT_APPLICABLE', 'PENDING', 'ACCEPTED', 'REJECTED')),
    target_tenant_id UUID,
    request_text VARCHAR(2000) NOT NULL,
    response_text VARCHAR(4000) NOT NULL,
    prototype_local BOOLEAN NOT NULL DEFAULT TRUE,
    decided_by_user_id UUID REFERENCES app_users(id),
    decision_note VARCHAR(1000),
    decided_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_interactions_actor_created
    ON assistant_interactions(actor_user_id, created_at DESC);

CREATE INDEX idx_assistant_interactions_scope_created
    ON assistant_interactions(scope, created_at DESC);

CREATE INDEX idx_assistant_interactions_action_status
    ON assistant_interactions(action_status, created_at DESC);
