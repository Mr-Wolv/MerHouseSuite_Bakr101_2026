package com.merhouse.dto;

import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import java.time.Instant;
import java.util.UUID;

public record MerchantWarehouseRelationshipResponse(
    UUID id,
    UUID merchantId,
    String merchantName,
    UUID warehouseProviderId,
    String warehouseProviderName,
    MerchantWarehouseRelationshipStatus status,
    String serviceNotes,
    Instant createdAt,
    Instant approvedAt,
    Instant suspendedAt,
    Instant endedAt,
    String statusReason
) {
    public static MerchantWarehouseRelationshipResponse from(MerchantWarehouseRelationship relationship) {
        return new MerchantWarehouseRelationshipResponse(
            relationship.getId(),
            relationship.getMerchant().getId(),
            relationship.getMerchant().getName(),
            relationship.getWarehouseProvider().getId(),
            relationship.getWarehouseProvider().getName(),
            relationship.getStatus(),
            relationship.getServiceNotes(),
            relationship.getCreatedAt(),
            relationship.getApprovedAt(),
            relationship.getSuspendedAt(),
            relationship.getEndedAt(),
            relationship.getStatusReason()
        );
    }
}
