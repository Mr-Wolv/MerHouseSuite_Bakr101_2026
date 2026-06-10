package com.merhouse.service;

import com.merhouse.dto.AccessRequestConvertRequest;
import com.merhouse.dto.AccessRequestCreateRequest;
import com.merhouse.dto.AccessRequestReviewRequest;
import com.merhouse.dto.CreateTenantRequest;
import com.merhouse.dto.CreateUserRequest;
import com.merhouse.entity.AccessRequest;
import com.merhouse.entity.AccessRequestStatus;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.AccessRequestRepository;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccessRequestService {
    private final AccessRequestRepository requestRepository;
    private final UserService userService;
    private final TenantService tenantService;
    private final NotificationService notificationService;
    private final Clock clock;

    public AccessRequestService(
        AccessRequestRepository requestRepository,
        UserService userService,
        TenantService tenantService,
        NotificationService notificationService,
        Clock clock
    ) {
        this.requestRepository = requestRepository;
        this.userService = userService;
        this.tenantService = tenantService;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    @Transactional
    public AccessRequest submit(AccessRequestCreateRequest request) {
        if (request.requestedRole().isPlatformAdmin()) {
            throw new DomainConflictException("Public access requests can only ask for merchant or warehouse access.");
        }

        AccessRequest accessRequest = new AccessRequest();
        accessRequest.setOrganizationName(request.organizationName().trim());
        accessRequest.setRequesterEmail(normalizeEmail(request.requesterEmail()));
        accessRequest.setRequestedRole(request.requestedRole());
        accessRequest.setNotes(trimToNull(request.notes()));
        accessRequest.setStatus(AccessRequestStatus.PENDING);
        return requestRepository.save(accessRequest);
    }

    @Transactional(readOnly = true)
    public List<AccessRequest> findAll() {
        return requestRepository.findAll().stream()
            .sorted(Comparator.comparing(AccessRequest::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
    }

    @Transactional
    public AccessRequest approve(UUID id, UUID reviewerId, AccessRequestReviewRequest request) {
        return review(id, reviewerId, AccessRequestStatus.APPROVED, request);
    }

    @Transactional
    public AccessRequest reject(UUID id, UUID reviewerId, AccessRequestReviewRequest request) {
        return review(id, reviewerId, AccessRequestStatus.REJECTED, request);
    }

    @Transactional
    public AccessRequest convert(UUID id, UUID actorId, AccessRequestConvertRequest request) {
        AccessRequest accessRequest = requestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Access request not found: " + id));
        if (accessRequest.getStatus() != AccessRequestStatus.APPROVED) {
            throw new DomainConflictException("Only APPROVED access requests can be converted into onboarding work.");
        }
        if (accessRequest.getConvertedAt() != null) {
            throw new DomainConflictException("Access request has already been converted.");
        }

        var tenantType = accessRequest.getRequestedRole() == UserRole.MERCHANT
            ? com.merhouse.entity.TenantType.MERCHANT
            : com.merhouse.entity.TenantType.WAREHOUSE_PROVIDER;
        var tenant = tenantService.create(new CreateTenantRequest(request.tenantName(), tenantType));
        AppUser user = userService.create(new CreateUserRequest(
            tenant.getId(),
            accessRequest.getRequesterEmail(),
            request.temporaryPassword(),
            accessRequest.getRequestedRole()
        ));
        notificationService.recordForUser(
            user,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            "Account ready",
            "Your MerHouse account was created from an approved access request. This is a local delivery history record.",
            "Your MerHouse account was created from an approved access request. Sign in with the setup password shared by your platform contact, then change it from Account settings.",
            "AccessRequest",
            accessRequest.getId()
        );
        accessRequest.setConvertedTenant(tenant);
        accessRequest.setConvertedUser(user);
        accessRequest.setConvertedAt(clock.instant());
        return requestRepository.save(accessRequest);
    }

    private AccessRequest review(UUID id, UUID reviewerId, AccessRequestStatus status, AccessRequestReviewRequest request) {
        AccessRequest accessRequest = requestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Access request not found: " + id));
        if (accessRequest.getStatus() != AccessRequestStatus.PENDING) {
            throw new DomainConflictException("Access request has already been reviewed.");
        }

        AppUser reviewer = userService.getRequired(reviewerId);
        accessRequest.setStatus(status);
        accessRequest.setReviewedBy(reviewer);
        accessRequest.setReviewNote(trimToNull(request.reviewNote()));
        accessRequest.setReviewedAt(clock.instant());
        return requestRepository.save(accessRequest);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
