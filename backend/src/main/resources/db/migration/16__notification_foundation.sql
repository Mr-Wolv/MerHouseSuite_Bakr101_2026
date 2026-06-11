CREATE TABLE notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id),
    topic varchar(48) NOT NULL,
    channel varchar(32) NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_notification_preferences_user_topic_channel UNIQUE (user_id, topic, channel)
);

CREATE TABLE notification_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id uuid NOT NULL REFERENCES app_users(id),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    topic varchar(48) NOT NULL,
    channel varchar(32) NOT NULL,
    status varchar(32) NOT NULL,
    delivery_stage varchar(48) NOT NULL DEFAULT 'LOCAL_RECORDED',
    provider_status varchar(48) NOT NULL DEFAULT 'NOT_CONFIGURED',
    title varchar(160) NOT NULL,
    body varchar(1000) NOT NULL,
    source_type varchar(80),
    source_id uuid,
    prototype_local boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_deliveries_recipient_created ON notification_deliveries(recipient_user_id, created_at DESC);
CREATE INDEX idx_notification_deliveries_tenant_created ON notification_deliveries(tenant_id, created_at DESC);
