package com.merhouse.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record SlaPolicyRequest(
    @Min(1) Integer receivingSlaHours,
    @Min(1) Integer pickPackSlaHours,
    @Min(1) Integer shipmentHandoffSlaHours,
    @Min(1) Integer exceptionResponseSlaHours,
    @Size(max = 500) String pauseRuleNotes
) {
    public SlaPolicyRequest {
        pauseRuleNotes = trimToNull(pauseRuleNotes);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String trimToNull(String value) {
        String trimmed = trim(value);
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
