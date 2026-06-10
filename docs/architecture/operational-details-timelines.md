# Operational Details And Timelines

Operational detail endpoints provide read models for inspecting work without stitching several API responses together in the frontend.

## API Surface

Detail endpoints live under `/api/v1/operational-details`:

- `GET /api/v1/operational-details/orders/{orderId}`
- `GET /api/v1/operational-details/inventory-items/{inventoryItemId}`
- `GET /api/v1/operational-details/inbound-stock-requests/{inboundStockRequestId}`
- `GET /api/v1/operational-details/shipments/{shipmentId}`
- `GET /api/v1/operational-details/fulfillment-allocations/{allocationId}`
- `GET /api/v1/operational-details/relationships/{relationshipId}`

Each response includes the primary record, related rows needed for inspection, and a timeline array.

## Frontend Routes

- `/orders/:orderId`
- `/inventory/items/:inventoryItemId`
- `/inbound-stock-requests/:inboundStockRequestId`
- `/shipments/:shipmentId`
- `/fulfillment-allocations/:allocationId`
- `/merchant-warehouse/relationships/:relationshipId`

## Boundaries

Admin users can inspect cross-tenant detail views. Merchant and warehouse users receive detail views only for work connected to their tenant.

Denied, missing, and stale detail routes must remain recoverable in the shared web/native route tree. Merchant inventory-detail failures return to merchant stock, merchant warehouse-work detail failures return to the merchant workspace, warehouse-operator detail failures return to the warehouse queue, and platform/support/auditor failures return to relationship governance instead of linking to merchant-only or warehouse-only routes. Recovery copy must use role-appropriate wording whenever a detail route is shared by multiple stakeholder roles.
