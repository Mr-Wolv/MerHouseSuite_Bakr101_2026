package com.merhouse.service;

import com.merhouse.dto.AttentionSeverity;
import com.merhouse.dto.AttentionSignalResponse;
import com.merhouse.entity.UserRole;
import java.time.Instant;
import java.util.UUID;

final class AttentionSignalFactory {
    private AttentionSignalFactory() {
    }

    static AttentionSignalResponse signal(
        String id,
        AttentionSeverity severity,
        String title,
        String body,
        UserRole ownerRole,
        String nextActionLabel,
        String route,
        String sourceType,
        UUID sourceId,
        Instant createdAt
    ) {
        return new AttentionSignalResponse(
            id,
            severity,
            title,
            body,
            ownerRole,
            nextActionLabel,
            route,
            sourceType,
            sourceId,
            createdAt == null ? Instant.EPOCH : createdAt,
            severity == AttentionSeverity.CLEARED
        );
    }
}
