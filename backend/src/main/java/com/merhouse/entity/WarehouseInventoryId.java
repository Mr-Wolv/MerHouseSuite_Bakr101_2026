package com.merhouse.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class WarehouseInventoryId implements Serializable {
    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    @Column(name = "inventory_item_id", nullable = false)
    private UUID inventoryItemId;

    protected WarehouseInventoryId() {
    }

    public WarehouseInventoryId(UUID warehouseId, UUID inventoryItemId) {
        this.warehouseId = warehouseId;
        this.inventoryItemId = inventoryItemId;
    }

    public UUID getWarehouseId() {
        return warehouseId;
    }

    public UUID getInventoryItemId() {
        return inventoryItemId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof WarehouseInventoryId that)) {
            return false;
        }
        return Objects.equals(warehouseId, that.warehouseId)
            && Objects.equals(inventoryItemId, that.inventoryItemId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(warehouseId, inventoryItemId);
    }
}
