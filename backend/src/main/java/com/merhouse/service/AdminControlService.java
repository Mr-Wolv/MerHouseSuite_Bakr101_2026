package com.merhouse.service;

import com.merhouse.dto.AdminAuditEventResponse;
import com.merhouse.dto.AdminPlatformSummaryResponse;
import com.merhouse.dto.AdminTenantHealthResponse;
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
        AdminAuditService adminAuditService
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
    }

    @Transactional(readOnly = true)
    public AdminPlatformSummaryResponse summary() {
        return new AdminPlatformSummaryResponse(
            tenantRepository.count(),
            tenantRepository.countByActiveFalse(),
            userRepository.count(),
            userRepository.countByEnabledTrue(),
            userRepository.countByRoleIn(PLATFORM_ADMIN_ROLES),
            accessRequestRepository.countByStatus(AccessRequestStatus.PENDING),
            relationshipRepository.countByStatus(MerchantWarehouseRelationshipStatus.ACTIVE),
            relationshipRepository.countByStatus(MerchantWarehouseRelationshipStatus.SUSPENDED),
            inboundRepository.countByStatusIn(Set.of(
                InboundStockRequestStatus.SUBMITTED,
                InboundStockRequestStatus.APPROVED,
                InboundStockRequestStatus.RECEIVING
            )),
            exceptionRepository.countByStatus("OPEN"),
            shipmentRepository.countByStatus(ShipmentStatus.FAILED),
            shipmentRepository.countByStatus(ShipmentStatus.RETURNED),
            outboxRepository.countByStatus(OutboxEventStatus.FAILED),
            disputeRepository.countByStatus(ServiceDisputeStatus.OPEN),
            claimRepository.countByStatus(ServiceClaimStatus.OPEN),
            reviewRepository.countByStatus(ServiceReviewStatus.PENDING)
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
}
