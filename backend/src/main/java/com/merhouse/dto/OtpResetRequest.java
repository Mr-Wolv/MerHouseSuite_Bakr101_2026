package com.merhouse.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OtpResetRequest(
    @NotBlank @Email String email,
    @NotBlank String otpCode,
    @NotBlank @Size(min = 8, max = 120) String newPassword
) {
    public OtpResetRequest {
        email = trim(email);
        otpCode = trim(otpCode);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
