package com.merhouse.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RecoveryKeyRequest(
    @NotBlank @Email @Size(max = 255) String email,
    @NotBlank @Size(min = 19, max = 19) String recoveryKey,
    @NotBlank @Size(min = 8, max = 120) String newPassword
) {
    public RecoveryKeyRequest {
        email = email.trim().toLowerCase();
        recoveryKey = recoveryKey.trim().toUpperCase();
    }
}
