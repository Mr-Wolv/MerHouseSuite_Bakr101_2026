ALTER TABLE tenants
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN suspension_reason VARCHAR(1000),
    ADD COLUMN suspended_at TIMESTAMPTZ;

ALTER TABLE merchant_warehouse_relationships
    ADD COLUMN suspended_at TIMESTAMPTZ,
    ADD COLUMN ended_at TIMESTAMPTZ,
    ADD COLUMN status_reason VARCHAR(1000);

ALTER TABLE access_requests
    ADD COLUMN converted_tenant_id UUID REFERENCES tenants(id),
    ADD COLUMN converted_user_id UUID REFERENCES app_users(id),
    ADD COLUMN converted_at TIMESTAMPTZ;

ALTER TABLE app_users
    DROP CONSTRAINT IF EXISTS app_users_role_check,
    ADD CONSTRAINT app_users_role_check CHECK (role IN (
        'OWNER',
        'ADMIN',
        'SUPPORT_ADMIN',
        'AUDITOR',
        'MERCHANT',
        'WAREHOUSE_OPERATOR'
    ));

ALTER TABLE outbox_events
    DROP CONSTRAINT IF EXISTS outbox_events_status_check,
    ADD CONSTRAINT outbox_events_status_check CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED', 'DEAD_LETTER'));

CREATE TABLE admin_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES app_users(id),
    action VARCHAR(120) NOT NULL,
    aggregate_type VARCHAR(120) NOT NULL,
    aggregate_id UUID NOT NULL,
    reason VARCHAR(1000),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_events_created ON admin_audit_events(created_at DESC);
CREATE INDEX idx_admin_audit_events_actor ON admin_audit_events(actor_user_id, created_at DESC);
CREATE INDEX idx_admin_audit_events_aggregate ON admin_audit_events(aggregate_type, aggregate_id, created_at DESC);
CREATE INDEX idx_tenants_active ON tenants(active, type);

UPDATE app_users
SET role = 'OWNER'
WHERE id = (
    SELECT id
    FROM app_users
    WHERE role = 'ADMIN'
    ORDER BY created_at ASC, id ASC
    LIMIT 1
)
  AND NOT EXISTS (
    SELECT 1
    FROM app_users
    WHERE role = 'OWNER'
);
