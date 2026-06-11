package com.merhouse.dto;

import java.util.List;

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
    long pendingServiceReviews,
    List<AttentionSignalResponse> attentionSignals
) {
    public AdminPlatformSummaryResponse(
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
        this(
            tenants,
            suspendedTenants,
            users,
            enabledUsers,
            platformAdmins,
            pendingAccessRequests,
            activeRelationships,
            suspendedRelationships,
            openInboundRequests,
            openFulfillmentExceptions,
            failedShipments,
            returnedShipments,
            failedOutboxEvents,
            openServiceDisputes,
            openServiceClaims,
            pendingServiceReviews,
            List.of()
        );
    }
}
