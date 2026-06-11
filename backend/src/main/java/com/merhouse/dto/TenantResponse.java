package com.merhouse.dto;

import com.merhouse.entity.Tenant;
import java.time.Instant;
import java.util.UUID;
import com.merhouse.entity.TenantType;

public record TenantResponse(
    UUID id,
    String name,
    TenantType type,
    boolean active,
    String suspensionReason,
    Instant suspendedAt,
    Instant createdAt
) {
    public static TenantResponse from(Tenant tenant) {
        return new TenantResponse(
            tenant.getId(),
            tenant.getName(),
            tenant.getType(),
            tenant.isActive(),
            tenant.getSuspensionReason(),
            tenant.getSuspendedAt(),
            tenant.getCreatedAt()
        );
    }
}
