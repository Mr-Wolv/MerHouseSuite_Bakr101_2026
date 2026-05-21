package com.merhouse.dto;

import com.merhouse.entity.BackorderItem;
import com.merhouse.entity.BackorderStatus;
import java.time.Instant;
import java.util.UUID;

public record BackorderItemResponse(
    UUID id,
    UUID inventoryItemId,
    String sku,
    String itemName,
    int quantity,
    BackorderStatus status,
    Instant createdAt
) {
    public static BackorderItemResponse from(BackorderItem item) {
        return new BackorderItemResponse(
            item.getId(),
            item.getInventoryItem().getId(),
            item.getInventoryItem().getSku(),
            item.getInventoryItem().getName(),
            item.getQuantity(),
            item.getStatus(),
            item.getCreatedAt()
        );
    }
}
