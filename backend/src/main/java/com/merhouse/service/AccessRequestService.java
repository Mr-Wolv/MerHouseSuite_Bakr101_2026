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
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccessRequestService {
    private final AccessRequestRepository requestRepository;
    private final UserService userService;
    private final TenantService tenantService;
    private final NotificationService notificationService;
    private final EmailDeliveryService emailDeliveryService;
    private final Clock clock;
    private final int requestLimit;
    private final Duration requestWindow;
    private final SecureRandom secureRandom = new SecureRandom();

    public AccessRequestService(
        AccessRequestRepository requestRepository,
        UserService userService,
        TenantService tenantService,
        NotificationService notificationService,
        EmailDeliveryService emailDeliveryService,
        Clock clock,
        @Value("${merhouse.access-requests.request-limit:3}") int requestLimit,
        @Value("${merhouse.access-requests.request-window-hours:24}") long requestWindowHours
    ) {
        this.requestRepository = requestRepository;
        this.userService = userService;
        this.tenantService = tenantService;
        this.notificationService = notificationService;
        this.emailDeliveryService = emailDeliveryService;
        this.clock = clock;
        this.requestLimit = Math.max(1, requestLimit);
        this.requestWindow = Duration.ofHours(Math.max(1, requestWindowHours));
    }

    @Transactional
    public AccessRequest submit(AccessRequestCreateRequest request) {
        if (request.requestedRole().isPlatformAdmin()) {
            throw new DomainConflictException("Public access requests can only ask for merchant or warehouse access.");
        }

        String requesterEmail = normalizeEmail(request.requesterEmail());
        if (requestRepository.existsByRequesterEmailIgnoreCaseAndStatus(requesterEmail, AccessRequestStatus.PENDING)) {
            throw new DomainConflictException("An access request for this email is already pending review.");
        }
        long recentRequests = requestRepository.countByRequesterEmailIgnoreCaseAndCreatedAtAfter(
            requesterEmail,
            clock.instant().minus(requestWindow)
        );
        if (recentRequests >= requestLimit) {
            throw new DomainConflictException("Too many access requests were submitted for this email recently.");
        }

        AccessRequest accessRequest = new AccessRequest();
        accessRequest.setOrganizationName(request.organizationName().trim());
        accessRequest.setRequesterEmail(requesterEmail);
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
    public AccessRequest approveAndActivate(UUID id, UUID reviewerId, AccessRequestReviewRequest reviewRequest) {
        AccessRequest accessRequest = requestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Access request not found: " + id));
        if (accessRequest.getStatus() != AccessRequestStatus.PENDING) {
            throw new DomainConflictException("Access request has already been reviewed.");
        }
        if (accessRequest.getConvertedAt() != null) {
            throw new DomainConflictException("Access request has already been activated.");
        }

        AppUser reviewer = userService.getRequired(reviewerId);

        // Auto-approve
        accessRequest.setStatus(AccessRequestStatus.APPROVED);
        accessRequest.setReviewedBy(reviewer);
        accessRequest.setReviewNote(trimToNull(reviewRequest.reviewNote()));
        accessRequest.setReviewedAt(clock.instant());

        // Generate random temporary password
        String temporaryPassword = generateTemporaryPassword();

        // Create tenant and user
        var tenantType = accessRequest.getRequestedRole() == UserRole.MERCHANT
            ? com.merhouse.entity.TenantType.MERCHANT
            : com.merhouse.entity.TenantType.WAREHOUSE_PROVIDER;
        var tenant = tenantService.create(new CreateTenantRequest(accessRequest.getOrganizationName(), tenantType));
        AppUser user = userService.create(new CreateUserRequest(
            tenant.getId(),
            accessRequest.getRequesterEmail(),
            temporaryPassword,
            accessRequest.getRequestedRole()
        ));

        // Record in-app notification
        notificationService.recordForUser(
            user,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            "Account activated",
            "Your MerHouse account was activated through an approved access request. This is a local delivery history record.",
            "Your MerHouse account is active. Sign in with your email and the temporary password provided by your platform contact, then change it from Account settings.",
            "AccessRequest",
            accessRequest.getId()
        );

        // Send activation email (async — must not block or roll back the transaction)
        String emailBody = buildActivationEmailBody(accessRequest, temporaryPassword);
        emailDeliveryService.sendAndForget(
            null,
            accessRequest.getRequesterEmail(),
            "Your MerHouse account is ready",
            emailBody
        );

        // Mark as converted
        accessRequest.setConvertedTenant(tenant);
        accessRequest.setConvertedUser(user);
        accessRequest.setConvertedAt(clock.instant());
        return requestRepository.save(accessRequest);
    }

    private String generateTemporaryPassword() {
        byte[] bytes = new byte[16];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).substring(0, 16);
    }

    private String buildActivationEmailBody(AccessRequest accessRequest, String temporaryPassword) {
        return String.format(
            "Welcome to MerHouse!\n\n"
                + "Your account has been activated for %s.\n\n"
                + "Sign in with:\n"
                + "  Email: %s\n"
                + "  Temporary password: %s\n\n"
                + "Change your password from Account settings after signing in.\n\n"
                + "Role: %s\n",
            accessRequest.getOrganizationName(),
            accessRequest.getRequesterEmail(),
            temporaryPassword,
            accessRequest.getRequestedRole().name().replace('_', ' ')
        );
    }

    @Transactional
    public AccessRequest convert(UUID id, AccessRequestConvertRequest request) {
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
