package com.merhouse.dto;

import com.merhouse.entity.InboundStockRequest;
import com.merhouse.entity.InboundStockRequestStatus;
import java.time.Instant;
import java.util.UUID;

public record InboundStockRequestResponse(
    UUID id,
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
    int requestedQuantity,
    int receivedQuantity,
    int damagedQuantity,
    int shortageQuantity,
    InboundStockRequestStatus status,
    String merchantReference,
    String merchantNote,
    String receivingNote,
    String rejectionReason,
    Instant createdAt,
    Instant updatedAt,
    Instant receivedAt
) {
    public static InboundStockRequestResponse from(InboundStockRequest request) {
        return new InboundStockRequestResponse(
            request.getId(),
            request.getRelationship().getId(),
            request.getMerchant().getId(),
            request.getMerchant().getName(),
            request.getWarehouseProvider().getId(),
            request.getWarehouseProvider().getName(),
            request.getWarehouse().getId(),
            request.getWarehouse().getName(),
            request.getInventoryItem().getId(),
            request.getInventoryItem().getSku(),
            request.getInventoryItem().getName(),
            request.getRequestedQuantity(),
            request.getReceivedQuantity(),
            request.getDamagedQuantity(),
            request.getRequestedQuantity() - request.getReceivedQuantity() - request.getDamagedQuantity(),
            request.getStatus(),
            request.getMerchantReference(),
            request.getMerchantNote(),
            request.getReceivingNote(),
            request.getRejectionReason(),
            request.getCreatedAt(),
            request.getUpdatedAt(),
            request.getReceivedAt()
        );
    }
}
