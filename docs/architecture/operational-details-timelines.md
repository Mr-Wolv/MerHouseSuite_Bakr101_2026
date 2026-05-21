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
