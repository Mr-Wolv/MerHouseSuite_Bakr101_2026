package com.merhouse.dto;

import com.merhouse.entity.Warehouse;
import java.util.UUID;

public record WarehouseProviderOptionResponse(
    UUID warehouseProviderId,
    String warehouseProviderName,
    UUID warehouseId,
    String warehouseName,
    String address,
    int capacity
) {
    public static WarehouseProviderOptionResponse from(Warehouse warehouse) {
        return new WarehouseProviderOptionResponse(
            warehouse.getTenant().getId(),
            warehouse.getTenant().getName(),
            warehouse.getId(),
            warehouse.getName(),
            warehouse.getAddress(),
            warehouse.getCapacity()
        );
    }
}
