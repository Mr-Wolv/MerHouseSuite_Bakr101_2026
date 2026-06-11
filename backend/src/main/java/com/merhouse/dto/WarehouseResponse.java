package com.merhouse.dto;

import com.merhouse.entity.Warehouse;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record WarehouseResponse(
    UUID id,
    UUID tenantId,
    String name,
    String address,
    BigDecimal latitude,
    BigDecimal longitude,
    int capacity,
    Instant createdAt
) {
    public static WarehouseResponse from(Warehouse warehouse) {
        return new WarehouseResponse(
            warehouse.getId(),
            warehouse.getTenant().getId(),
            warehouse.getName(),
            warehouse.getAddress(),
            warehouse.getLatitude(),
            warehouse.getLongitude(),
            warehouse.getCapacity(),
            warehouse.getCreatedAt()
        );
    }
}
