ALTER TABLE inventory_items
ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE fulfillment_allocations
ADD COLUMN assigned_user_id UUID REFERENCES app_users(id),
ADD COLUMN priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
ADD COLUMN scan_code VARCHAR(80),
ADD COLUMN pick_sheet_printed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX uq_fulfillment_allocations_scan_code
ON fulfillment_allocations(scan_code)
WHERE scan_code IS NOT NULL;

CREATE TABLE customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    label VARCHAR(120) NOT NULL,
    contact_name VARCHAR(160) NOT NULL,
    phone VARCHAR(80),
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_contacts_merchant ON customer_contacts(merchant_id, created_at DESC);

CREATE TABLE shipment_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    package_number INTEGER NOT NULL CHECK (package_number > 0),
    label_code VARCHAR(120) NOT NULL,
    weight_kg NUMERIC(10, 3) NOT NULL CHECK (weight_kg > 0),
    length_cm INTEGER NOT NULL CHECK (length_cm > 0),
    width_cm INTEGER NOT NULL CHECK (width_cm > 0),
    height_cm INTEGER NOT NULL CHECK (height_cm > 0),
    status VARCHAR(32) NOT NULL CHECK (status IN ('PACKED', 'HANDED_OFF', 'DELIVERED', 'FAILED', 'RETURNED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_shipment_package_number UNIQUE (shipment_id, package_number)
);

CREATE INDEX idx_shipment_packages_shipment ON shipment_packages(shipment_id, package_number);

CREATE TABLE shipment_package_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES shipment_packages(id) ON DELETE CASCADE,
    event_type VARCHAR(80) NOT NULL,
    note VARCHAR(500),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipment_package_events_package ON shipment_package_events(package_id, occurred_at DESC);

CREATE TABLE fulfillment_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID REFERENCES fulfillment_allocations(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_provider_id UUID NOT NULL REFERENCES tenants(id),
    reason_code VARCHAR(80) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    resolution_note VARCHAR(1000),
    status VARCHAR(32) NOT NULL CHECK (status IN ('OPEN', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT ck_exception_source CHECK (allocation_id IS NOT NULL OR shipment_id IS NOT NULL)
);

CREATE INDEX idx_fulfillment_exceptions_merchant ON fulfillment_exceptions(merchant_id, created_at DESC);
CREATE INDEX idx_fulfillment_exceptions_provider ON fulfillment_exceptions(warehouse_provider_id, created_at DESC);
