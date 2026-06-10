# Allocation Strategy

Allocation turns merchant order demand into reserved warehouse stock, fulfillment allocation rows, and backorder rows.

## Relationship-Aware Stock

MerHouse only allocates stock from warehouse providers that have an active merchant-warehouse relationship with the merchant that owns the ordered item. A warehouse inventory row by itself is not enough to authorize fulfillment for a merchant.

## Allocation Flow

```text
Order lines
  -> find available authorized stock
  -> reserve what can be fulfilled
  -> create fulfillment allocation rows
  -> create backorder rows for the remainder
```

## Order Outcomes

- `ALLOCATED`: every requested unit was reserved.
- `PARTIALLY_ALLOCATED`: some units were reserved and the rest were backordered.
- `BACKORDERED`: no units were available.

## Data Written

- Allocated quantities are stored in `fulfillment_allocation_items`.
- Backordered quantities are stored in `backorder_items`.
- Reserved stock is reflected on `warehouse_inventory.reserved_quantity`.

## Related Mechanics

Cancelling allocated work releases reserved stock and cancels open backorders.

Marking a backorder row `FULFILLED` closes that shortage evidence and emits a backorder event. It does not create reserved stock, fulfillment allocation rows, or an `ALLOCATED` order status by itself; `ALLOCATED` remains reserved warehouse work.
