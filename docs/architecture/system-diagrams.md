# System Diagrams

This page links the public system diagram preview and summarizes the main architectural relationships in MerHouse.

## Preview

- [System diagrams HTML preview](system-diagrams.html)

## Context Map

```text
Platform
  -> Tenants
  -> Users
  -> Access requests
  -> Audit events
  -> Outbox visibility

Merchant
  -> Inventory items
  -> Customer orders
  -> Customer contacts
  -> Order imports
  -> Service records

Warehouse provider
  -> Warehouses
  -> Warehouse inventory
  -> Inbound receiving
  -> Fulfillment allocations
  -> Shipments
  -> Exceptions

Merchant-warehouse relationship
  -> Authorized stock
  -> Inbound stock requests
  -> Relationship-aware allocation
  -> Service accountability
```

## Persistence Highlights

- `tenants` anchors platform, merchant, and warehouse-provider ownership.
- `app_users` connects users to tenants and roles.
- `merchant_warehouse_relationships` connects merchants and warehouse providers.
- `inventory_items` belongs to merchants.
- `warehouses` belongs to warehouse providers.
- `warehouse_inventory` stores provider stock by warehouse and merchant-owned item.
- `customer_orders`, `order_items`, `fulfillment_allocations`, `fulfillment_allocation_items`, `backorder_items`, and `shipments` form the order fulfillment loop.
- `inbound_stock_requests` records merchant-submitted stock moving into provider warehouses.
- `service_agreements`, `service_statements`, `service_disputes`, `service_claims`, and `service_review_requests` form the service accountability loop.
- `outbox_events` and `carrier_dispatches` support reliable side-effect processing.
