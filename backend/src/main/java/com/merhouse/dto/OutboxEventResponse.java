package com.merhouse.dto;

import com.merhouse.entity.OutboxEvent;
import java.time.Instant;
import java.util.UUID;

public record OutboxEventResponse(
    UUID id,
    String eventType,
    String aggregateType,
    UUID aggregateId,
    String status,
    int attempts,
    Instant createdAt,
    Instant nextAttemptAt,
    Instant processedAt,
    String lastError
) {
    public static OutboxEventResponse from(OutboxEvent event) {
        return new OutboxEventResponse(
            event.getId(),
            event.getEventType(),
            event.getAggregateType(),
            event.getAggregateId(),
            event.getStatus(),
            event.getAttempts(),
            event.getCreatedAt(),
            event.getNextAttemptAt(),
            event.getProcessedAt(),
            event.getLastError()
        );
    }
}
