package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateServiceDisputeRequest(
    UUID statementLineId,
    @NotBlank @Size(max = 160) String reason,
    @Size(max = 1000) String evidenceNote
) {
    public CreateServiceDisputeRequest {
        reason = trim(reason);
        evidenceNote = trimToNull(evidenceNote);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String trimToNull(String value) {
        String trimmed = trim(value);
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
