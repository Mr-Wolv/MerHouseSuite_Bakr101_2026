package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminActionRequest(
    @NotBlank @Size(max = 1000) String reason
) {
    public AdminActionRequest {
        reason = trim(reason);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
