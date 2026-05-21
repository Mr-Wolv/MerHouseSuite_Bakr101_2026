package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ReportExceptionRequest(
    UUID allocationId,
    UUID shipmentId,
    @NotBlank @Size(max = 80) String reasonCode,
    @NotBlank @Size(max = 1000) String description
) {
}
