package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminResetPasswordRequest(
    @NotBlank @Size(min = 8, max = 120) String newPassword,
    @NotBlank @Size(max = 1000) String reason
) {
}
