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
    @NotNull UserRole role,
    String recoveryKeyHash
) {
    public CreateUserRequest {
        email = trim(email);
    }

    /**
     * Convenience constructor for callers that don't need a recovery key.
     */
    public CreateUserRequest(UUID tenantId, String email, String password, UserRole role) {
        this(tenantId, email, password, role, null);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
