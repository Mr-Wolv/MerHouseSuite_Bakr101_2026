package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.Warehouse;
import com.merhouse.repository.CarrierDispatchRepository;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.repository.FulfillmentAllocationRepository;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.InventoryAuditLogRepository;
import com.merhouse.repository.InventoryItemRepository;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.OutboxEventRepository;
import com.merhouse.repository.ShipmentRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class OperationalDetailServiceTest {
    private final CustomerOrderRepository orderRepository = mock(CustomerOrderRepository.class);
    private final FulfillmentAllocationRepository allocationRepository = mock(FulfillmentAllocationRepository.class);
    private final ShipmentRepository shipmentRepository = mock(ShipmentRepository.class);
    private final InboundStockRequestRepository inboundRepository = mock(InboundStockRequestRepository.class);
    private final InventoryItemRepository itemRepository = mock(InventoryItemRepository.class);
    private final InventoryAuditLogRepository auditLogRepository = mock(InventoryAuditLogRepository.class);
    private final MerchantWarehouseRelationshipRepository relationshipRepository =
        mock(MerchantWarehouseRelationshipRepository.class);
    private final OutboxEventRepository outboxRepository = mock(OutboxEventRepository.class);
    private final CarrierDispatchRepository carrierDispatchRepository = mock(CarrierDispatchRepository.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final OperationalDetailService service = new OperationalDetailService(
        orderRepository,
        allocationRepository,
        shipmentRepository,
        inboundRepository,
        itemRepository,
        auditLogRepository,
        relationshipRepository,
        outboxRepository,
        carrierDispatchRepository,
        currentUserService
    );

    @Test
    void relationshipDetailUsesScopedAllocationQueryInsteadOfScanningAllAllocations() {
        Tenant merchant = tenant(TenantType.MERCHANT, "Merchant");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER, "Provider");
        MerchantWarehouseRelationship relationship = relationship(merchant, provider);
        FulfillmentAllocation allocation = allocation(merchant, provider);

        when(currentUserService.isAdmin()).thenReturn(true);
        when(relationshipRepository.findWithDetailsById(relationship.getId())).thenReturn(Optional.of(relationship));
        when(inboundRepository.findByMerchantIdOrderByCreatedAtDesc(merchant.getId())).thenReturn(List.of());
        when(allocationRepository.findByOrderMerchantIdAndWarehouseTenantIdOrderByCreatedAtDesc(
            merchant.getId(),
            provider.getId()
        )).thenReturn(List.of(allocation));
        when(relationshipRepository.findByMerchantIdAndWarehouseProviderId(merchant.getId(), provider.getId()))
            .thenReturn(Optional.of(relationship));
        when(outboxRepository.findByAggregateIdInOrderByCreatedAtDesc(anyList())).thenReturn(List.of());

        var detail = service.relationshipDetail(relationship.getId());

        assertEquals(1, detail.allocations().size());
        assertEquals(allocation.getId(), detail.allocations().get(0).id());
        verify(allocationRepository).findByOrderMerchantIdAndWarehouseTenantIdOrderByCreatedAtDesc(
            merchant.getId(),
            provider.getId()
        );
        verify(allocationRepository, never()).findAll();
    }

    private MerchantWarehouseRelationship relationship(Tenant merchant, Tenant provider) {
        MerchantWarehouseRelationship relationship = new MerchantWarehouseRelationship();
        ReflectionTestUtils.setField(relationship, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(relationship, "createdAt", Instant.parse("2026-05-17T00:00:00Z"));
        relationship.setMerchant(merchant);
        relationship.setWarehouseProvider(provider);
        relationship.setStatus(MerchantWarehouseRelationshipStatus.ACTIVE);
        relationship.setServiceNotes("Daily fulfillment");
        relationship.setApprovedAt(Instant.parse("2026-05-17T00:01:00Z"));
        return relationship;
    }

    private FulfillmentAllocation allocation(Tenant merchant, Tenant provider) {
        Warehouse warehouse = new Warehouse();
        ReflectionTestUtils.setField(warehouse, "id", UUID.randomUUID());
        warehouse.setTenant(provider);
        warehouse.setName("Cairo Hub");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(100);

        CustomerOrder order = new CustomerOrder();
        ReflectionTestUtils.setField(order, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(order, "createdAt", Instant.parse("2026-05-17T00:02:00Z"));
        order.setMerchant(merchant);
        order.setCustomerAddress("Cairo Customer");

        FulfillmentAllocation allocation = new FulfillmentAllocation();
        ReflectionTestUtils.setField(allocation, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(allocation, "createdAt", Instant.parse("2026-05-17T00:03:00Z"));
        allocation.setOrder(order);
        allocation.setWarehouse(warehouse);
        allocation.setStatus(FulfillmentStatus.PACKED);
        allocation.setPriority(2);
        return allocation;
    }

    private Tenant tenant(TenantType type, String name) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setType(type);
        tenant.setName(name);
        tenant.setActive(true);
        return tenant;
    }
}
