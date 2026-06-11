package com.merhouse.dto;

import com.merhouse.entity.ServiceStatement;
import com.merhouse.entity.ServiceStatementStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ServiceStatementResponse(
    UUID id,
    UUID agreementId,
    UUID merchantId,
    String merchantName,
    UUID warehouseProviderId,
    String warehouseProviderName,
    ServiceStatementStatus status,
    LocalDate periodStart,
    LocalDate periodEnd,
    LocalDate dueDate,
    BigDecimal subtotalAmount,
    BigDecimal coordinationFeeAmount,
    BigDecimal adjustmentAmount,
    BigDecimal totalAmount,
    String idempotencyKey,
    String note,
    List<ServiceStatementLineResponse> lines,
    Instant createdAt,
    Instant finalizedAt,
    Instant settlementMarkedAt
) {
    public static ServiceStatementResponse from(ServiceStatement statement) {
        return new ServiceStatementResponse(
            statement.getId(),
            statement.getAgreement().getId(),
            statement.getMerchant().getId(),
            statement.getMerchant().getName(),
            statement.getWarehouseProvider().getId(),
            statement.getWarehouseProvider().getName(),
            statement.getStatus(),
            statement.getPeriodStart(),
            statement.getPeriodEnd(),
            statement.getDueDate(),
            statement.getSubtotalAmount(),
            statement.getCoordinationFeeAmount(),
            statement.getAdjustmentAmount(),
            statement.getTotalAmount(),
            statement.getIdempotencyKey(),
            statement.getNote(),
            statement.getLines().stream().map(ServiceStatementLineResponse::from).toList(),
            statement.getCreatedAt(),
            statement.getFinalizedAt(),
            statement.getSettlementMarkedAt()
        );
    }
}
