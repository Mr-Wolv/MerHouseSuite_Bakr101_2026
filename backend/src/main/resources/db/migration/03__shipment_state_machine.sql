ALTER TABLE customer_orders
DROP CONSTRAINT customer_orders_status_check;

ALTER TABLE customer_orders
ADD CONSTRAINT customer_orders_status_check
CHECK (status IN ('CREATED', 'ALLOCATED', 'SHIPPED', 'DELIVERED', 'CANCELLED'));

ALTER TABLE shipments
ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'IN_TRANSIT';

ALTER TABLE shipments
ADD CONSTRAINT shipments_status_check
CHECK (status IN ('IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED'));
