package com.merhouse.dto;

import com.merhouse.entity.InventoryItem;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record InventoryItemResponse(
    UUID id,
    UUID merchantId,
    String sku,
    String name,
    Map<String, Object> attributes,
    boolean archived,
    Instant createdAt
) {
    public static InventoryItemResponse from(InventoryItem item) {
        return new InventoryItemResponse(
            item.getId(),
            item.getMerchant().getId(),
            item.getSku(),
            item.getName(),
            item.getAttributes(),
            item.isArchived(),
            item.getCreatedAt()
        );
    }
}
