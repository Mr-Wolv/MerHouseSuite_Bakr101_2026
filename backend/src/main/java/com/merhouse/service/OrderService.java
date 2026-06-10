package com.merhouse.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.merhouse.dto.CreateOrderItemRequest;
import com.merhouse.dto.CreateOrderRequest;
import com.merhouse.dto.CreateCustomerContactRequest;
import com.merhouse.dto.CustomerContactResponse;
import com.merhouse.dto.OrderResponse;
import com.merhouse.entity.BackorderItem;
import com.merhouse.entity.BackorderStatus;
import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.CustomerContact;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentAllocationItem;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.OrderItem;
import com.merhouse.entity.OrderStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.CustomerContactRepository;
import com.merhouse.repository.FulfillmentAllocationRepository;
import com.merhouse.repository.BackorderItemRepository;

@Service
public class OrderService {
    private final TenantService tenantService;
    private final InventoryService inventoryService;
    private final CustomerOrderRepository orderRepository;
    private final CustomerContactRepository customerContactRepository;
    private final FulfillmentAllocationRepository allocationRepository;
    private final BackorderItemRepository backorderRepository;
    private final OutboxService outboxService;
    private final CurrentUserService currentUserService;

    public OrderService(
        TenantService tenantService,
        InventoryService inventoryService,
        CustomerOrderRepository orderRepository,
        CustomerContactRepository customerContactRepository,
        FulfillmentAllocationRepository allocationRepository,
        BackorderItemRepository backorderRepository,
        OutboxService outboxService,
        CurrentUserService currentUserService
    ) {
        this.tenantService = tenantService;
        this.inventoryService = inventoryService;
        this.orderRepository = orderRepository;
        this.customerContactRepository = customerContactRepository;
        this.allocationRepository = allocationRepository;
        this.backorderRepository = backorderRepository;
        this.outboxService = outboxService;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public CustomerContactResponse createCustomerContact(CreateCustomerContactRequest request) {
        currentUserService.requireAdminOrTenant(request.merchantId());
        Tenant merchant = tenantService.getRequired(request.merchantId());
        CustomerContact contact = new CustomerContact();
        contact.setMerchant(merchant);
        contact.setLabel(request.label().trim());
        contact.setContactName(request.contactName().trim());
        contact.setPhone(request.phone() == null || request.phone().isBlank() ? null : request.phone().trim());
        contact.setAddress(request.address().trim());
        return CustomerContactResponse.from(customerContactRepository.saveAndFlush(contact));
    }

    @Transactional(readOnly = true)
    public List<CustomerContactResponse> findCustomerContacts(UUID merchantId) {
        UUID effectiveMerchantId = merchantId;
        if (!currentUserService.isAdmin()) {
            effectiveMerchantId = currentUserService.required().tenantId();
            if (merchantId != null && !merchantId.equals(effectiveMerchantId)) {
                currentUserService.requireAdminOrTenant(merchantId);
            }
        }
        if (effectiveMerchantId == null) {
            throw new DomainConflictException("Customer contact list requires merchantId.");
        }
        return customerContactRepository.findByMerchantIdOrderByCreatedAtDesc(effectiveMerchantId).stream()
            .map(CustomerContactResponse::from)
            .toList();
    }

    @Transactional
    public OrderResponse create(CreateOrderRequest request) {
        currentUserService.requireAdminOrTenant(request.merchantId());
        Tenant merchant = tenantService.getRequired(request.merchantId());
        CustomerOrder order = new CustomerOrder();
        order.setMerchant(merchant);
        order.setCustomerAddress(request.customerAddress().trim());
        order.setStatus(OrderStatus.CREATED);

        for (CreateOrderItemRequest itemRequest : request.items()) {
            InventoryItem inventoryItem = inventoryService.getRequiredItem(itemRequest.inventoryItemId());
            if (!inventoryItem.getMerchant().getId().equals(merchant.getId())) {
                throw new DomainConflictException("Inventory item does not belong to merchant: " + inventoryItem.getId());
            }

            OrderItem orderItem = new OrderItem();
            orderItem.setInventoryItem(inventoryItem);
            orderItem.setQuantity(itemRequest.quantity());
            order.addItem(orderItem);
        }

        CustomerOrder saved = orderRepository.saveAndFlush(order);
        outboxService.publish(
            "OrderCreated",
            "CustomerOrder",
            saved.getId(),
            Map.of("orderId", saved.getId().toString(), "merchantId", merchant.getId().toString())
        );
        return OrderResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public OrderResponse get(UUID id) {
        CustomerOrder order = getRequiredWithDetails(id);
        requireOrderAccess(order);
        return OrderResponse.from(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> findAll(UUID merchantId) {
        if (!currentUserService.isAdmin()) {
            UUID currentTenantId = currentUserService.required().tenantId();
            if (merchantId != null && !merchantId.equals(currentTenantId)) {
                currentUserService.requireAdminOrTenant(merchantId);
            }
            return orderRepository.findByMerchantId(currentTenantId).stream()
                .map(order -> get(order.getId()))
                .toList();
        }

        List<CustomerOrder> orders = merchantId == null
            ? orderRepository.findAll()
            : orderRepository.findByMerchantId(merchantId);

        return orders.stream()
            .map(order -> get(order.getId()))
            .toList();
    }

    @Transactional
    public OrderResponse allocate(UUID orderId) {
        CustomerOrder order = getRequiredWithDetails(orderId);
        currentUserService.requireAdminOrTenant(order.getMerchant().getId());
        if (order.getStatus() != OrderStatus.CREATED) {
            throw new DomainConflictException("Only CREATED orders can be allocated.");
        }
        if (allocationRepository.existsByOrderId(order.getId())) {
            throw new DomainConflictException("Order already has a fulfillment allocation.");
        }

        List<AllocationReservation> reservations = new ArrayList<>();
        for (OrderItem item : order.getItems()) {
            List<AllocationReservation> itemReservations = inventoryService.reserveAvailableAcrossWarehouses(
                item.getInventoryItem(),
                item.getQuantity()
            );
            reservations.addAll(itemReservations);

            int allocatedQuantity = itemReservations.stream().mapToInt(AllocationReservation::quantity).sum();
            int backorderedQuantity = item.getQuantity() - allocatedQuantity;
            if (backorderedQuantity > 0) {
                BackorderItem backorder = new BackorderItem();
                backorder.setInventoryItem(item.getInventoryItem());
                backorder.setQuantity(backorderedQuantity);
                backorder.setStatus(BackorderStatus.OPEN);
                order.addBackorder(backorder);
            }
        }

        Map<UUID, FulfillmentAllocation> allocationByWarehouseId = new LinkedHashMap<>();
        for (AllocationReservation reservation : reservations) {
            FulfillmentAllocation allocation = allocationByWarehouseId.computeIfAbsent(
                reservation.warehouse().getId(),
                warehouseId -> {
                    FulfillmentAllocation created = new FulfillmentAllocation();
                    created.setWarehouse(reservation.warehouse());
                    created.setStatus(FulfillmentStatus.PENDING);
                    order.addAllocation(created);
                    return created;
                }
            );

            FulfillmentAllocationItem allocationItem = new FulfillmentAllocationItem();
            allocationItem.setInventoryItem(reservation.inventoryItem());
            allocationItem.setQuantity(reservation.quantity());
            allocation.addItem(allocationItem);
        }

        int requestedQuantity = order.getItems().stream().mapToInt(OrderItem::getQuantity).sum();
        int allocatedQuantity = reservations.stream().mapToInt(AllocationReservation::quantity).sum();
        if (allocatedQuantity == 0) {
            order.setStatus(OrderStatus.BACKORDERED);
        } else if (allocatedQuantity < requestedQuantity) {
            order.setStatus(OrderStatus.PARTIALLY_ALLOCATED);
        } else {
            order.setStatus(OrderStatus.ALLOCATED);
        }

        CustomerOrder saved = orderRepository.saveAndFlush(order);
        outboxService.publish(
            "OrderAllocated",
            "CustomerOrder",
            saved.getId(),
            Map.of(
                "orderId", saved.getId().toString(),
                "status", saved.getStatus().name(),
                "allocatedQuantity", allocatedQuantity,
                "requestedQuantity", requestedQuantity
            )
        );
        return OrderResponse.from(saved);
    }

    @Transactional
    public OrderResponse cancel(UUID orderId) {
        CustomerOrder order = getRequiredWithDetails(orderId);
        currentUserService.requireAdminOrTenant(order.getMerchant().getId());
        if (order.getStatus() == OrderStatus.CANCELLED) {
            return OrderResponse.from(order);
        }
        if (order.getStatus() != OrderStatus.CREATED
            && order.getStatus() != OrderStatus.ALLOCATED
            && order.getStatus() != OrderStatus.PARTIALLY_ALLOCATED
            && order.getStatus() != OrderStatus.BACKORDERED) {
            throw new DomainConflictException("Only CREATED, ALLOCATED, PARTIALLY_ALLOCATED, or BACKORDERED orders can be cancelled.");
        }

        if (order.getStatus() == OrderStatus.ALLOCATED || order.getStatus() == OrderStatus.PARTIALLY_ALLOCATED) {
            for (FulfillmentAllocation allocation : order.getAllocations()) {
                if (allocation.getStatus() == FulfillmentStatus.SHIPPED) {
                    throw new DomainConflictException("Shipped allocations cannot be cancelled.");
                }

                releaseAllocationReservations(allocation);
                allocation.setStatus(FulfillmentStatus.CANCELLED);
            }
        }

        for (BackorderItem backorder : order.getBackorders()) {
            if (backorder.getStatus() == BackorderStatus.OPEN) {
                backorder.setStatus(BackorderStatus.CANCELLED);
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        CustomerOrder saved = orderRepository.saveAndFlush(order);
        outboxService.publish(
            "OrderCancelled",
            "CustomerOrder",
            saved.getId(),
            Map.of("orderId", saved.getId().toString())
        );
        return OrderResponse.from(saved);
    }

    @Transactional
    public OrderResponse updateBackorder(UUID orderId, UUID backorderId, BackorderStatus nextStatus) {
        BackorderItem backorder = backorderRepository.findWithDetailsById(backorderId)
            .orElseThrow(() -> new ResourceNotFoundException("Backorder not found: " + backorderId));
        CustomerOrder order = getRequiredWithDetails(orderId);
        if (!backorder.getOrder().getId().equals(order.getId())) {
            throw new DomainConflictException("Backorder does not belong to order: " + orderId);
        }
        currentUserService.requireAdminOrTenant(order.getMerchant().getId());
        if (backorder.getStatus() != BackorderStatus.OPEN) {
            throw new DomainConflictException("Only OPEN backorders can change status.");
        }
        if (nextStatus == BackorderStatus.OPEN) {
            throw new DomainConflictException("Backorder is already open.");
        }

        BackorderItem target = order.getBackorders().stream()
            .filter(item -> item.getId().equals(backorderId))
            .findFirst()
            .orElseThrow(() -> new ResourceNotFoundException("Backorder not found on order: " + backorderId));
        target.setStatus(nextStatus);

        CustomerOrder saved = orderRepository.saveAndFlush(order);
        outboxService.publish(
            "Backorder" + nextStatus.name().charAt(0) + nextStatus.name().substring(1).toLowerCase(),
            "BackorderItem",
            backorderId,
            Map.of(
                "orderId", orderId.toString(),
                "backorderId", backorderId.toString(),
                "status", nextStatus.name()
            )
        );
        return OrderResponse.from(saved);
    }

    private CustomerOrder getRequiredWithDetails(UUID id) {
        return orderRepository.findWithDetailsById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
    }

    private void releaseAllocationReservations(FulfillmentAllocation allocation) {
        inventoryService.releaseReservedStock(
            allocation.getWarehouse().getId(),
            reservedQuantitiesByInventoryItemId(allocation)
        );
    }

    private Map<UUID, Integer> reservedQuantitiesByInventoryItemId(FulfillmentAllocation allocation) {
        Map<UUID, Integer> quantities = new LinkedHashMap<>();
        for (FulfillmentAllocationItem item : allocation.getItems()) {
            UUID inventoryItemId = item.getInventoryItem().getId();
            int currentQuantity = quantityOrZero(quantities, inventoryItemId);
            quantities.put(inventoryItemId, currentQuantity + item.getQuantity());
        }
        return quantities;
    }

    private int quantityOrZero(Map<UUID, Integer> quantities, UUID inventoryItemId) {
        Integer quantity = quantities.get(inventoryItemId);
        return quantity == null ? 0 : quantity;
    }

    private void requireOrderAccess(CustomerOrder order) {
        if (currentUserService.isAdmin()) {
            return;
        }

        if (currentUserService.hasRole(UserRole.MERCHANT)) {
            currentUserService.requireAdminOrTenant(order.getMerchant().getId());
            return;
        }

        UUID currentTenantId = currentUserService.required().tenantId();
        boolean ownsAllocationWarehouse = order.getAllocations().stream()
            .anyMatch(allocation -> allocation.getWarehouse().getTenant().getId().equals(currentTenantId));
        if (!ownsAllocationWarehouse) {
            currentUserService.requireAdminOrTenant(order.getMerchant().getId());
        }
    }

}
