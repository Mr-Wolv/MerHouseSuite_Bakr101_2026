package com.merhouse.dto;

import com.merhouse.entity.ServiceSourceType;
import com.merhouse.entity.ServiceStatementLineType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record ServiceStatementLineRequest(
    @NotNull ServiceStatementLineType lineType,
    @NotNull ServiceSourceType sourceType,
    UUID sourceId,
    @NotBlank @Size(max = 240) String description,
    @Min(1) int quantity,
    @NotNull @DecimalMin("0.00") BigDecimal unitAmount
) {
    public ServiceStatementLineRequest {
        description = trim(description);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
