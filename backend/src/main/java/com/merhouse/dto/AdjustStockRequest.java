package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record AdjustStockRequest(
    @NotNull UUID warehouseId,
    @NotNull UUID inventoryItemId,
    @NotNull Integer quantityDelta,
    @NotBlank @Size(max = 80) String reasonCode,
    @NotBlank @Size(max = 500) String reasonNote
) {
}
