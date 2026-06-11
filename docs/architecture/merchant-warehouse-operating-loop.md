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

Warehouse operators can activate requested relationships for their own warehouse-provider tenant. Platform suspend, reactivate, and end actions are owner/admin governance controls; support-admin and auditor users can review relationship lifecycle evidence without mutation controls.

Merchant-facing text fields normalize copied whitespace before validation and storage. SKU, item name, service notes, inbound reference and note, customer address, reusable contact fields, and order-import row text trim surrounding spaces; quantity fields and selected ids remain structured values. Inbound stock quantities, single-order quantities, draft order line quantities, and pasted order-import row quantities must be positive whole numbers before the shared web/native route submits to the integer-based backend contract, so bad copied or typed quantities cannot silently become malformed orders or inbound requests.

Warehouse-facing evidence fields also normalize copied whitespace before validation and storage. Shipment carrier, tracking number, packing note, allocation scan code, stock-adjustment reason code and note, fulfillment-exception reason and description, inbound receiving notes, and rejection reasons trim surrounding spaces; quantities, dimensions, priorities, statuses, and ids remain structured values. Shared receiving controls require whole-number received and damaged quantities before posting to the integer-based backend contract. Shared shipment controls require whole-number package count and package dimensions before posting package evidence, while package weight remains decimal-capable.

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

Receiving records accepted, damaged, and short quantities. Only received quantity becomes available warehouse inventory. The shared warehouse console used by web and Android exposes received quantity, damaged quantity, and receiving-note evidence before posting receipt, so operators can record partial or damaged inbound arrivals instead of being forced into a full clean receipt.

## Fulfillment Loop

1. Merchant creates products and order demand.
2. Merchant requests or uses an active warehouse relationship.
3. Merchant submits inbound stock for a provider warehouse.
4. Warehouse provider approves, receives, or rejects inbound stock.
5. Orders allocate against authorized stock.
6. Warehouse operators pick, pack, ship, and report exceptions.
7. Merchant and platform users can inspect operational detail, notifications, attention signals, and service-accountability records.
8. Merchant and warehouse parties can record service-agreement terms, propose or accept those terms, and request service review after an agreement is active.

Failed and returned shipment statuses are delivery-state evidence inside this local fulfillment loop. They do not represent a full customer RMA workflow with intake, inspection, refund, disposition, or accounting ownership. Those workflows are future expansion unless the roadmap deliberately pulls them forward.

## Current Implementation

The workflow is implemented through:

- `merchant_warehouse_relationships`
- `inbound_stock_requests`
- merchant-safe warehouse provider discovery
- authorized-stock projections
- relationship-aware allocation
- bounded dense order queues with explicit "show more" controls when more than the first page is present
- inbound receiving evidence with received, damaged, and note fields plus rejection actions
- bounded fulfillment queue context for provider work
- bounded dense shipment history with explicit "show more" controls for terminal delivery evidence
- connected local notification alerts for relationship, inbound, allocation, shipment, exception, service-accountability, and outbox handoffs
- attention-first dashboard signals for the role that owns the next action or review
- service-agreement setup, proposal, and acceptance tied to active relationships
