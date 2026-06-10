package com.merhouse.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record PasswordResetRequest(
    @NotBlank @Email String email
) {
    public PasswordResetRequest {
        email = trim(email);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
