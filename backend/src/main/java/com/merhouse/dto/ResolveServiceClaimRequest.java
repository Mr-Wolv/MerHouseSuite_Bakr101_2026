package com.merhouse.dto;

import com.merhouse.entity.ServiceClaimStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResolveServiceClaimRequest(
    @NotNull ServiceClaimStatus status,
    @Size(max = 1000) String outcomeNote
) {
    public ResolveServiceClaimRequest {
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
