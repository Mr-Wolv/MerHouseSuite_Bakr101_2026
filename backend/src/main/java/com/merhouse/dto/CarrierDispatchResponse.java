package com.merhouse.dto;

import com.merhouse.entity.CarrierDispatch;
import java.time.Instant;
import java.util.UUID;

public record CarrierDispatchResponse(
    UUID id,
    UUID outboxEventId,
    UUID shipmentId,
    String eventType,
    String carrier,
    String trackingNumber,
    String status,
    int attempts,
    String externalReference,
    Instant createdAt
) {
    public static CarrierDispatchResponse from(CarrierDispatch dispatch) {
        return new CarrierDispatchResponse(
            dispatch.getId(),
            dispatch.getOutboxEventId(),
            dispatch.getShipmentId(),
            dispatch.getEventType(),
            dispatch.getCarrier(),
            dispatch.getTrackingNumber(),
            dispatch.getStatus(),
            dispatch.getAttempts(),
            dispatch.getExternalReference(),
            dispatch.getCreatedAt()
        );
    }
}
