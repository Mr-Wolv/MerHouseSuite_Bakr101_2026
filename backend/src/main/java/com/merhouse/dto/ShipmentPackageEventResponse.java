package com.merhouse.dto;

import com.merhouse.entity.ShipmentPackageEvent;
import java.time.Instant;
import java.util.UUID;

public record ShipmentPackageEventResponse(
    UUID id,
    String eventType,
    String note,
    Instant occurredAt
) {
    public static ShipmentPackageEventResponse from(ShipmentPackageEvent event) {
        return new ShipmentPackageEventResponse(event.getId(), event.getEventType(), event.getNote(), event.getOccurredAt());
    }
}
