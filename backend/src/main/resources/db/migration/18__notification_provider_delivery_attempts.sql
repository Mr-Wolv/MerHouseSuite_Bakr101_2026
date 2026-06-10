ALTER TABLE notification_deliveries
    ADD COLUMN provider_message_id varchar(160),
    ADD COLUMN provider_error varchar(1000),
    ADD COLUMN provider_attempted_at timestamptz,
    ADD COLUMN provider_sent_at timestamptz,
    ADD COLUMN provider_failed_at timestamptz,
    ADD COLUMN provider_retry_count integer NOT NULL DEFAULT 0;

CREATE INDEX idx_notification_deliveries_provider_status
    ON notification_deliveries(provider_status, provider_attempted_at DESC);
