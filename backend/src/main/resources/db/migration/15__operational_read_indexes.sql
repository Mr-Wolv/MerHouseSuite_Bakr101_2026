CREATE INDEX idx_customer_orders_merchant_created ON customer_orders(merchant_id, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_inventory_item ON order_items(inventory_item_id);
CREATE INDEX idx_fulfillment_allocations_order ON fulfillment_allocations(order_id);
CREATE INDEX idx_fulfillment_allocations_warehouse_created ON fulfillment_allocations(warehouse_id, created_at DESC);
CREATE INDEX idx_fulfillment_allocations_status ON fulfillment_allocations(status);
CREATE INDEX idx_shipments_status_created ON shipments(status, created_at DESC);
CREATE INDEX idx_outbox_events_aggregate_created ON outbox_events(aggregate_id, created_at DESC);
