# Partial Allocation And Backorders

Partial allocation lets MerHouse accept demand when authorized stock is short while keeping the shortage explicit.

## Flow

```text
requested quantity -> reserve available stock -> record remainder as backorder
```

## Order Outcomes

- `ALLOCATED`: all requested units were reserved.
- `PARTIALLY_ALLOCATED`: some units were reserved and some were backordered.
- `BACKORDERED`: no units were reserved.

## Data Written

- Allocated quantities are stored in `fulfillment_allocation_items`.
- Unallocated quantities are stored in `backorder_items`.

## Backorder Lifecycle

Open backorders can become `FULFILLED` or `CANCELLED`. A fulfilled backorder records that the shortage row was resolved, but it does not synthesize warehouse allocation, reserved stock, or an `ALLOCATED` order status. Cancelling an order cancels its open backorders.
