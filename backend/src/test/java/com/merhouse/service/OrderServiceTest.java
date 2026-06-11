package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.BackorderItem;
import com.merhouse.dto.CreateCustomerContactRequest;
import com.merhouse.entity.CustomerContact;
import com.merhouse.entity.BackorderStatus;
import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentAllocationItem;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.OrderItem;
import com.merhouse.entity.OrderStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.Warehouse;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.BackorderItemRepository;
import com.merhouse.repository.CustomerContactRepository;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.FulfillmentAllocationRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class OrderServiceTest {
    private final TenantService tenantService = mock(TenantService.class);
    private final InventoryService inventoryService = mock(InventoryService.class);
    private final CustomerOrderRepository orderRepository = mock(CustomerOrderRepository.class);
    private final CustomerContactRepository customerContactRepository = mock(CustomerContactRepository.class);
    private final FulfillmentAllocationRepository allocationRepository = mock(FulfillmentAllocationRepository.class);
    private final BackorderItemRepository backorderRepository = mock(BackorderItemRepository.class);
    private final OutboxService outboxService = mock(OutboxService.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final OrderService orderService = new OrderService(
        tenantService,
        inventoryService,
        orderRepository,
        customerContactRepository,
        allocationRepository,
        backorderRepository,
        outboxService,
        currentUserService
    );

    @Test
    void allocateCreatesFulfillmentAllocationWhenAllRequestedStockIsAvailable() {
        UUID orderId = UUID.randomUUID();
        Tenant merchant = merchant();
        InventoryItem item = item(merchant);
        CustomerOrder order = createdOrder(orderId, merchant, item, 5);
        Warehouse warehouse = warehouse();

        when(orderRepository.findWithDetailsById(orderId)).thenReturn(Optional.of(order));
        when(allocationRepository.existsByOrderId(orderId)).thenReturn(false);
        when(inventoryService.reserveAvailableAcrossWarehouses(item, 5))
            .thenReturn(List.of(new AllocationReservation(warehouse, item, 5)));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.allocate(orderId);

        assertEquals(OrderStatus.ALLOCATED, order.getStatus());
        assertEquals(1, order.getAllocations().size());
        FulfillmentAllocation allocation = order.getAllocations().iterator().next();
        assertEquals(FulfillmentStatus.PENDING, allocation.getStatus());
        assertEquals(warehouse.getId(), allocation.getWarehouse().getId());
        assertEquals(1, allocation.getItems().size());
        assertEquals(0, order.getBackorders().size());
        verify(outboxService).publish(eq("OrderAllocated"), eq("CustomerOrder"), eq(orderId), any());
    }

    @Test
    void allocateCreatesPartialAllocationAndBackorderForUnfilledRemainder() {
        UUID orderId = UUID.randomUUID();
        Tenant merchant = merchant();
        InventoryItem item = item(merchant);
        CustomerOrder order = createdOrder(orderId, merchant, item, 5);
        Warehouse warehouse = warehouse();

        when(orderRepository.findWithDetailsById(orderId)).thenReturn(Optional.of(order));
        when(allocationRepository.existsByOrderId(orderId)).thenReturn(false);
        when(inventoryService.reserveAvailableAcrossWarehouses(item, 5))
            .thenReturn(List.of(new AllocationReservation(warehouse, item, 2)));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.allocate(orderId);

        assertEquals(OrderStatus.PARTIALLY_ALLOCATED, order.getStatus());
        assertEquals(1, order.getAllocations().size());
        assertEquals(1, order.getBackorders().size());
        BackorderItem backorder = order.getBackorders().iterator().next();
        assertEquals(3, backorder.getQuantity());
        assertEquals(BackorderStatus.OPEN, backorder.getStatus());
    }

    @Test
    void allocateCreatesBackorderOnlyWhenNoStockIsAvailable() {
        UUID orderId = UUID.randomUUID();
        Tenant merchant = merchant();
        InventoryItem item = item(merchant);
        CustomerOrder order = createdOrder(orderId, merchant, item, 5);

        when(orderRepository.findWithDetailsById(orderId)).thenReturn(Optional.of(order));
        when(allocationRepository.existsByOrderId(orderId)).thenReturn(false);
        when(inventoryService.reserveAvailableAcrossWarehouses(item, 5)).thenReturn(List.of());
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.allocate(orderId);

        assertEquals(OrderStatus.BACKORDERED, order.getStatus());
        assertEquals(0, order.getAllocations().size());
        assertEquals(1, order.getBackorders().size());
        assertEquals(5, order.getBackorders().iterator().next().getQuantity());
    }

    @Test
    void cancelPartiallyAllocatedOrderReleasesReservationsAndCancelsOpenBackorders() {
        UUID orderId = UUID.randomUUID();
        Tenant merchant = merchant();
        InventoryItem item = item(merchant);
        CustomerOrder order = createdOrder(orderId, merchant, item, 5);
        order.setStatus(OrderStatus.PARTIALLY_ALLOCATED);

        FulfillmentAllocation allocation = new FulfillmentAllocation();
        ReflectionTestUtils.setField(allocation, "id", UUID.randomUUID());
        allocation.setWarehouse(warehouse());
        allocation.setStatus(FulfillmentStatus.PENDING);
        FulfillmentAllocationItem allocationItem = new FulfillmentAllocationItem();
        allocationItem.setInventoryItem(item);
        allocationItem.setQuantity(2);
        allocation.addItem(allocationItem);
        order.addAllocation(allocation);

        BackorderItem backorder = new BackorderItem();
        ReflectionTestUtils.setField(backorder, "id", UUID.randomUUID());
        backorder.setInventoryItem(item);
        backorder.setQuantity(3);
        backorder.setStatus(BackorderStatus.OPEN);
        order.addBackorder(backorder);

        when(orderRepository.findWithDetailsById(orderId)).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.cancel(orderId);

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertEquals(FulfillmentStatus.CANCELLED, allocation.getStatus());
        assertEquals(BackorderStatus.CANCELLED, backorder.getStatus());
        verify(inventoryService).releaseReservedStock(
            eq(allocation.getWarehouse().getId()),
            eq(Map.of(item.getId(), 2))
        );
        verify(outboxService).publish(eq("OrderCancelled"), eq("CustomerOrder"), eq(orderId), any());
    }

    @Test
    void updateBackorderCanFulfillOpenBackorderWithoutSynthesizingAllocation() {
        UUID orderId = UUID.randomUUID();
        UUID backorderId = UUID.randomUUID();
        CustomerOrder order = backorderedOrder(orderId, backorderId, BackorderStatus.OPEN);
        BackorderItem backorder = order.getBackorders().iterator().next();

        when(backorderRepository.findWithDetailsById(backorderId)).thenReturn(Optional.of(backorder));
        when(orderRepository.findWithDetailsById(orderId)).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.updateBackorder(orderId, backorderId, BackorderStatus.FULFILLED);

        assertEquals(BackorderStatus.FULFILLED, backorder.getStatus());
        assertEquals(OrderStatus.BACKORDERED, order.getStatus());
        assertEquals(0, order.getAllocations().size());
        verify(currentUserService).requireAdminOrTenant(order.getMerchant().getId());
        verify(outboxService).publish(eq("BackorderFulfilled"), eq("BackorderItem"), eq(backorderId), any());
    }

    @Test
    void updateBackorderCanCancelOpenBackorderWithoutAllocatingTheOrder() {
        UUID orderId = UUID.randomUUID();
        UUID backorderId = UUID.randomUUID();
        CustomerOrder order = backorderedOrder(orderId, backorderId, BackorderStatus.OPEN);
        BackorderItem backorder = order.getBackorders().iterator().next();

        when(backorderRepository.findWithDetailsById(backorderId)).thenReturn(Optional.of(backorder));
        when(orderRepository.findWithDetailsById(orderId)).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.updateBackorder(orderId, backorderId, BackorderStatus.CANCELLED);

        assertEquals(BackorderStatus.CANCELLED, backorder.getStatus());
        assertEquals(OrderStatus.BACKORDERED, order.getStatus());
        verify(outboxService).publish(eq("BackorderCancelled"), eq("BackorderItem"), eq(backorderId), any());
    }

    @Test
    void updateBackorderRejectsClosedBackorderTransitions() {
        UUID orderId = UUID.randomUUID();
        UUID backorderId = UUID.randomUUID();
        CustomerOrder order = backorderedOrder(orderId, backorderId, BackorderStatus.CANCELLED);
        BackorderItem backorder = order.getBackorders().iterator().next();

        when(backorderRepository.findWithDetailsById(backorderId)).thenReturn(Optional.of(backorder));
        when(orderRepository.findWithDetailsById(orderId)).thenReturn(Optional.of(order));

        assertThrows(DomainConflictException.class, () ->
            orderService.updateBackorder(orderId, backorderId, BackorderStatus.FULFILLED)
        );
        verify(orderRepository, never()).saveAndFlush(any());
        verify(outboxService, never()).publish(any(), any(), any(), any());
    }

    @Test
    void customerContactsAreMerchantScopedAndReturnedForOrderDrafting() {
        Tenant merchant = merchant();
        CustomerContact contact = new CustomerContact();
        ReflectionTestUtils.setField(contact, "id", UUID.randomUUID());
        contact.setMerchant(merchant);
        contact.setLabel("Main Cairo receiver");
        contact.setContactName("Cairo Customer");
        contact.setPhone("12345");
        contact.setAddress("Cairo Dock 4");

        when(tenantService.getRequired(merchant.getId())).thenReturn(merchant);
        when(customerContactRepository.saveAndFlush(any(CustomerContact.class))).thenReturn(contact);
        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(new com.merhouse.security.UserPrincipal(
            UUID.randomUUID(),
            merchant.getId(),
            "merchant@example.test",
            com.merhouse.entity.UserRole.MERCHANT,
            true
        ));
        when(customerContactRepository.findByMerchantIdOrderByCreatedAtDesc(merchant.getId())).thenReturn(List.of(contact));

        var created = orderService.createCustomerContact(new CreateCustomerContactRequest(
            merchant.getId(),
            " Main Cairo receiver ",
            " Cairo Customer ",
            " 12345 ",
            " Cairo Dock 4 "
        ));
        var rows = orderService.findCustomerContacts(null);

        assertEquals(contact.getId(), created.id());
        assertEquals("Main Cairo receiver", created.label());
        assertEquals(1, rows.size());
        assertEquals("Cairo Dock 4", rows.get(0).address());
        verify(currentUserService).requireAdminOrTenant(merchant.getId());
    }

    private CustomerOrder backorderedOrder(UUID orderId, UUID backorderId, BackorderStatus backorderStatus) {
        Tenant merchant = merchant();
        InventoryItem item = item(merchant);

        CustomerOrder order = new CustomerOrder();
        ReflectionTestUtils.setField(order, "id", orderId);
        order.setMerchant(merchant);
        order.setCustomerAddress("Customer");
        order.setStatus(OrderStatus.BACKORDERED);

        BackorderItem backorder = new BackorderItem();
        ReflectionTestUtils.setField(backorder, "id", backorderId);
        backorder.setInventoryItem(item);
        backorder.setQuantity(5);
        backorder.setStatus(backorderStatus);
        order.addBackorder(backorder);
        return order;
    }

    private CustomerOrder createdOrder(UUID orderId, Tenant merchant, InventoryItem item, int quantity) {
        CustomerOrder order = new CustomerOrder();
        ReflectionTestUtils.setField(order, "id", orderId);
        order.setMerchant(merchant);
        order.setCustomerAddress("Customer");
        order.setStatus(OrderStatus.CREATED);

        OrderItem orderItem = new OrderItem();
        ReflectionTestUtils.setField(orderItem, "id", UUID.randomUUID());
        orderItem.setInventoryItem(item);
        orderItem.setQuantity(quantity);
        order.addItem(orderItem);
        return order;
    }

    private Tenant merchant() {
        Tenant merchant = new Tenant();
        ReflectionTestUtils.setField(merchant, "id", UUID.randomUUID());
        merchant.setName("Merchant");
        merchant.setType(TenantType.MERCHANT);
        return merchant;
    }

    private InventoryItem item(Tenant merchant) {
        InventoryItem item = new InventoryItem();
        ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
        item.setMerchant(merchant);
        item.setSku("SKU-1");
        item.setName("Merchant Item");
        return item;
    }

    private Warehouse warehouse() {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setName("Warehouse Tenant");
        tenant.setType(TenantType.WAREHOUSE_PROVIDER);

        Warehouse warehouse = new Warehouse();
        ReflectionTestUtils.setField(warehouse, "id", UUID.randomUUID());
        warehouse.setTenant(tenant);
        warehouse.setName("Warehouse");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(100);
        return warehouse;
    }
}
