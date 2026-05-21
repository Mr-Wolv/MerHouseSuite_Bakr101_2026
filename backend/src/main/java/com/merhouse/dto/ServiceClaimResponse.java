package com.merhouse.dto;

import com.merhouse.entity.ServiceClaim;
import com.merhouse.entity.ServiceClaimStatus;
import com.merhouse.entity.ServiceSourceType;
import java.time.Instant;
import java.util.UUID;

public record ServiceClaimResponse(
    UUID id,
    UUID agreementId,
    UUID merchantId,
    UUID warehouseProviderId,
    ServiceClaimStatus status,
    ServiceSourceType sourceType,
    UUID sourceId,
    String claimType,
    String reason,
    String evidenceNote,
    String outcomeNote,
    Instant createdAt,
    Instant resolvedAt
) {
    public static ServiceClaimResponse from(ServiceClaim claim) {
        return new ServiceClaimResponse(
            claim.getId(),
            claim.getAgreement().getId(),
            claim.getMerchant().getId(),
            claim.getWarehouseProvider().getId(),
            claim.getStatus(),
            claim.getSourceType(),
            claim.getSourceId(),
            claim.getClaimType(),
            claim.getReason(),
            claim.getEvidenceNote(),
            claim.getOutcomeNote(),
            claim.getCreatedAt(),
            claim.getResolvedAt()
        );
    }
}
