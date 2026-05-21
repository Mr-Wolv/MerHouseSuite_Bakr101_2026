package com.merhouse.dto;

import com.merhouse.entity.FulfillmentException;
import java.time.Instant;
import java.util.UUID;

public record FulfillmentExceptionResponse(
    UUID id,
    UUID allocationId,
    UUID shipmentId,
    UUID merchantId,
    String merchantName,
    UUID warehouseProviderId,
    String warehouseProviderName,
    String reasonCode,
    String description,
    String resolutionNote,
    String status,
    Instant createdAt,
    Instant resolvedAt
) {
    public static FulfillmentExceptionResponse from(FulfillmentException exception) {
        return new FulfillmentExceptionResponse(
            exception.getId(),
            exception.getAllocation() == null ? null : exception.getAllocation().getId(),
            exception.getShipment() == null ? null : exception.getShipment().getId(),
            exception.getMerchant().getId(),
            exception.getMerchant().getName(),
            exception.getWarehouseProvider().getId(),
            exception.getWarehouseProvider().getName(),
            exception.getReasonCode(),
            exception.getDescription(),
            exception.getResolutionNote(),
            exception.getStatus(),
            exception.getCreatedAt(),
            exception.getResolvedAt()
        );
    }
}
