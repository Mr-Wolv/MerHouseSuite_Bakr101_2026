package com.merhouse.dto;

import java.util.List;

public record FulfillmentAllocationDetailResponse(
    FulfillmentAllocationResponse allocation,
    OrderResponse order,
    List<ShipmentResponse> shipments,
    List<CarrierDispatchResponse> carrierDispatches,
    List<OutboxEventResponse> outboxEvents,
    List<TimelineEventResponse> timeline
) {
}
