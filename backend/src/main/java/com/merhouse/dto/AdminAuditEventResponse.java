package com.merhouse.dto;

import com.merhouse.entity.AdminAuditEvent;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record AdminAuditEventResponse(
    UUID id,
    UUID actorUserId,
    String actorEmail,
    String action,
    String aggregateType,
    UUID aggregateId,
    String reason,
    Map<String, Object> metadata,
    Instant createdAt
) {
    public static AdminAuditEventResponse from(AdminAuditEvent event) {
        return new AdminAuditEventResponse(
            event.getId(),
            event.getActor() == null ? null : event.getActor().getId(),
            event.getActor() == null ? null : event.getActor().getEmail(),
            event.getAction(),
            event.getAggregateType(),
            event.getAggregateId(),
            event.getReason(),
            event.getMetadata(),
            event.getCreatedAt()
        );
    }
}
