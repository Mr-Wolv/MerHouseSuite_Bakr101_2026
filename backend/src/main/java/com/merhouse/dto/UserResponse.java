package com.merhouse.dto;

import com.merhouse.entity.AppUser;
import com.merhouse.entity.UserRole;
import java.time.Instant;
import java.util.UUID;

public record UserResponse(
    UUID id,
    UUID tenantId,
    String email,
    UserRole role,
    boolean enabled,
    Instant createdAt
) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(
            user.getId(),
            user.getTenant().getId(),
            user.getEmail(),
            user.getRole(),
            user.isEnabled(),
            user.getCreatedAt()
        );
    }
}
