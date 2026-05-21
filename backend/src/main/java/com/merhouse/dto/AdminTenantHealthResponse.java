package com.merhouse.dto;

import java.util.UUID;

public record AdminTenantHealthResponse(
    TenantResponse tenant,
    long users,
    long relationships,
    long warehouses,
    long inventoryItems,
    long inboundRequests,
    long orders,
    long fulfillmentAllocations,
    long serviceStatements,
    long openDisputes,
    long openClaims,
    long pendingReviews
) {
    public UUID tenantId() {
        return tenant.id();
    }
}
