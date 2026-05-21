CREATE TABLE service_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES service_agreements(id),
    statement_id UUID NOT NULL REFERENCES service_statements(id),
    statement_line_id UUID REFERENCES service_statement_lines(id),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_provider_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('OPEN', 'RESOLVED', 'REJECTED')),
    reason VARCHAR(160) NOT NULL,
    evidence_note VARCHAR(1000),
    outcome_note VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT ck_service_dispute_parties CHECK (merchant_id <> warehouse_provider_id)
);

CREATE INDEX idx_service_disputes_merchant ON service_disputes(merchant_id, created_at DESC);
CREATE INDEX idx_service_disputes_provider ON service_disputes(warehouse_provider_id, created_at DESC);
CREATE INDEX idx_service_disputes_statement ON service_disputes(statement_id, created_at DESC);

CREATE TABLE service_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES service_agreements(id),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_provider_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('OPEN', 'RESOLVED', 'REJECTED')),
    source_type VARCHAR(40) NOT NULL CHECK (source_type IN (
        'INBOUND_STOCK_REQUEST',
        'FULFILLMENT_ALLOCATION',
        'SHIPMENT',
        'RETURN',
        'EXCEPTION',
        'MANUAL'
    )),
    source_id UUID,
    claim_type VARCHAR(80) NOT NULL,
    reason VARCHAR(160) NOT NULL,
    evidence_note VARCHAR(1000),
    outcome_note VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT ck_service_claim_parties CHECK (merchant_id <> warehouse_provider_id)
);

CREATE INDEX idx_service_claims_merchant ON service_claims(merchant_id, created_at DESC);
CREATE INDEX idx_service_claims_provider ON service_claims(warehouse_provider_id, created_at DESC);
CREATE INDEX idx_service_claims_source ON service_claims(source_type, source_id);

CREATE TABLE service_review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES service_agreements(id),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_provider_id UUID NOT NULL REFERENCES tenants(id),
    review_type VARCHAR(40) NOT NULL CHECK (review_type IN (
        'RATE_CARD_CHANGE',
        'SLA_CHANGE',
        'CREDIT',
        'PENALTY',
        'MANUAL_ADJUSTMENT',
        'DISPUTE_RESOLUTION',
        'CLAIM_OUTCOME'
    )),
    status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reason VARCHAR(160) NOT NULL,
    evidence_note VARCHAR(1000),
    outcome_note VARCHAR(1000),
    requested_by VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    CONSTRAINT ck_service_review_parties CHECK (merchant_id <> warehouse_provider_id)
);

CREATE INDEX idx_service_reviews_merchant ON service_review_requests(merchant_id, created_at DESC);
CREATE INDEX idx_service_reviews_provider ON service_review_requests(warehouse_provider_id, created_at DESC);
CREATE INDEX idx_service_reviews_agreement ON service_review_requests(agreement_id, created_at DESC);

CREATE TABLE order_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    mode VARCHAR(32) NOT NULL CHECK (mode IN ('ALL_OR_NONE', 'PARTIAL_ACCEPT')),
    status VARCHAR(32) NOT NULL CHECK (status IN ('COMPLETED', 'PARTIAL_ACCEPTED', 'FAILED')),
    source_label VARCHAR(160) NOT NULL,
    uploaded_by VARCHAR(160) NOT NULL,
    total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
    created_rows INTEGER NOT NULL CHECK (created_rows >= 0),
    rejected_rows INTEGER NOT NULL CHECK (rejected_rows >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_import_batches_merchant ON order_import_batches(merchant_id, created_at DESC);

CREATE TABLE order_import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES order_import_batches(id) ON DELETE CASCADE,
    created_order_id UUID REFERENCES customer_orders(id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('CREATED', 'REJECTED')),
    row_number INTEGER NOT NULL CHECK (row_number > 0),
    merchant_order_reference VARCHAR(120) NOT NULL,
    sku VARCHAR(80) NOT NULL,
    quantity INTEGER NOT NULL,
    customer_address VARCHAR(240) NOT NULL,
    customer_name VARCHAR(160),
    customer_phone VARCHAR(80),
    failure_reason VARCHAR(1000)
);

CREATE INDEX idx_order_import_rows_batch ON order_import_rows(batch_id, row_number);
CREATE INDEX idx_order_import_rows_created_order ON order_import_rows(created_order_id);
