package com.merhouse.dto;

import com.merhouse.entity.UserRole;
import java.time.Instant;
import java.util.UUID;

public record AttentionSignalResponse(
    String id,
    AttentionSeverity severity,
    String title,
    String body,
    UserRole ownerRole,
    String nextActionLabel,
    String route,
    String sourceType,
    UUID sourceId,
    Instant createdAt,
    boolean resolved
) {
}
