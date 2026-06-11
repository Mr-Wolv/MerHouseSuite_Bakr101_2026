package com.merhouse.dto;

import com.merhouse.entity.WarehouseInventory;
import java.time.Instant;
import java.util.UUID;

public record WarehouseInventoryResponse(
    UUID warehouseId,
    UUID inventoryItemId,
    String sku,
    String itemName,
    int quantity,
    int reservedQuantity,
    int availableQuantity,
    Long version,
    Instant updatedAt
) {
    public static WarehouseInventoryResponse from(WarehouseInventory inventory) {
        return new WarehouseInventoryResponse(
            inventory.getWarehouse().getId(),
            inventory.getInventoryItem().getId(),
            inventory.getInventoryItem().getSku(),
            inventory.getInventoryItem().getName(),
            inventory.getQuantity(),
            inventory.getReservedQuantity(),
            inventory.getQuantity() - inventory.getReservedQuantity(),
            inventory.getVersion(),
            inventory.getUpdatedAt()
        );
    }
}
