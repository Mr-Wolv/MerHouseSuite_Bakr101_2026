package com.merhouse.dto;

import java.util.List;

public record InventoryItemDetailResponse(
    InventoryItemResponse item,
    List<InventoryAuditLogResponse> auditLogs,
    List<InboundStockRequestResponse> inboundRequests,
    List<TimelineEventResponse> timeline
) {
}
