package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

public record CreateShipmentRequest(
    @NotNull UUID allocationId,
    @NotBlank @Size(max = 120) String carrier,
    @NotBlank @Size(max = 160) @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$") String trackingNumber,
    @NotNull @Min(1) Integer packageCount,
    @NotNull @DecimalMin(value = "0.01") BigDecimal packageWeightKg,
    @NotNull @Min(1) Integer packageLengthCm,
    @NotNull @Min(1) Integer packageWidthCm,
    @NotNull @Min(1) Integer packageHeightCm,
    @NotBlank @Size(max = 500) String packingNote,
    Map<String, Object> metadata
) {
}
