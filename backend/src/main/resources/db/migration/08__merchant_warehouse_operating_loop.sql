CREATE TABLE merchant_warehouse_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_provider_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('REQUESTED', 'ACTIVE', 'SUSPENDED', 'ENDED')),
    service_notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_merchant_warehouse_relationship UNIQUE (merchant_id, warehouse_provider_id),
    CONSTRAINT ck_relationship_distinct_tenants CHECK (merchant_id <> warehouse_provider_id)
);

CREATE INDEX idx_merchant_warehouse_relationships_merchant ON merchant_warehouse_relationships(merchant_id);
CREATE INDEX idx_merchant_warehouse_relationships_provider ON merchant_warehouse_relationships(warehouse_provider_id);
CREATE INDEX idx_merchant_warehouse_relationships_status ON merchant_warehouse_relationships(status);

CREATE TABLE inbound_stock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES merchant_warehouse_relationships(id),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_provider_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
    received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    damaged_quantity INTEGER NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
    status VARCHAR(32) NOT NULL CHECK (status IN ('SUBMITTED', 'RECEIVING', 'RECEIVED', 'REJECTED', 'CANCELLED')),
    merchant_reference VARCHAR(160),
    merchant_note VARCHAR(1000),
    receiving_note VARCHAR(1000),
    rejection_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_at TIMESTAMPTZ,
    CONSTRAINT ck_inbound_received_not_above_requested CHECK (received_quantity + damaged_quantity <= requested_quantity)
);

CREATE INDEX idx_inbound_stock_requests_merchant ON inbound_stock_requests(merchant_id, created_at DESC);
CREATE INDEX idx_inbound_stock_requests_provider ON inbound_stock_requests(warehouse_provider_id, created_at DESC);
CREATE INDEX idx_inbound_stock_requests_warehouse ON inbound_stock_requests(warehouse_id, created_at DESC);
CREATE INDEX idx_inbound_stock_requests_status ON inbound_stock_requests(status);

ALTER TABLE inventory_audit_logs
DROP CONSTRAINT inventory_audit_logs_action_check;

ALTER TABLE inventory_audit_logs
ADD CONSTRAINT inventory_audit_logs_action_check
CHECK (action IN ('STOCK_ADDED', 'STOCK_REMOVED', 'STOCK_RESERVED', 'STOCK_RELEASED', 'STOCK_RECEIVED'));
