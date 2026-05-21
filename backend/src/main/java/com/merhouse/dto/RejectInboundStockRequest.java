package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejectInboundStockRequest(
    @NotBlank @Size(max = 1000) String rejectionReason
) {
}
