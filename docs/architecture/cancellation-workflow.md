# Cancellation Workflow

Order cancellation restores operational state while the order is still reversible.

## Cancellable States

```text
CREATED -> CANCELLED
ALLOCATED -> CANCELLED
PARTIALLY_ALLOCATED -> CANCELLED
BACKORDERED -> CANCELLED
```

Shipped and delivered orders are not cancelled by this workflow.

## Cancellation Effects

Cancelling an allocated or partially allocated order:

1. Locks the relevant warehouse inventory rows.
2. Releases reserved stock.
3. Writes inventory audit rows.
4. Marks the fulfillment allocation `CANCELLED`.
5. Cancels open backorder items on the order.
6. Marks the order `CANCELLED`.

Cancelling a fully backordered order cancels open backorder items and marks the order `CANCELLED`; no stock is released because no inventory was reserved.
