package com.merhouse.dto;

import com.merhouse.entity.ServiceReviewRequest;
import com.merhouse.entity.ServiceReviewStatus;
import com.merhouse.entity.ServiceReviewType;
import java.time.Instant;
import java.util.UUID;

public record ServiceReviewResponse(
    UUID id,
    UUID agreementId,
    UUID merchantId,
    UUID warehouseProviderId,
    ServiceReviewType reviewType,
    ServiceReviewStatus status,
    String reason,
    String evidenceNote,
    String outcomeNote,
    String requestedBy,
    Instant createdAt,
    Instant reviewedAt
) {
    public static ServiceReviewResponse from(ServiceReviewRequest review) {
        return new ServiceReviewResponse(
            review.getId(),
            review.getAgreement().getId(),
            review.getMerchant().getId(),
            review.getWarehouseProvider().getId(),
            review.getReviewType(),
            review.getStatus(),
            review.getReason(),
            review.getEvidenceNote(),
            review.getOutcomeNote(),
            review.getRequestedBy(),
            review.getCreatedAt(),
            review.getReviewedAt()
        );
    }
}
