package com.merhouse.dto;

import com.merhouse.entity.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ChangeUserRoleRequest(
    @NotNull UserRole role,
    @NotBlank @Size(max = 1000) String reason
) {
}
