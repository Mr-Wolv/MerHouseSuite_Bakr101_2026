package com.merhouse.dto;

import com.merhouse.entity.FulfillmentAllocationItem;
import java.util.UUID;

public record AllocationItemResponse(
    UUID inventoryItemId,
    String sku,
    String itemName,
    int quantity
) {
    public static AllocationItemResponse from(FulfillmentAllocationItem item) {
        return new AllocationItemResponse(
            item.getInventoryItem().getId(),
            item.getInventoryItem().getSku(),
            item.getInventoryItem().getName(),
            item.getQuantity()
        );
    }
}
