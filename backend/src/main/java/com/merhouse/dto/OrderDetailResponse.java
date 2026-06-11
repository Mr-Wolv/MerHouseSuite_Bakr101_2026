package com.merhouse.dto;

import java.util.List;

public record OrderDetailResponse(
    OrderResponse order,
    List<ShipmentResponse> shipments,
    List<CarrierDispatchResponse> carrierDispatches,
    List<OutboxEventResponse> outboxEvents,
    List<TimelineEventResponse> timeline
) {
}
