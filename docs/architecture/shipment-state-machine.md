# Shipment State Machine

Shipment creation and delivery are tied to fulfillment allocation state.

## Fulfillment Allocation States

Normal progression:

```text
PENDING -> PICKING -> PACKED -> SHIPPED
```

Cancellation is available before shipment:

```text
PENDING -> CANCELLED
PICKING -> CANCELLED
```

Shipment creation moves an allocation from `PACKED` to `SHIPPED`.

## Shipment States

```text
IN_TRANSIT -> DELIVERED
IN_TRANSIT -> FAILED
IN_TRANSIT -> RETURNED
```

## Shipment Creation Effects

Creating a shipment:

1. Requires allocation status `PACKED`.
2. Creates the shipment with status `IN_TRANSIT`.
3. Moves the allocation to `SHIPPED`.
4. Moves the order to `SHIPPED`.

Marking a shipment delivered moves the shipment to `DELIVERED` and the order to `DELIVERED`. Failed and returned shipments keep the order in `SHIPPED` for later operational handling.
