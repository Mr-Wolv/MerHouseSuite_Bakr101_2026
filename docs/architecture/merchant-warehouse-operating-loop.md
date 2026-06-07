# Merchant-Warehouse Operating Loop

MerHouse centers fulfillment work on an explicit merchant-to-warehouse-provider relationship.

## Relationship Model

A merchant-warehouse relationship connects one merchant tenant to one warehouse-provider tenant.

Relationship states:

- `REQUESTED`
- `ACTIVE`
- `SUSPENDED`
- `ENDED`

Only active relationships can be used for inbound stock and allocation.

## Inbound Stock

Inbound stock requests represent merchant-owned goods moving into a provider warehouse.

Inbound request states:

- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `RECEIVING`
- `RECEIVED`
- `REJECTED`
- `CANCELLED`

Receiving records accepted, damaged, and short quantities. Only received quantity becomes available warehouse inventory.

## Fulfillment Loop

1. Merchant creates products and order demand.
2. Merchant requests or uses an active warehouse relationship.
3. Merchant submits inbound stock for a provider warehouse.
4. Warehouse provider approves, receives, or rejects inbound stock.
5. Orders allocate against authorized stock.
6. Warehouse operators pick, pack, ship, and report exceptions.
7. Merchant and platform users can inspect operational detail, notifications, attention signals, and service-accountability records.
8. Merchant and warehouse parties can record service-agreement terms, propose or accept those terms, and request service review after an agreement is active.

## Current Implementation

The workflow is implemented through:

- `merchant_warehouse_relationships`
- `inbound_stock_requests`
- merchant-safe warehouse provider discovery
- authorized-stock projections
- relationship-aware allocation
- inbound receiving and rejection actions
- fulfillment queue context for provider work
- connected local notification alerts for relationship, inbound, allocation, shipment, exception, service-accountability, and outbox handoffs
- attention-first dashboard signals for the role that owns the next action or review
- service-agreement setup, proposal, and acceptance tied to active relationships
