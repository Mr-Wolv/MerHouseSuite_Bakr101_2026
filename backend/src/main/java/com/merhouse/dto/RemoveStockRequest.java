package com.merhouse.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record RemoveStockRequest(
    @NotNull UUID warehouseId,
    @NotNull UUID inventoryItemId,
    @Min(1) int quantity
) {
}
