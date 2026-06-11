package com.merhouse.dto;

import com.merhouse.entity.AccessRequest;
import com.merhouse.entity.AccessRequestStatus;
import com.merhouse.entity.UserRole;
import java.time.Instant;
import java.util.UUID;

public record AccessRequestResponse(
    UUID id,
    String organizationName,
    String requesterEmail,
    UserRole requestedRole,
    String notes,
    AccessRequestStatus status,
    UUID reviewedByUserId,
    String reviewNote,
    Instant reviewedAt,
    UUID convertedTenantId,
    UUID convertedUserId,
    Instant convertedAt,
    Instant createdAt
) {
    public static AccessRequestResponse from(AccessRequest request) {
        return new AccessRequestResponse(
            request.getId(),
            request.getOrganizationName(),
            request.getRequesterEmail(),
            request.getRequestedRole(),
            request.getNotes(),
            request.getStatus(),
            request.getReviewedBy() == null ? null : request.getReviewedBy().getId(),
            request.getReviewNote(),
            request.getReviewedAt(),
            request.getConvertedTenant() == null ? null : request.getConvertedTenant().getId(),
            request.getConvertedUser() == null ? null : request.getConvertedUser().getId(),
            request.getConvertedAt(),
            request.getCreatedAt()
        );
    }
}
