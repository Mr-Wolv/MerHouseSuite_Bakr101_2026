package com.merhouse.dto;

public record AdminPlatformSummaryResponse(
    long tenants,
    long suspendedTenants,
    long users,
    long enabledUsers,
    long platformAdmins,
    long pendingAccessRequests,
    long activeRelationships,
    long suspendedRelationships,
    long openInboundRequests,
    long openFulfillmentExceptions,
    long failedShipments,
    long returnedShipments,
    long failedOutboxEvents,
    long openServiceDisputes,
    long openServiceClaims,
    long pendingServiceReviews
) {
}
