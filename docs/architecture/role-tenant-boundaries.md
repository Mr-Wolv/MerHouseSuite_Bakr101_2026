# Role And Tenant Boundaries

MerHouse separates platform, merchant, and warehouse-provider work through roles and tenant ownership.

## Roles

- `OWNER`: platform owner.
- `ADMIN`: platform operator.
- `SUPPORT_ADMIN`: platform support operator.
- `AUDITOR`: read-only platform reviewer.
- `MERCHANT`: merchant tenant user.
- `WAREHOUSE_OPERATOR`: warehouse-provider tenant user.

## Tenant Types

- `PLATFORM`: platform administration.
- `MERCHANT`: merchant-owned products, inventory expectations, orders, and service decisions.
- `WAREHOUSE_PROVIDER`: warehouse locations, receiving, storage, fulfillment execution, shipment evidence, and exceptions.

## Boundary Model

Platform roles work across tenants according to their authority level. Merchant users work with their tenant’s products, orders, inbound stock requests, service records, and authorized warehouse stock. Warehouse operators work with warehouses, inventory, fulfillment allocations, inbound receiving, shipments, and exceptions for their provider tenant.

The backend service layer enforces tenant boundaries. Frontend role gates shape navigation and screen access.

## Merchant-Warehouse Authorization

Allocation only uses stock from warehouse providers with an active relationship to the merchant that owns the inventory item. This keeps the fulfillment boundary explicit even when several providers hold stock for different merchants.
