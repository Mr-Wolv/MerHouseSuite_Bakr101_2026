package com.merhouse.dto;

import java.time.Instant;
import java.util.UUID;

public record TimelineEventResponse(
    UUID sourceId,
    String sourceType,
    String eventType,
    String label,
    String detail,
    Instant occurredAt
) {
}
