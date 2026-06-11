ALTER TABLE outbox_events
ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX idx_outbox_events_retry
ON outbox_events(status, next_attempt_at, created_at);

CREATE TABLE carrier_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_event_id UUID NOT NULL UNIQUE REFERENCES outbox_events(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    event_type VARCHAR(120) NOT NULL,
    carrier VARCHAR(120),
    tracking_number VARCHAR(160),
    status VARCHAR(32) NOT NULL DEFAULT 'DISPATCHED' CHECK (status IN ('DISPATCHED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
    external_reference VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_carrier_dispatches_shipment ON carrier_dispatches(shipment_id);
