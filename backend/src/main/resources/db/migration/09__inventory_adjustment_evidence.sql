ALTER TABLE inventory_audit_logs
ADD COLUMN reason_code VARCHAR(80),
ADD COLUMN reason_note VARCHAR(500),
ADD COLUMN actor_user_id UUID REFERENCES app_users(id);

ALTER TABLE inventory_audit_logs
DROP CONSTRAINT inventory_audit_logs_action_check;

ALTER TABLE inventory_audit_logs
ADD CONSTRAINT inventory_audit_logs_action_check
CHECK (action IN ('STOCK_ADDED', 'STOCK_REMOVED', 'STOCK_RESERVED', 'STOCK_RELEASED', 'STOCK_RECEIVED', 'STOCK_ADJUSTED'));
