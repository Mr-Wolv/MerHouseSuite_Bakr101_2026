package com.merhouse.dto;

import com.merhouse.entity.OrderItem;
import java.util.UUID;

public record OrderItemResponse(
    UUID id,
    UUID inventoryItemId,
    String sku,
    String itemName,
    int quantity
) {
    public static OrderItemResponse from(OrderItem item) {
        return new OrderItemResponse(
            item.getId(),
            item.getInventoryItem().getId(),
            item.getInventoryItem().getSku(),
            item.getInventoryItem().getName(),
            item.getQuantity()
        );
    }
}
