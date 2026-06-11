package com.merhouse.service;

import com.merhouse.dto.DashboardSummaryResponse;
import com.merhouse.dto.AttentionSeverity;
import com.merhouse.dto.AttentionSignalResponse;
import com.merhouse.entity.BackorderStatus;
import com.merhouse.entity.FulfillmentStatus;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
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
        List<AttentionSignalResponse> attentionSignals = new ArrayList<>();
        if (openBackorders > 0) {
            attentionSignals.add(AttentionSignalFactory.signal(
                "merchant-open-backorders",
                AttentionSeverity.ACTION_NEEDED,
                "Backorders need stock or allocation review",
                openBackorders + " open backorder records are waiting on stock, allocation, or fulfillment recovery.",
                UserRole.MERCHANT,
                "Review orders",
                "/merchant/orders",
                "CustomerOrder",
                null,
                null
            ));
        }
        inboundRepository.findByMerchantIdOrderByCreatedAtDesc(effectiveMerchantId).stream()
            .filter(inbound -> inbound.getStatus() == InboundStockRequestStatus.REJECTED
                || inbound.getStatus() == InboundStockRequestStatus.RECEIVING)
            .limit(3)
            .forEach(inbound -> attentionSignals.add(AttentionSignalFactory.signal(
                "merchant-inbound-" + inbound.getId(),
                inbound.getStatus() == InboundStockRequestStatus.REJECTED ? AttentionSeverity.CRITICAL : AttentionSeverity.REVIEW,
                inbound.getStatus() == InboundStockRequestStatus.REJECTED ? "Inbound request rejected" : "Inbound receiving in progress",
                inbound.getInventoryItem().getSku() + " is " + inbound.getStatus() + " with " + inbound.getWarehouseProvider().getName() + ".",
                UserRole.MERCHANT,
                "Open inbound detail",
                "/inbound-stock-requests/" + inbound.getId(),
                "InboundStockRequest",
                inbound.getId(),
                inbound.getUpdatedAt()
            )));
        exceptionRepository.findByMerchantIdOrderByCreatedAtDesc(effectiveMerchantId).stream()
            .filter(exception -> "OPEN".equals(exception.getStatus()))
            .limit(3)
            .forEach(exception -> attentionSignals.add(AttentionSignalFactory.signal(
                "merchant-exception-" + exception.getId(),
                AttentionSeverity.CRITICAL,
                "Fulfillment exception needs review",
                exception.getReasonCode() + ": " + exception.getDescription(),
                UserRole.MERCHANT,
                "Review service impact",
                "/service-accountability",
                "FulfillmentException",
                exception.getId(),
                exception.getCreatedAt()
            )));
        return new DashboardSummaryResponse(
            orders.size(),
            openBackorders,
            delivered,
            inboundOpen,
            stockRisk,
            openExceptions,
            newestFirst(attentionSignals)
        );
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse warehouseSummary(UUID warehouseProviderId) {
        UUID tenantId = currentUserService.isAdmin() ? warehouseProviderId : currentUserService.required().tenantId();
        if (tenantId == null) {
            throw new DomainConflictException("Warehouse dashboard requires warehouseProviderId for admin users.");
        }
        var inbound = inboundRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId);
        var allocations = orderRepository.findAll().stream()
            .flatMap(order -> order.getAllocations().stream())
            .filter(allocation -> allocation.getWarehouse().getTenant().getId().equals(tenantId))
            .toList();
        long openInbound = inbound.stream()
            .filter(row -> row.getStatus() == InboundStockRequestStatus.SUBMITTED
                || row.getStatus() == InboundStockRequestStatus.APPROVED
                || row.getStatus() == InboundStockRequestStatus.RECEIVING)
            .count();
        long openExceptions = exceptionRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream()
            .filter(exception -> "OPEN".equals(exception.getStatus()))
            .count();
        long delivered = allocations.stream()
            .filter(allocation -> allocation.getOrder().getStatus() == OrderStatus.DELIVERED)
            .count();
        long workload = allocations.stream()
            .filter(allocation -> allocation.getShipment() == null || allocation.getShipment().getStatus() == ShipmentStatus.IN_TRANSIT)
            .count();
        List<AttentionSignalResponse> attentionSignals = new ArrayList<>();
        inbound.stream()
            .filter(row -> row.getStatus() == InboundStockRequestStatus.SUBMITTED
                || row.getStatus() == InboundStockRequestStatus.APPROVED
                || row.getStatus() == InboundStockRequestStatus.RECEIVING)
            .limit(3)
            .forEach(row -> attentionSignals.add(AttentionSignalFactory.signal(
                "warehouse-inbound-" + row.getId(),
                row.getStatus() == InboundStockRequestStatus.SUBMITTED ? AttentionSeverity.ACTION_NEEDED : AttentionSeverity.REVIEW,
                row.getStatus() == InboundStockRequestStatus.SUBMITTED ? "Inbound request needs review" : "Inbound stock needs receiving",
                row.getInventoryItem().getSku() + " from " + row.getMerchant().getName() + " is " + row.getStatus() + ".",
                UserRole.WAREHOUSE_OPERATOR,
                "Open inbound detail",
                "/inbound-stock-requests/" + row.getId(),
                "InboundStockRequest",
                row.getId(),
                row.getUpdatedAt()
            )));
        allocations.stream()
            .filter(allocation -> allocation.getStatus() == FulfillmentStatus.PENDING
                || allocation.getStatus() == FulfillmentStatus.PICKING
                || allocation.getStatus() == FulfillmentStatus.PACKED)
            .limit(3)
            .forEach(allocation -> attentionSignals.add(AttentionSignalFactory.signal(
                "warehouse-allocation-" + allocation.getId(),
                AttentionSeverity.ACTION_NEEDED,
                "Fulfillment work is waiting",
                "Order " + allocation.getOrder().getId().toString().substring(0, 8) + " is " + allocation.getStatus() + ".",
                UserRole.WAREHOUSE_OPERATOR,
                "Open allocation detail",
                "/fulfillment-allocations/" + allocation.getId(),
                "FulfillmentAllocation",
                allocation.getId(),
                allocation.getCreatedAt()
            )));
        exceptionRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(tenantId).stream()
            .filter(exception -> "OPEN".equals(exception.getStatus()))
            .limit(3)
            .forEach(exception -> attentionSignals.add(AttentionSignalFactory.signal(
                "warehouse-exception-" + exception.getId(),
                AttentionSeverity.CRITICAL,
                "Open exception needs resolution",
                exception.getReasonCode() + ": " + exception.getDescription(),
                UserRole.WAREHOUSE_OPERATOR,
                "Review service impact",
                "/service-accountability",
                "FulfillmentException",
                exception.getId(),
                exception.getCreatedAt()
            )));
        return new DashboardSummaryResponse(workload, 0, delivered, openInbound, 0, openExceptions, newestFirst(attentionSignals));
    }

    private List<AttentionSignalResponse> newestFirst(List<AttentionSignalResponse> signals) {
        return signals.stream()
            .sorted(Comparator.comparing(AttentionSignalResponse::createdAt).reversed())
            .limit(8)
            .toList();
    }
}
