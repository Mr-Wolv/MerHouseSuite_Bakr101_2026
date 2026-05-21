package com.merhouse.dto;

import com.merhouse.entity.ServiceDispute;
import com.merhouse.entity.ServiceDisputeStatus;
import java.time.Instant;
import java.util.UUID;

public record ServiceDisputeResponse(
    UUID id,
    UUID agreementId,
    UUID statementId,
    UUID statementLineId,
    UUID merchantId,
    UUID warehouseProviderId,
    ServiceDisputeStatus status,
    String reason,
    String evidenceNote,
    String outcomeNote,
    Instant createdAt,
    Instant resolvedAt
) {
    public static ServiceDisputeResponse from(ServiceDispute dispute) {
        return new ServiceDisputeResponse(
            dispute.getId(),
            dispute.getAgreement().getId(),
            dispute.getStatement().getId(),
            dispute.getStatementLine() == null ? null : dispute.getStatementLine().getId(),
            dispute.getMerchant().getId(),
            dispute.getWarehouseProvider().getId(),
            dispute.getStatus(),
            dispute.getReason(),
            dispute.getEvidenceNote(),
            dispute.getOutcomeNote(),
            dispute.getCreatedAt(),
            dispute.getResolvedAt()
        );
    }
}
