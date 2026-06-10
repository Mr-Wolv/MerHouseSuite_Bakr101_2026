package com.merhouse.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record UpdateAllocationWorkloadRequest(
    UUID assignedUserId,
    @Min(1) @Max(5) Integer priority,
    @Size(max = 80) String scanCode,
    Boolean markPickSheetPrinted
) {
    public UpdateAllocationWorkloadRequest {
        scanCode = trim(scanCode);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
