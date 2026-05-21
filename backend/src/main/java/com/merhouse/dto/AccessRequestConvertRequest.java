package com.merhouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AccessRequestConvertRequest(
    @NotBlank @Size(max = 160) String tenantName,
    @NotBlank @Size(min = 8, max = 120) String temporaryPassword,
    @NotBlank @Size(max = 1000) String reason
) {
}
