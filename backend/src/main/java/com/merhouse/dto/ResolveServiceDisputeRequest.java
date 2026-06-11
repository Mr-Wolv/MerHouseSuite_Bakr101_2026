package com.merhouse.dto;

import com.merhouse.entity.ServiceDisputeStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResolveServiceDisputeRequest(
    @NotNull ServiceDisputeStatus status,
    @Size(max = 1000) String outcomeNote
) {
    public ResolveServiceDisputeRequest {
        outcomeNote = trimToNull(outcomeNote);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String trimToNull(String value) {
        String trimmed = trim(value);
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
