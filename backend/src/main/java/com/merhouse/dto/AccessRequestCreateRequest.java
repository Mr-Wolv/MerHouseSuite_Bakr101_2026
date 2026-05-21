package com.merhouse.dto;

import com.merhouse.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AccessRequestCreateRequest(
    @NotBlank @Size(max = 160) String organizationName,
    @NotBlank @Email @Size(max = 255) String requesterEmail,
    @NotNull UserRole requestedRole,
    @Size(max = 1000) String notes
) {
}
