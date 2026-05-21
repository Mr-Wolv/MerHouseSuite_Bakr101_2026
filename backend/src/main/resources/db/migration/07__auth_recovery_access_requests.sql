CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id),
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

CREATE TABLE access_requests (
    id UUID PRIMARY KEY,
    organization_name VARCHAR(160) NOT NULL,
    requester_email VARCHAR(255) NOT NULL,
    requested_role VARCHAR(48) NOT NULL,
    notes VARCHAR(1000),
    status VARCHAR(32) NOT NULL,
    reviewed_by_user_id UUID REFERENCES app_users(id),
    review_note VARCHAR(1000),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_requests_status ON access_requests(status);
CREATE INDEX idx_access_requests_requester_email ON access_requests(requester_email);
