CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('MERCHANT', 'WAREHOUSE_PROVIDER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(48) NOT NULL CHECK (role IN ('ADMIN', 'MERCHANT', 'WAREHOUSE_OPERATOR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(160) NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    capacity INTEGER NOT NULL CHECK (capacity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    sku VARCHAR(120) NOT NULL,
    name VARCHAR(200) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_inventory_items_merchant_sku UNIQUE (merchant_id, sku)
);

CREATE TABLE warehouse_inventory (
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (warehouse_id, inventory_item_id),
    CONSTRAINT ck_reserved_not_above_quantity CHECK (reserved_quantity <= quantity)
);

CREATE TABLE customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    customer_address TEXT NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('CREATED', 'ALLOCATED', 'SHIPPED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE fulfillment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'PICKING', 'PACKED', 'SHIPPED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL UNIQUE REFERENCES fulfillment_allocations(id) ON DELETE CASCADE,
    carrier VARCHAR(120) NOT NULL,
    tracking_number VARCHAR(160),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    action VARCHAR(48) NOT NULL CHECK (action IN ('STOCK_ADDED', 'STOCK_REMOVED', 'STOCK_RESERVED', 'STOCK_RELEASED')),
    before_quantity INTEGER NOT NULL,
    after_quantity INTEGER NOT NULL,
    before_reserved_quantity INTEGER NOT NULL,
    after_reserved_quantity INTEGER NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warehouses_tenant_id ON warehouses(tenant_id);
CREATE INDEX idx_inventory_items_merchant_id ON inventory_items(merchant_id);
CREATE INDEX idx_warehouse_inventory_item_id ON warehouse_inventory(inventory_item_id);
CREATE INDEX idx_inventory_audit_logs_item ON inventory_audit_logs(inventory_item_id, occurred_at DESC);
