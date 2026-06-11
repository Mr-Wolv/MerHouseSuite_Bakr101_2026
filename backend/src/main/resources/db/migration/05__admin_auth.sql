ALTER TABLE app_users
ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX idx_app_users_tenant_id ON app_users(tenant_id);
CREATE INDEX idx_app_users_role ON app_users(role);
