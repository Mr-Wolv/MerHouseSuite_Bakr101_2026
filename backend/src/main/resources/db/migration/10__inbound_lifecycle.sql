ALTER TABLE inbound_stock_requests
DROP CONSTRAINT inbound_stock_requests_status_check;

ALTER TABLE inbound_stock_requests
ADD CONSTRAINT inbound_stock_requests_status_check
CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVING', 'RECEIVED', 'REJECTED', 'CANCELLED'));
