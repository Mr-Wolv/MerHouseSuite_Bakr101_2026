package com.merhouse.dto;

import java.util.List;

public record ShipmentDetailResponse(
    ShipmentResponse shipment,
    FulfillmentAllocationResponse allocation,
    OrderResponse order,
    List<CarrierDispatchResponse> carrierDispatches,
    List<OutboxEventResponse> outboxEvents,
    List<TimelineEventResponse> timeline
) {
}
