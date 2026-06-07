package com.merhouse.service;

import com.merhouse.dto.AdminAuditEventResponse;
import com.merhouse.dto.AdminPlatformSummaryResponse;
import com.merhouse.dto.AdminTenantHealthResponse;
import com.merhouse.dto.AttentionSeverity;
import com.merhouse.dto.AttentionSignalResponse;
import com.merhouse.dto.TenantResponse;
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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.time.Instant;
import java.util.ArrayList;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminControlService {
    private static final Set<UserRole> PLATFORM_ADMIN_ROLES = Set.of(
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.SUPPORT_ADMIN,
        UserRole.AUDITOR
    );

    private final TenantRepository tenantRepository;
    private final AppUserRepository userRepository;
    private final AccessRequestRepository accessRequestRepository;
    private final MerchantWarehouseRelationshipRepository relationshipRepository;
    private final InboundStockRequestRepository inboundRepository;
    private final FulfillmentExceptionRepository exceptionRepository;
    private final ShipmentRepository shipmentRepository;
    private final OutboxEventRepository outboxRepository;
    private final ServiceDisputeRepository disputeRepository;
    private final ServiceClaimRepository claimRepository;
    private final ServiceReviewRequestRepository reviewRepository;
    private final WarehouseRepository warehouseRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final CustomerOrderRepository orderRepository;
    private final FulfillmentAllocationRepository allocationRepository;
    private final ServiceStatementRepository statementRepository;
    private final TenantService tenantService;
    private final AdminAuditService adminAuditService;
    private final CurrentUserService currentUserService;

    public AdminControlService(
        TenantRepository tenantRepository,
        AppUserRepository userRepository,
        AccessRequestRepository accessRequestRepository,
        MerchantWarehouseRelationshipRepository relationshipRepository,
        InboundStockRequestRepository inboundRepository,
        FulfillmentExceptionRepository exceptionRepository,
        ShipmentRepository shipmentRepository,
        OutboxEventRepository outboxRepository,
        ServiceDisputeRepository disputeRepository,
        ServiceClaimRepository claimRepository,
        ServiceReviewRequestRepository reviewRepository,
        WarehouseRepository warehouseRepository,
        InventoryItemRepository inventoryItemRepository,
        CustomerOrderRepository orderRepository,
        FulfillmentAllocationRepository allocationRepository,
        ServiceStatementRepository statementRepository,
        TenantService tenantService,
        AdminAuditService adminAuditService,
        CurrentUserService currentUserService
    ) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.relationshipRepository = relationshipRepository;
        this.inboundRepository = inboundRepository;
        this.exceptionRepository = exceptionRepository;
        this.shipmentRepository = shipmentRepository;
        this.outboxRepository = outboxRepository;
        this.disputeRepository = disputeRepository;
        this.claimRepository = claimRepository;
        this.reviewRepository = reviewRepository;
        this.warehouseRepository = warehouseRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.orderRepository = orderRepository;
        this.allocationRepository = allocationRepository;
        this.statementRepository = statementRepository;
        this.tenantService = tenantService;
        this.adminAuditService = adminAuditService;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public AdminPlatformSummaryResponse summary() {
        long pendingAccessRequests = accessRequestRepository.countByStatus(AccessRequestStatus.PENDING);
        long suspendedTenants = tenantRepository.countByActiveFalse();
        long suspendedRelationships = relationshipRepository.countByStatus(MerchantWarehouseRelationshipStatus.SUSPENDED);
        long openFulfillmentExceptions = exceptionRepository.countByStatus("OPEN");
        long failedShipments = shipmentRepository.countByStatus(ShipmentStatus.FAILED);
        long returnedShipments = shipmentRepository.countByStatus(ShipmentStatus.RETURNED);
        long failedOutboxEvents = outboxRepository.countByStatus(OutboxEventStatus.FAILED);
        long openServiceDisputes = disputeRepository.countByStatus(ServiceDisputeStatus.OPEN);
        long openServiceClaims = claimRepository.countByStatus(ServiceClaimStatus.OPEN);
        long pendingServiceReviews = reviewRepository.countByStatus(ServiceReviewStatus.PENDING);
        UserRole currentRole = currentUserService.required().role();
        List<AttentionSignalResponse> attentionSignals = adminAttentionSignals(
            pendingAccessRequests,
            suspendedTenants,
            suspendedRelationships,
            openFulfillmentExceptions,
            failedShipments,
            returnedShipments,
            failedOutboxEvents,
            openServiceDisputes,
            openServiceClaims,
            pendingServiceReviews,
            currentRole
        );
        return new AdminPlatformSummaryResponse(
            tenantRepository.count(),
            suspendedTenants,
            userRepository.count(),
            userRepository.countByEnabledTrue(),
            userRepository.countByRoleIn(PLATFORM_ADMIN_ROLES),
            pendingAccessRequests,
            relationshipRepository.countByStatus(MerchantWarehouseRelationshipStatus.ACTIVE),
            suspendedRelationships,
            inboundRepository.countByStatusIn(Set.of(
                InboundStockRequestStatus.SUBMITTED,
                InboundStockRequestStatus.APPROVED,
                InboundStockRequestStatus.RECEIVING
            )),
            openFulfillmentExceptions,
            failedShipments,
            returnedShipments,
            failedOutboxEvents,
            openServiceDisputes,
            openServiceClaims,
            pendingServiceReviews,
            attentionSignals
        );
    }

    @Transactional(readOnly = true)
    public List<AdminTenantHealthResponse> tenantHealth() {
        return tenantRepository.findAll().stream()
            .map(this::tenantHealth)
            .toList();
    }

    @Transactional(readOnly = true)
    public AdminTenantHealthResponse tenantHealth(UUID tenantId) {
        return tenantHealth(tenantService.getRequired(tenantId));
    }

    @Transactional(readOnly = true)
    public List<AdminAuditEventResponse> auditEvents(int limit) {
        return adminAuditService.recentEvents(limit).stream()
            .map(AdminAuditEventResponse::from)
            .toList();
    }

    private AdminTenantHealthResponse tenantHealth(Tenant tenant) {
        UUID tenantId = tenant.getId();
        return new AdminTenantHealthResponse(
            TenantResponse.from(tenant),
            userRepository.countByTenantId(tenantId),
            relationshipRepository.countByMerchantIdOrWarehouseProviderId(tenantId, tenantId),
            warehouseRepository.countByTenantId(tenantId),
            tenant.getType() == TenantType.MERCHANT ? inventoryItemRepository.countByMerchantId(tenantId) : 0,
            tenant.getType() == TenantType.MERCHANT
                ? inboundRepository.countByMerchantId(tenantId)
                : inboundRepository.countByWarehouseProviderId(tenantId),
            tenant.getType() == TenantType.MERCHANT ? orderRepository.countByMerchantId(tenantId) : 0,
            tenant.getType() == TenantType.WAREHOUSE_PROVIDER
                ? allocationRepository.countByWarehouseTenantId(tenantId)
                : 0,
            tenant.getType() == TenantType.MERCHANT
                ? statementRepository.countByMerchantId(tenantId)
                : statementRepository.countByWarehouseProviderId(tenantId),
            tenant.getType() == TenantType.MERCHANT
                ? disputeRepository.countByMerchantIdAndStatus(tenantId, ServiceDisputeStatus.OPEN)
                : disputeRepository.countByWarehouseProviderIdAndStatus(tenantId, ServiceDisputeStatus.OPEN),
            tenant.getType() == TenantType.MERCHANT
                ? claimRepository.countByMerchantIdAndStatus(tenantId, ServiceClaimStatus.OPEN)
                : claimRepository.countByWarehouseProviderIdAndStatus(tenantId, ServiceClaimStatus.OPEN),
            tenant.getType() == TenantType.MERCHANT
                ? reviewRepository.countByMerchantIdAndStatus(tenantId, ServiceReviewStatus.PENDING)
                : reviewRepository.countByWarehouseProviderIdAndStatus(tenantId, ServiceReviewStatus.PENDING)
        );
    }

    private List<AttentionSignalResponse> adminAttentionSignals(
        long pendingAccessRequests,
        long suspendedTenants,
        long suspendedRelationships,
        long openFulfillmentExceptions,
        long failedShipments,
        long returnedShipments,
        long failedOutboxEvents,
        long openServiceDisputes,
        long openServiceClaims,
        long pendingServiceReviews,
        UserRole currentRole
    ) {
        List<AttentionSignalResponse> signals = new ArrayList<>();
        Instant now = Instant.now();
        if (currentRole != UserRole.AUDITOR) {
            addCountSignal(
                signals,
                pendingAccessRequests,
                "admin-access-requests",
                currentRole.canMutatePlatform() ? AttentionSeverity.ACTION_NEEDED : AttentionSeverity.REVIEW,
                "Access requests need review",
                currentRole.canMutatePlatform()
                    ? "Pending onboarding requests are waiting on platform approval."
                    : "Pending onboarding requests are waiting on owner/admin approval; support can review context and escalate.",
                currentRole.canMutatePlatform() ? "Review requests" : "Review and escalate",
                "/admin/access-requests",
                "AccessRequest",
                now,
                currentRole.canMutatePlatform() ? UserRole.ADMIN : currentRole
            );
        }
        addCountSignal(signals, failedOutboxEvents, "admin-failed-outbox", AttentionSeverity.CRITICAL,
            "Outbox failures need reliability review",
            currentRole.canMutatePlatform()
                ? "Failed integration work is waiting for retry or dead-letter handling."
                : "Failed integration work needs owner/admin retry or dead-letter handling; review diagnostics before escalation.",
            currentRole.canMutatePlatform() ? "Open outbox diagnostics" : "Review diagnostics",
            "/admin/outbox", "OutboxEvent", now, currentRole.canMutatePlatform() ? UserRole.ADMIN : currentRole);
        addCountSignal(signals, openServiceDisputes + openServiceClaims + pendingServiceReviews, "admin-service-risks", AttentionSeverity.ACTION_NEEDED,
            "Service accountability risks are open", "Open disputes, claims, or pending reviews need a platform-readable decision trail.",
            "Open service review", "/service-accountability", "ServiceAccountability", now, currentRole);
        addCountSignal(signals, suspendedTenants + suspendedRelationships, "admin-suspended-governance", AttentionSeverity.REVIEW,
            "Suspended governance needs context", "Suspended tenants or relationships should be reviewed before daily operators depend on them.",
            "Review relationships", "/admin/relationships", "MerchantWarehouseRelationship", now, currentRole);
        addCountSignal(signals, openFulfillmentExceptions, "admin-fulfillment-exceptions", AttentionSeverity.CRITICAL,
            "Fulfillment exceptions need operational follow-up", "Open exceptions should be resolved through the service and workflow surfaces, not hidden in audit history.",
            "Open service review", "/service-accountability", "FulfillmentException", now, currentRole);
        addCountSignal(signals, failedShipments + returnedShipments, "admin-delivery-failures", AttentionSeverity.CRITICAL,
            "Delivery failures need service follow-up", "Failed or returned shipments should be inspected through operational detail and service accountability.",
            "Open service review", "/service-accountability", "Shipment", now, currentRole);
        return signals;
    }

    private void addCountSignal(
        List<AttentionSignalResponse> signals,
        long count,
        String id,
        AttentionSeverity severity,
        String title,
        String body,
        String nextActionLabel,
        String route,
        String sourceType,
        Instant createdAt,
        UserRole ownerRole
    ) {
        if (count <= 0) {
            return;
        }
        signals.add(AttentionSignalFactory.signal(
            id,
            severity,
            title,
            count + " " + body,
            ownerRole,
            nextActionLabel,
            route,
            sourceType,
            null,
            createdAt
        ));
    }
}
