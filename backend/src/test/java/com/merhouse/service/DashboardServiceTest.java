package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.BackorderItem;
import com.merhouse.entity.BackorderStatus;
import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.FulfillmentException;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.InboundStockRequest;
import com.merhouse.entity.InboundStockRequestStatus;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.OrderStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.entity.Warehouse;
import com.merhouse.entity.WarehouseInventory;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.FulfillmentExceptionRepository;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.WarehouseInventoryRepository;
import com.merhouse.security.UserPrincipal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class DashboardServiceTest {
    private final CustomerOrderRepository orderRepository = mock(CustomerOrderRepository.class);
    private final InboundStockRequestRepository inboundRepository = mock(InboundStockRequestRepository.class);
    private final WarehouseInventoryRepository inventoryRepository = mock(WarehouseInventoryRepository.class);
    private final FulfillmentExceptionRepository exceptionRepository = mock(FulfillmentExceptionRepository.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final DashboardService service = new DashboardService(
        orderRepository,
        inboundRepository,
        inventoryRepository,
        exceptionRepository,
        currentUserService
    );

    @Test
    void merchantSummaryExposesAttentionSignalsForMerchantOwnedBlockers() {
        UUID merchantId = UUID.randomUUID();
        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(
            new UserPrincipal(UUID.randomUUID(), merchantId, "merchant@merhouse.local", UserRole.MERCHANT, true)
        );
        when(currentUserService.hasRole(UserRole.MERCHANT)).thenReturn(true);

        CustomerOrder backorderedOrder = new CustomerOrder();
        backorderedOrder.setStatus(OrderStatus.BACKORDERED);
        BackorderItem backorder = new BackorderItem();
        backorder.setQuantity(3);
        backorder.setStatus(BackorderStatus.OPEN);
        backorderedOrder.addBackorder(backorder);
        when(orderRepository.findByMerchantId(merchantId)).thenReturn(List.of(backorderedOrder));

        InboundStockRequest rejectedInbound = inbound(merchantId, InboundStockRequestStatus.REJECTED, "SKU-REJECTED");
        InboundStockRequest receivingInbound = inbound(merchantId, InboundStockRequestStatus.RECEIVING, "SKU-RECEIVING");
        when(inboundRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId)).thenReturn(List.of(
            rejectedInbound,
            receivingInbound
        ));

        InventoryItem stockRiskItem = new InventoryItem();
        ReflectionTestUtils.setField(stockRiskItem, "id", UUID.randomUUID());
        stockRiskItem.setMerchant(tenant(merchantId, TenantType.MERCHANT, "Merchant"));
        stockRiskItem.setSku("SKU-RISK");
        stockRiskItem.setName("Risk item");
        Warehouse warehouse = new Warehouse();
        ReflectionTestUtils.setField(warehouse, "id", UUID.randomUUID());
        warehouse.setTenant(tenant(UUID.randomUUID(), TenantType.WAREHOUSE_PROVIDER, "Warehouse"));
        warehouse.setName("Risk warehouse");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(100);
        WarehouseInventory stockRisk = new WarehouseInventory(warehouse, stockRiskItem);
        stockRisk.setQuantity(4);
        stockRisk.setReservedQuantity(2);
        when(inventoryRepository.findAuthorizedActiveStockForMerchant(merchantId)).thenReturn(List.of(stockRisk));

        FulfillmentException exception = new FulfillmentException();
        ReflectionTestUtils.setField(exception, "id", UUID.randomUUID());
        exception.setReasonCode("SHORT_PICK");
        exception.setDescription("Warehouse reported a short pick.");
        exception.setStatus("OPEN");
        ReflectionTestUtils.setField(exception, "createdAt", Instant.parse("2026-06-07T10:00:00Z"));
        when(exceptionRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId)).thenReturn(List.of(exception));

        var response = service.merchantSummary(null);

        assertEquals(1, response.orders());
        assertEquals(1, response.openBackorders());
        assertEquals(1, response.inboundOpen());
        assertEquals(1, response.stockRisk());
        assertEquals(1, response.openExceptions());
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Backorders need stock or allocation review")
                && signal.route().equals("/merchant/orders")
                && signal.ownerRole() == UserRole.MERCHANT));
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Inbound request rejected")
                && signal.route().equals("/inbound-stock-requests/" + rejectedInbound.getId())));
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Inbound receiving in progress")
                && signal.route().equals("/inbound-stock-requests/" + receivingInbound.getId())));
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Fulfillment exception needs review")
                && signal.route().equals("/service-accountability")));
        verify(currentUserService).requireAdminOrTenant(merchantId);
    }

    @Test
    void warehouseSummaryExposesAttentionSignalsForWarehouseOwnedWork() {
        UUID warehouseProviderId = UUID.randomUUID();
        Tenant warehouseProvider = tenant(warehouseProviderId, TenantType.WAREHOUSE_PROVIDER, "Warehouse Provider");
        Tenant merchant = tenant(UUID.randomUUID(), TenantType.MERCHANT, "Merchant");
        Warehouse warehouse = new Warehouse();
        ReflectionTestUtils.setField(warehouse, "id", UUID.randomUUID());
        warehouse.setTenant(warehouseProvider);
        warehouse.setName("Main Warehouse");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(100);

        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(
            new UserPrincipal(UUID.randomUUID(), warehouseProviderId, "operator@merhouse.local", UserRole.WAREHOUSE_OPERATOR, true)
        );

        InboundStockRequest inbound = inboundForWarehouse(
            warehouseProvider,
            merchant,
            warehouse,
            InboundStockRequestStatus.SUBMITTED,
            "SKU-INBOUND"
        );
        when(inboundRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(warehouseProviderId)).thenReturn(List.of(inbound));

        CustomerOrder order = new CustomerOrder();
        ReflectionTestUtils.setField(order, "id", UUID.randomUUID());
        order.setMerchant(merchant);
        order.setStatus(OrderStatus.ALLOCATED);
        order.setCustomerAddress("Cairo Customer");
        FulfillmentAllocation allocation = new FulfillmentAllocation();
        ReflectionTestUtils.setField(allocation, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(allocation, "createdAt", Instant.parse("2026-06-07T11:00:00Z"));
        allocation.setWarehouse(warehouse);
        allocation.setStatus(FulfillmentStatus.PENDING);
        order.addAllocation(allocation);
        when(orderRepository.findAll()).thenReturn(List.of(order));

        FulfillmentException exception = new FulfillmentException();
        ReflectionTestUtils.setField(exception, "id", UUID.randomUUID());
        exception.setMerchant(merchant);
        exception.setWarehouseProvider(warehouseProvider);
        exception.setReasonCode("DAMAGED_ITEM");
        exception.setDescription("Damaged item needs review.");
        exception.setStatus("OPEN");
        ReflectionTestUtils.setField(exception, "createdAt", Instant.parse("2026-06-07T12:00:00Z"));
        when(exceptionRepository.findByWarehouseProviderIdOrderByCreatedAtDesc(warehouseProviderId)).thenReturn(List.of(exception));

        var response = service.warehouseSummary(null);

        assertEquals(1, response.orders());
        assertEquals(1, response.inboundOpen());
        assertEquals(1, response.openExceptions());
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Inbound request needs review")
                && signal.route().equals("/inbound-stock-requests/" + inbound.getId())
                && signal.ownerRole() == UserRole.WAREHOUSE_OPERATOR));
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Fulfillment work is waiting")
                && signal.route().equals("/fulfillment-allocations/" + allocation.getId())));
        assertTrue(response.attentionSignals().stream()
            .anyMatch(signal -> signal.title().equals("Open exception needs resolution")
                && signal.route().equals("/service-accountability")));
    }

    private InboundStockRequest inbound(UUID merchantId, InboundStockRequestStatus status, String sku) {
        Tenant merchant = tenant(merchantId, TenantType.MERCHANT, "Merchant");
        Tenant warehouseProvider = tenant(UUID.randomUUID(), TenantType.WAREHOUSE_PROVIDER, "Cairo Hub");
        InventoryItem item = new InventoryItem();
        ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
        item.setMerchant(merchant);
        item.setSku(sku);
        item.setName(sku);

        InboundStockRequest inbound = new InboundStockRequest();
        ReflectionTestUtils.setField(inbound, "id", UUID.randomUUID());
        inbound.setMerchant(merchant);
        inbound.setWarehouseProvider(warehouseProvider);
        inbound.setInventoryItem(item);
        inbound.setStatus(status);
        ReflectionTestUtils.setField(inbound, "updatedAt", Instant.parse("2026-06-07T10:00:00Z"));
        return inbound;
    }

    private InboundStockRequest inboundForWarehouse(
        Tenant warehouseProvider,
        Tenant merchant,
        Warehouse warehouse,
        InboundStockRequestStatus status,
        String sku
    ) {
        InventoryItem item = new InventoryItem();
        ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
        item.setMerchant(merchant);
        item.setSku(sku);
        item.setName(sku);

        InboundStockRequest inbound = new InboundStockRequest();
        ReflectionTestUtils.setField(inbound, "id", UUID.randomUUID());
        inbound.setMerchant(merchant);
        inbound.setWarehouseProvider(warehouseProvider);
        inbound.setWarehouse(warehouse);
        inbound.setInventoryItem(item);
        inbound.setStatus(status);
        ReflectionTestUtils.setField(inbound, "updatedAt", Instant.parse("2026-06-07T10:30:00Z"));
        return inbound;
    }

    private Tenant tenant(UUID id, TenantType type, String name) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", id);
        tenant.setType(type);
        tenant.setName(name);
        return tenant;
    }
}
