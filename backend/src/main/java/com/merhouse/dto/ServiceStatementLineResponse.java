package com.merhouse.dto;

import com.merhouse.entity.ServiceSourceType;
import com.merhouse.entity.ServiceStatementLine;
import com.merhouse.entity.ServiceStatementLineType;
import java.math.BigDecimal;
import java.util.UUID;

public record ServiceStatementLineResponse(
    UUID id,
    ServiceStatementLineType lineType,
    ServiceSourceType sourceType,
    UUID sourceId,
    String description,
    int quantity,
    BigDecimal unitAmount,
    BigDecimal lineAmount
) {
    public static ServiceStatementLineResponse from(ServiceStatementLine line) {
        return new ServiceStatementLineResponse(
            line.getId(),
            line.getLineType(),
            line.getSourceType(),
            line.getSourceId(),
            line.getDescription(),
            line.getQuantity(),
            line.getUnitAmount(),
            line.getLineAmount()
        );
    }
}
