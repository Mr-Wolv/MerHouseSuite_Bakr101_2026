package com.merhouse.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record ReceiveInboundStockRequest(
    @Min(0) int receivedQuantity,
    @Min(0) int damagedQuantity,
    @Size(max = 1000) String receivingNote
) {
}
