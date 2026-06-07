package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SelfPasswordChangeRequest(
    @NotBlank @Size(min = 8, max = 120) String currentPassword,
    @NotBlank @Size(min = 8, max = 120) String newPassword
) {
}
