package com.merhouse.dto;

import java.util.UUID;

public record MerchantAuthorizedStockResponse(
    UUID relationshipId,
    UUID merchantId,
    String merchantName,
    UUID warehouseProviderId,
    String warehouseProviderName,
    UUID warehouseId,
    String warehouseName,
    UUID inventoryItemId,
    String sku,
    String itemName,
    int quantity,
    int reservedQuantity,
    int availableQuantity,
    int inboundQuantity
) {
}
