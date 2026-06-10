package com.merhouse.dto;

import com.merhouse.entity.ServiceReviewType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateServiceReviewRequest(
    @NotNull ServiceReviewType reviewType,
    @NotBlank @Size(max = 160) String reason,
    @Size(max = 1000) String evidenceNote
) {
    public CreateServiceReviewRequest {
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
