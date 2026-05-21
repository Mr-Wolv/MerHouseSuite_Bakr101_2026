# Inventory Locking

Warehouse inventory is protected by database constraints, transactional row locking, and optimistic locking.

## Inventory Invariant

```text
available_quantity = quantity - reserved_quantity
```

## Protection Layers

1. Database constraints keep impossible values out:
   - `quantity >= 0`
   - `reserved_quantity >= 0`
   - `reserved_quantity <= quantity`
2. Reservation and release operations lock the relevant `(warehouse_id, inventory_item_id)` rows.
3. `warehouse_inventory.version` provides an optimistic-locking backstop for stale writes.

## Operational Behavior

- Allocation reserves only available stock.
- Cancellation releases reserved inventory.
- Stock removal consumes available stock only.
- Receiving inbound stock increases provider warehouse inventory for the related merchant item.
