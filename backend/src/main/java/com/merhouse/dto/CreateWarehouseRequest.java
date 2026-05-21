package com.merhouse.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateWarehouseRequest(
    @NotNull UUID tenantId,
    @NotBlank @Size(max = 160) String name,
    @NotBlank String address,
    BigDecimal latitude,
    BigDecimal longitude,
    @Min(0) int capacity
) {
}
