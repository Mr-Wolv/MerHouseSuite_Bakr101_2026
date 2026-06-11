CREATE TABLE service_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES merchant_warehouse_relationships(id),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_provider_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('DRAFT', 'PROPOSED', 'ACTIVE', 'SUSPENDED', 'ENDED', 'SUPERSEDED')),
    title VARCHAR(160) NOT NULL,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    effective_date DATE NOT NULL,
    renewal_review_date DATE,
    cancellation_window_days INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_window_days >= 0),
    service_scopes VARCHAR(500) NOT NULL,
    service_notes VARCHAR(1000),
    supersedes_agreement_id UUID REFERENCES service_agreements(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    proposed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    CONSTRAINT uq_service_agreement_relationship_version UNIQUE (relationship_id, version_number),
    CONSTRAINT ck_service_agreement_parties CHECK (merchant_id <> warehouse_provider_id)
);

CREATE INDEX idx_service_agreements_merchant ON service_agreements(merchant_id, created_at DESC);
CREATE INDEX idx_service_agreements_provider ON service_agreements(warehouse_provider_id, created_at DESC);
CREATE INDEX idx_service_agreements_relationship ON service_agreements(relationship_id, version_number DESC);

CREATE TABLE reference_rate_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL UNIQUE REFERENCES service_agreements(id) ON DELETE CASCADE,
    inbound_receiving_fee_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (inbound_receiving_fee_per_unit >= 0),
    storage_fee_per_unit_per_day NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (storage_fee_per_unit_per_day >= 0),
    free_storage_days INTEGER NOT NULL DEFAULT 0 CHECK (free_storage_days >= 0),
    minimum_monthly_service_charge NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (minimum_monthly_service_charge >= 0),
    pick_fee_per_order NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (pick_fee_per_order >= 0),
    pick_fee_per_line NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (pick_fee_per_line >= 0),
    pack_fee_per_order NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (pack_fee_per_order >= 0),
    packaging_fee_per_package NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (packaging_fee_per_package >= 0),
    shipment_handling_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (shipment_handling_fee >= 0),
    return_restock_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (return_restock_fee >= 0),
    exception_handling_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (exception_handling_fee >= 0),
    coordination_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (coordination_fee_percent >= 0),
    fixed_coordination_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (fixed_coordination_fee >= 0),
    carrier_pass_through_note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL UNIQUE REFERENCES service_agreements(id) ON DELETE CASCADE,
    receiving_sla_hours INTEGER NOT NULL CHECK (receiving_sla_hours > 0),
    pick_pack_sla_hours INTEGER NOT NULL CHECK (pick_pack_sla_hours > 0),
    shipment_handoff_sla_hours INTEGER NOT NULL CHECK (shipment_handoff_sla_hours > 0),
    exception_response_sla_hours INTEGER NOT NULL CHECK (exception_response_sla_hours > 0),
    pause_rule_notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE service_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES service_agreements(id),
    merchant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_provider_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('DRAFT', 'FINALIZED', 'MARKED_SETTLED', 'DISPUTED', 'CANCELLED')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    coordination_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    adjustment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(120),
    note VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at TIMESTAMPTZ,
    settlement_marked_at TIMESTAMPTZ,
    CONSTRAINT ck_service_statement_period CHECK (period_end >= period_start),
    CONSTRAINT ck_service_statement_due_date CHECK (due_date >= period_end),
    CONSTRAINT ck_service_statement_parties CHECK (merchant_id <> warehouse_provider_id)
);

CREATE UNIQUE INDEX uq_service_statements_idempotency_key
ON service_statements(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_service_statements_merchant ON service_statements(merchant_id, created_at DESC);
CREATE INDEX idx_service_statements_provider ON service_statements(warehouse_provider_id, created_at DESC);
CREATE INDEX idx_service_statements_agreement ON service_statements(agreement_id, created_at DESC);

CREATE TABLE service_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID NOT NULL REFERENCES service_statements(id) ON DELETE CASCADE,
    line_type VARCHAR(40) NOT NULL CHECK (line_type IN (
        'RECEIVING',
        'STORAGE',
        'PICK_PACK',
        'PACKAGING',
        'SHIPMENT_HANDOFF',
        'RETURN_RESTOCK',
        'EXCEPTION_HANDLING',
        'COORDINATION_FEE',
        'CREDIT',
        'PENALTY',
        'MANUAL_ADJUSTMENT'
    )),
    source_type VARCHAR(40) NOT NULL CHECK (source_type IN (
        'INBOUND_STOCK_REQUEST',
        'FULFILLMENT_ALLOCATION',
        'SHIPMENT',
        'RETURN',
        'EXCEPTION',
        'MANUAL'
    )),
    source_id UUID,
    description VARCHAR(240) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_amount NUMERIC(12, 2) NOT NULL CHECK (unit_amount >= 0),
    line_amount NUMERIC(12, 2) NOT NULL CHECK (line_amount >= 0)
);

CREATE INDEX idx_service_statement_lines_statement ON service_statement_lines(statement_id);
CREATE INDEX idx_service_statement_lines_source ON service_statement_lines(source_type, source_id);
