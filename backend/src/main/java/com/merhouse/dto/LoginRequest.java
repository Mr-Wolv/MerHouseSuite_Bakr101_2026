package com.merhouse.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
    @Email @NotBlank String email,
    @NotBlank String password
) {
    public LoginRequest {
        email = trim(email);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
