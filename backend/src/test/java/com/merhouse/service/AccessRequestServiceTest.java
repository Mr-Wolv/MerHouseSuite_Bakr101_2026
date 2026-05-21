package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.dto.AccessRequestCreateRequest;
import com.merhouse.dto.AccessRequestConvertRequest;
import com.merhouse.dto.AccessRequestReviewRequest;
import com.merhouse.entity.AccessRequest;
import com.merhouse.entity.AccessRequestStatus;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.AccessRequestRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AccessRequestServiceTest {
    private final AccessRequestRepository requestRepository = mock(AccessRequestRepository.class);
    private final UserService userService = mock(UserService.class);
    private final TenantService tenantService = mock(TenantService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-05-18T00:00:00Z"), ZoneOffset.UTC);
    private final AccessRequestService service = new AccessRequestService(requestRepository, userService, tenantService, clock);

    @Test
    void publicRequestCannotAskForAdminRole() {
        var request = new AccessRequestCreateRequest(
            "Platform Owner",
            "owner@merhouse.local",
            UserRole.ADMIN,
            "Need admin"
        );

        assertThrows(DomainConflictException.class, () -> service.submit(request));
        verify(requestRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void publicRequestNormalizesEmailAndStartsPending() {
        var request = new AccessRequestCreateRequest(
            "Merchant Org",
            " Merchant@MerHouse.Local ",
            UserRole.MERCHANT,
            " Please onboard us "
        );

        service.submit(request);

        verify(requestRepository).save(org.mockito.ArgumentMatchers.argThat(saved ->
            saved.getRequesterEmail().equals("merchant@merhouse.local")
                && saved.getStatus() == AccessRequestStatus.PENDING
                && saved.getNotes().equals("Please onboard us")
        ));
    }

    @Test
    void publicRequestStoresInjectionShapedTextAsInertTrimmedData() {
        var request = new AccessRequestCreateRequest(
            " <img src=x onerror=alert(1)> Merchant ",
            " Security-Merchant@MerHouse.Local ",
            UserRole.MERCHANT,
            " ' OR '1'='1 <script>alert(1)</script> "
        );

        service.submit(request);

        verify(requestRepository).save(org.mockito.ArgumentMatchers.argThat(saved ->
            saved.getOrganizationName().equals("<img src=x onerror=alert(1)> Merchant")
                && saved.getRequesterEmail().equals("security-merchant@merhouse.local")
                && saved.getNotes().equals("' OR '1'='1 <script>alert(1)</script>")
                && saved.getStatus() == AccessRequestStatus.PENDING
        ));
    }

    @Test
    void reviewRejectsAlreadyReviewedRequest() {
        UUID requestId = UUID.randomUUID();
        AccessRequest accessRequest = new AccessRequest();
        accessRequest.setStatus(AccessRequestStatus.APPROVED);
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(accessRequest));

        assertThrows(
            DomainConflictException.class,
            () -> service.reject(requestId, UUID.randomUUID(), new AccessRequestReviewRequest("duplicate"))
        );
    }

    @Test
    void approveMarksReviewerAndTimestamp() {
        UUID requestId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        AccessRequest accessRequest = new AccessRequest();
        accessRequest.setStatus(AccessRequestStatus.PENDING);
        AppUser reviewer = new AppUser();
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(accessRequest));
        when(userService.getRequired(reviewerId)).thenReturn(reviewer);

        service.approve(requestId, reviewerId, new AccessRequestReviewRequest("Looks valid"));

        assertEquals(AccessRequestStatus.APPROVED, accessRequest.getStatus());
        assertEquals(reviewer, accessRequest.getReviewedBy());
        assertEquals("Looks valid", accessRequest.getReviewNote());
        assertEquals(Instant.parse("2026-05-18T00:00:00Z"), accessRequest.getReviewedAt());
        verify(requestRepository).save(accessRequest);
    }

    @Test
    void convertApprovedRequestCreatesTenantAndUserAndLinksAuditData() {
        UUID requestId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        AccessRequest accessRequest = new AccessRequest();
        accessRequest.setOrganizationName("Original Org");
        accessRequest.setRequesterEmail("requester@merhouse.local");
        accessRequest.setRequestedRole(UserRole.MERCHANT);
        accessRequest.setStatus(AccessRequestStatus.APPROVED);
        Tenant tenant = new Tenant();
        tenant.setName("Converted Org");
        tenant.setType(TenantType.MERCHANT);
        AppUser user = new AppUser();
        user.setEmail("requester@merhouse.local");
        user.setRole(UserRole.MERCHANT);

        when(requestRepository.findById(requestId)).thenReturn(Optional.of(accessRequest));
        when(tenantService.create(org.mockito.ArgumentMatchers.any())).thenReturn(tenant);
        when(userService.create(org.mockito.ArgumentMatchers.any())).thenReturn(user);

        service.convert(requestId, actorId, new AccessRequestConvertRequest(
            "Converted Org",
            "temporary-password",
            "Provision approved request"
        ));

        assertEquals(tenant, accessRequest.getConvertedTenant());
        assertEquals(user, accessRequest.getConvertedUser());
        assertEquals(Instant.parse("2026-05-18T00:00:00Z"), accessRequest.getConvertedAt());
        verify(requestRepository).save(accessRequest);
    }

    @Test
    void convertRejectsUnapprovedRequest() {
        UUID requestId = UUID.randomUUID();
        AccessRequest accessRequest = new AccessRequest();
        accessRequest.setStatus(AccessRequestStatus.PENDING);
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(accessRequest));

        assertThrows(DomainConflictException.class, () -> service.convert(
            requestId,
            UUID.randomUUID(),
            new AccessRequestConvertRequest("Tenant", "temporary-password", "Too early")
        ));
        verify(tenantService, never()).create(org.mockito.ArgumentMatchers.any());
    }
}
