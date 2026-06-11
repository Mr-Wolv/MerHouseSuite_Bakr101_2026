package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.AccessRequestStatus;
import com.merhouse.entity.InboundStockRequestStatus;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import com.merhouse.entity.OutboxEventStatus;
import com.merhouse.entity.ServiceClaimStatus;
import com.merhouse.entity.ServiceDisputeStatus;
import com.merhouse.entity.ServiceReviewStatus;
import com.merhouse.entity.ShipmentStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AccessRequestRepository;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.FulfillmentAllocationRepository;
import com.merhouse.repository.FulfillmentExceptionRepository;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.InventoryItemRepository;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.OutboxEventRepository;
import com.merhouse.repository.ServiceClaimRepository;
import com.merhouse.repository.ServiceDisputeRepository;
import com.merhouse.repository.ServiceReviewRequestRepository;
import com.merhouse.repository.ServiceStatementRepository;
import com.merhouse.repository.ShipmentRepository;
import com.merhouse.repository.TenantRepository;
import com.merhouse.repository.WarehouseRepository;
import com.merhouse.security.UserPrincipal;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class AdminControlServiceTest {
    private final TenantRepository tenantRepository = mock(TenantRepository.class);
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final AccessRequestRepository accessRequestRepository = mock(AccessRequestRepository.class);
    private final MerchantWarehouseRelationshipRepository relationshipRepository =
        mock(MerchantWarehouseRelationshipRepository.class);
    private final InboundStockRequestRepository inboundRepository = mock(InboundStockRequestRepository.class);
    private final FulfillmentExceptionRepository exceptionRepository = mock(FulfillmentExceptionRepository.class);
    private final ShipmentRepository shipmentRepository = mock(ShipmentRepository.class);
    private final OutboxEventRepository outboxRepository = mock(OutboxEventRepository.class);
    private final ServiceDisputeRepository disputeRepository = mock(ServiceDisputeRepository.class);
    private final ServiceClaimRepository claimRepository = mock(ServiceClaimRepository.class);
    private final ServiceReviewRequestRepository reviewRepository = mock(ServiceReviewRequestRepository.class);
    private final WarehouseRepository warehouseRepository = mock(WarehouseRepository.class);
    private final InventoryItemRepository inventoryItemRepository = mock(InventoryItemRepository.class);
    private final CustomerOrderRepository orderRepository = mock(CustomerOrderRepository.class);
    private final FulfillmentAllocationRepository allocationRepository = mock(FulfillmentAllocationRepository.class);
    private final ServiceStatementRepository statementRepository = mock(ServiceStatementRepository.class);
    private final TenantService tenantService = mock(TenantService.class);
    private final AdminAuditService adminAuditService = mock(AdminAuditService.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final AdminControlService service = new AdminControlService(
        tenantRepository,
        userRepository,
        accessRequestRepository,
        relationshipRepository,
        inboundRepository,
        exceptionRepository,
        shipmentRepository,
        outboxRepository,
        disputeRepository,
        claimRepository,
        reviewRepository,
        warehouseRepository,
        inventoryItemRepository,
        orderRepository,
        allocationRepository,
        statementRepository,
        tenantService,
        adminAuditService,
        currentUserService
    );

    @Test
    void summaryUsesRepositoryCountsInsteadOfLoadingTables() {
        when(currentUserService.required()).thenReturn(principal(UserRole.ADMIN));
        Set<UserRole> platformRoles = Set.of(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT_ADMIN, UserRole.AUDITOR);
        when(tenantRepository.count()).thenReturn(11L);
        when(tenantRepository.countByActiveFalse()).thenReturn(2L);
        when(userRepository.count()).thenReturn(31L);
        when(userRepository.countByEnabledTrue()).thenReturn(29L);
        when(userRepository.countByRoleIn(platformRoles)).thenReturn(4L);
        when(accessRequestRepository.countByStatus(AccessRequestStatus.PENDING)).thenReturn(3L);
        when(relationshipRepository.countByStatus(MerchantWarehouseRelationshipStatus.ACTIVE)).thenReturn(7L);
        when(relationshipRepository.countByStatus(MerchantWarehouseRelationshipStatus.SUSPENDED)).thenReturn(1L);
        when(inboundRepository.countByStatusIn(Set.of(
            InboundStockRequestStatus.SUBMITTED,
            InboundStockRequestStatus.APPROVED,
            InboundStockRequestStatus.RECEIVING
        ))).thenReturn(5L);
        when(exceptionRepository.countByStatus("OPEN")).thenReturn(6L);
        when(shipmentRepository.countByStatus(ShipmentStatus.FAILED)).thenReturn(8L);
        when(shipmentRepository.countByStatus(ShipmentStatus.RETURNED)).thenReturn(9L);
        when(outboxRepository.countByStatus(OutboxEventStatus.FAILED)).thenReturn(10L);
        when(disputeRepository.countByStatus(ServiceDisputeStatus.OPEN)).thenReturn(12L);
        when(claimRepository.countByStatus(ServiceClaimStatus.OPEN)).thenReturn(13L);
        when(reviewRepository.countByStatus(ServiceReviewStatus.PENDING)).thenReturn(14L);

        var response = service.summary();

        assertEquals(11L, response.tenants());
        assertEquals(2L, response.suspendedTenants());
        assertEquals(31L, response.users());
        assertEquals(29L, response.enabledUsers());
        assertEquals(4L, response.platformAdmins());
        assertEquals(3L, response.pendingAccessRequests());
        assertEquals(7L, response.activeRelationships());
        assertEquals(1L, response.suspendedRelationships());
        assertEquals(5L, response.openInboundRequests());
        assertEquals(6L, response.openFulfillmentExceptions());
        assertEquals(8L, response.failedShipments());
        assertEquals(9L, response.returnedShipments());
        assertEquals(10L, response.failedOutboxEvents());
        assertEquals(12L, response.openServiceDisputes());
        assertEquals(13L, response.openServiceClaims());
        assertEquals(14L, response.pendingServiceReviews());
        assertEquals(6, response.attentionSignals().size());
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Fulfillment exceptions need operational follow-up")
                && signal.route().equals("/service-accountability")
                && signal.sourceType().equals("FulfillmentException")
                && signal.ownerRole() == UserRole.ADMIN));
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Outbox failures need reliability review")
                && signal.route().equals("/admin/outbox")
                && signal.severity().name().equals("CRITICAL")));
        verify(relationshipRepository, never()).findAll();
        verify(inboundRepository, never()).findAll();
        verify(exceptionRepository, never()).findAll();
        verify(shipmentRepository, never()).findAll();
        verify(disputeRepository, never()).findAll();
        verify(claimRepository, never()).findAll();
        verify(reviewRepository, never()).findAll();
        verify(accessRequestRepository, never()).findAll();
    }

    @Test
    void supportSummaryLabelsOwnerAdminOnlyAttentionAsReviewAndEscalate() {
        when(currentUserService.required()).thenReturn(principal(UserRole.SUPPORT_ADMIN));
        when(accessRequestRepository.countByStatus(AccessRequestStatus.PENDING)).thenReturn(2L);
        when(outboxRepository.countByStatus(OutboxEventStatus.FAILED)).thenReturn(1L);

        var response = service.summary();

        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.sourceType().equals("AccessRequest")
                && signal.severity().name().equals("REVIEW")
                && signal.nextActionLabel().equals("Review and escalate")
                && signal.ownerRole() == UserRole.SUPPORT_ADMIN));
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.sourceType().equals("OutboxEvent")
                && signal.nextActionLabel().equals("Review diagnostics")
                && signal.ownerRole() == UserRole.SUPPORT_ADMIN));
    }

    @Test
    void auditorSummaryDoesNotPointToHiddenAccessRequestRoute() {
        when(currentUserService.required()).thenReturn(principal(UserRole.AUDITOR));
        when(accessRequestRepository.countByStatus(AccessRequestStatus.PENDING)).thenReturn(2L);
        when(outboxRepository.countByStatus(OutboxEventStatus.FAILED)).thenReturn(1L);

        var response = service.summary();

        assertTrue(response.attentionSignals().stream()
            .noneMatch(signal -> signal.route().equals("/admin/access-requests")));
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.sourceType().equals("OutboxEvent")
                && signal.nextActionLabel().equals("Review diagnostics")
                && signal.ownerRole() == UserRole.AUDITOR));
    }

    @Test
    void tenantHealthUsesRepositoryCountsForEachTenant() {
        UUID merchantId = UUID.randomUUID();
        Tenant merchant = tenant(merchantId, TenantType.MERCHANT, "Merchant");
        when(tenantRepository.findAll()).thenReturn(List.of(merchant));
        when(userRepository.countByTenantId(merchantId)).thenReturn(2L);
        when(relationshipRepository.countByMerchantIdOrWarehouseProviderId(merchantId, merchantId)).thenReturn(3L);
        when(warehouseRepository.countByTenantId(merchantId)).thenReturn(0L);
        when(inventoryItemRepository.countByMerchantId(merchantId)).thenReturn(4L);
        when(inboundRepository.countByMerchantId(merchantId)).thenReturn(5L);
        when(orderRepository.countByMerchantId(merchantId)).thenReturn(6L);
        when(statementRepository.countByMerchantId(merchantId)).thenReturn(7L);
        when(disputeRepository.countByMerchantIdAndStatus(merchantId, ServiceDisputeStatus.OPEN)).thenReturn(8L);
        when(claimRepository.countByMerchantIdAndStatus(merchantId, ServiceClaimStatus.OPEN)).thenReturn(9L);
        when(reviewRepository.countByMerchantIdAndStatus(merchantId, ServiceReviewStatus.PENDING)).thenReturn(10L);

        var response = service.tenantHealth().getFirst();

        assertEquals(merchantId, response.tenantId());
        assertEquals(2L, response.users());
        assertEquals(3L, response.relationships());
        assertEquals(0L, response.warehouses());
        assertEquals(4L, response.inventoryItems());
        assertEquals(5L, response.inboundRequests());
        assertEquals(6L, response.orders());
        assertEquals(0L, response.fulfillmentAllocations());
        assertEquals(7L, response.serviceStatements());
        assertEquals(8L, response.openDisputes());
        assertEquals(9L, response.openClaims());
        assertEquals(10L, response.pendingReviews());
        verify(userRepository, never()).findAll();
        verify(relationshipRepository, never()).findAll();
    }

    private Tenant tenant(UUID id, TenantType type, String name) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", id);
        tenant.setType(type);
        tenant.setName(name);
        return tenant;
    }

    private UserPrincipal principal(UserRole role) {
        return new UserPrincipal(UUID.randomUUID(), UUID.randomUUID(), role.name().toLowerCase() + "@merhouse.local", role, true);
    }
}
