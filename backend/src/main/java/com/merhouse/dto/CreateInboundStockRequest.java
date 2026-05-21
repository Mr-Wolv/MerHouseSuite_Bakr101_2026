package com.merhouse.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateInboundStockRequest(
    @NotNull UUID relationshipId,
    @NotNull UUID warehouseId,
    @NotNull UUID inventoryItemId,
    @Min(1) int requestedQuantity,
    @Size(max = 160) String merchantReference,
    @Size(max = 1000) String merchantNote
) {
}
