package com.merhouse.dto;

import com.merhouse.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateUserRequest(
    @NotNull UUID tenantId,
    @Email @NotBlank @Size(max = 255) String email,
    @NotBlank @Size(min = 8, max = 120) String password,
    @NotNull UserRole role
) {
    public CreateUserRequest {
        email = trim(email);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
