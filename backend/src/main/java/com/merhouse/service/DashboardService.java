package com.merhouse.service;

import com.merhouse.dto.DashboardSummaryResponse;
import com.merhouse.entity.BackorderStatus;
import com.merhouse.entity.InboundStockRequestStatus;
import com.merhouse.entity.OrderStatus;
import com.merhouse.entity.ShipmentStatus;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.FulfillmentExceptionRepository;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.WarehouseInventoryRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {
    private final CustomerOrderRepository orderRepository;
    private final InboundStockRequestRepository inboundRepository;
    private final WarehouseInventoryRepository inventoryRepository;
    private final FulfillmentExceptionRepository exceptionRepository;
    private final CurrentUserService currentUserService;

    public DashboardService(
        CustomerOrderRepository orderRepository,
        InboundStockRequestRepository inboundRepository,
        WarehouseInventoryRepository inventoryRepository,
        FulfillmentExceptionRepository exceptionRepository,
        CurrentUserService currentUserService
    ) {
        this.orderRepository = orderRepository;
        this.inboundRepository = inboundRepository;
        this.inventoryRepository = inventoryRepository;
        this.exceptionRepository = exceptionRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse merchantSummary(UUID merchantId) {
        UUID effectiveMerchantId = currentUserService.isAdmin() ? merchantId : currentUserService.required().tenantId();
        if (effectiveMerchantId == null) {
            throw new DomainConflictException("Merchant dashboard requires merchantId for admin users.");
        }
        if (!currentUserService.isAdmin() && currentUserService.hasRole(UserRole.MERCHANT)) {
            currentUserService.requireAdminOrTenant(effectiveMerchantId);
        }
        var orders = orderRepository.findByMerchantId(effectiveMerchantId);
        long openBackorders = orders.stream().flatMap(order -> order.getBackorders().stream())
            .filter(backorder -> backorder.getStatus() == BackorderStatus.OPEN)
            .count();
        long delivered = orders.stream().filter(order -> order.getStatus() == OrderStatus.DELIVERED).count();
        long inboundOpen = inboundRepository.findByMerchantIdOrderByCreatedAtDesc(effectiveMerchantId).stream()
            .filter(inbound -> inbound.getStatus() == InboundStockRequestStatus.SUBMITTED
                || inbound.getStatus() == InboundStockRequestStatus.APPROVED
                || inbound.getStatus() == InboundStockRequestStatus.RECEIVING)
            .count();
        long stockRisk = inventoryRepository.findAuthorizedActiveStockForMerchant(effectiveMerchantId).stream()
            .filter(row -> row.getQuantity() - row.getReservedQuantity() <= 3)
            .count();
        long openExceptions = exceptionRepository.findByMerchantIdOrderByCreatedAtDesc(effectiveMerchantId).stream()
            .filter(exception -> "OPEN".equals(exception.getStatus()))
            .count();
        return new DashboardSummaryResponse(orders.size(), openBackorders, delivered, inboundOpen, stockRisk, openExceptions);
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse warehouseSummary(UUID warehouseProviderId) {
        UUID tenantId = currentUserService.isAdmin() ? warehouseProviderId : currentUserService.required().tenantId();
        if (tenantId == null) {
            throw new DomainConflictException("Warehouse dashboard requires warehouseProviderId for admin users.");
        }
        var inbound = inboundRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId);
        long openInbound = inbound.stream()
            .filter(row -> row.getStatus() == InboundStockRequestStatus.SUBMITTED
                || row.getStatus() == InboundStockRequestStatus.APPROVED
                || row.getStatus() == InboundStockRequestStatus.RECEIVING)
            .count();
        long openExceptions = exceptionRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream()
            .filter(exception -> "OPEN".equals(exception.getStatus()))
            .count();
        long delivered = orderRepository.findAll().stream()
            .filter(order -> order.getStatus() == OrderStatus.DELIVERED)
            .flatMap(order -> order.getAllocations().stream())
            .filter(allocation -> allocation.getWarehouse().getTenant().getId().equals(tenantId))
            .count();
        long workload = orderRepository.findAll().stream()
            .flatMap(order -> order.getAllocations().stream())
            .filter(allocation -> allocation.getWarehouse().getTenant().getId().equals(tenantId))
            .filter(allocation -> allocation.getShipment() == null || allocation.getShipment().getStatus() == ShipmentStatus.IN_TRANSIT)
            .count();
        return new DashboardSummaryResponse(workload, 0, delivered, openInbound, 0, openExceptions);
    }
}
