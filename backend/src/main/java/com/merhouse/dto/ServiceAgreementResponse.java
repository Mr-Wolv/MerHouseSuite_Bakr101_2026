package com.merhouse.dto;

import com.merhouse.entity.ServiceAgreement;
import com.merhouse.entity.ServiceAgreementStatus;
import com.merhouse.entity.ServiceScope;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public record ServiceAgreementResponse(
    UUID id,
    UUID relationshipId,
    UUID merchantId,
    String merchantName,
    UUID warehouseProviderId,
    String warehouseProviderName,
    ServiceAgreementStatus status,
    String title,
    int versionNumber,
    LocalDate effectiveDate,
    LocalDate renewalReviewDate,
    int cancellationWindowDays,
    List<ServiceScope> serviceScopes,
    String serviceNotes,
    UUID supersedesAgreementId,
    ReferenceRateCardResponse rateCard,
    SlaPolicyResponse slaPolicy,
    Instant createdAt,
    Instant proposedAt,
    Instant acceptedAt,
    Instant activatedAt,
    Instant suspendedAt,
    Instant endedAt
) {
    public static ServiceAgreementResponse from(ServiceAgreement agreement) {
        return new ServiceAgreementResponse(
            agreement.getId(),
            agreement.getRelationship().getId(),
            agreement.getMerchant().getId(),
            agreement.getMerchant().getName(),
            agreement.getWarehouseProvider().getId(),
            agreement.getWarehouseProvider().getName(),
            agreement.getStatus(),
            agreement.getTitle(),
            agreement.getVersionNumber(),
            agreement.getEffectiveDate(),
            agreement.getRenewalReviewDate(),
            agreement.getCancellationWindowDays(),
            scopesFrom(agreement.getServiceScopes()),
            agreement.getServiceNotes(),
            agreement.getSupersedesAgreement() == null ? null : agreement.getSupersedesAgreement().getId(),
            ReferenceRateCardResponse.from(agreement.getRateCard()),
            SlaPolicyResponse.from(agreement.getSlaPolicy()),
            agreement.getCreatedAt(),
            agreement.getProposedAt(),
            agreement.getAcceptedAt(),
            agreement.getActivatedAt(),
            agreement.getSuspendedAt(),
            agreement.getEndedAt()
        );
    }

    private static List<ServiceScope> scopesFrom(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
            .map(ServiceScope::valueOf)
            .toList();
    }
}
