package com.merhouse.dto;

import java.util.List;

public record MerchantWarehouseRelationshipDetailResponse(
    MerchantWarehouseRelationshipResponse relationship,
    List<InboundStockRequestResponse> inboundStockRequests,
    List<FulfillmentAllocationResponse> allocations,
    List<OutboxEventResponse> outboxEvents,
    List<TimelineEventResponse> timeline
) {
}
