ALTER TABLE customer_orders
DROP CONSTRAINT customer_orders_status_check;

ALTER TABLE customer_orders
ADD CONSTRAINT customer_orders_status_check
CHECK (status IN ('CREATED', 'ALLOCATED', 'PARTIALLY_ALLOCATED', 'BACKORDERED', 'SHIPPED', 'DELIVERED', 'CANCELLED'));

CREATE TABLE fulfillment_allocation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES fulfillment_allocations(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE backorder_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FULFILLED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(160) NOT NULL,
    method VARCHAR(12) NOT NULL,
    request_path VARCHAR(255) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_idempotency_records_key UNIQUE (idempotency_key)
);

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(120) NOT NULL,
    aggregate_type VARCHAR(120) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    last_error TEXT
);

CREATE INDEX idx_fulfillment_allocation_items_allocation ON fulfillment_allocation_items(allocation_id);
CREATE INDEX idx_backorder_items_order ON backorder_items(order_id);
CREATE INDEX idx_outbox_events_status_created ON outbox_events(status, created_at);
