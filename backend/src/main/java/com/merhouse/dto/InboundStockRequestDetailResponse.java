package com.merhouse.dto;

import java.util.List;

public record InboundStockRequestDetailResponse(
    InboundStockRequestResponse inboundStockRequest,
    MerchantWarehouseRelationshipResponse relationship,
    List<InventoryAuditLogResponse> auditLogs,
    List<OutboxEventResponse> outboxEvents,
    List<TimelineEventResponse> timeline
) {
}
