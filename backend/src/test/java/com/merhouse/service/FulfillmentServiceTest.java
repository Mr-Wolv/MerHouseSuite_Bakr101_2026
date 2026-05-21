package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.CustomerOrder;
import com.merhouse.entity.FulfillmentAllocation;
import com.merhouse.entity.FulfillmentStatus;
import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import com.merhouse.entity.OrderStatus;
import com.merhouse.entity.Shipment;
import com.merhouse.entity.ShipmentStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.Warehouse;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.CustomerOrderRepository;
import com.merhouse.dto.CreateShipmentRequest;
import com.merhouse.dto.ReportExceptionRequest;
import com.merhouse.dto.ResolveExceptionRequest;
import com.merhouse.dto.UpdateAllocationWorkloadRequest;
import com.merhouse.entity.FulfillmentException;
import com.merhouse.repository.FulfillmentAllocationRepository;
import com.merhouse.repository.FulfillmentExceptionRepository;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.ShipmentPackageRepository;
import com.merhouse.repository.ShipmentRepository;
import com.merhouse.security.UserPrincipal;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class FulfillmentServiceTest {
    private final FulfillmentAllocationRepository allocationRepository = mock(FulfillmentAllocationRepository.class);
    private final MerchantWarehouseRelationshipRepository relationshipRepository =
        mock(MerchantWarehouseRelationshipRepository.class);
    private final ShipmentRepository shipmentRepository = mock(ShipmentRepository.class);
    private final ShipmentPackageRepository shipmentPackageRepository = mock(ShipmentPackageRepository.class);
    private final FulfillmentExceptionRepository exceptionRepository = mock(FulfillmentExceptionRepository.class);
    private final AppUserRepository appUserRepository = mock(AppUserRepository.class);
    private final CustomerOrderRepository orderRepository = mock(CustomerOrderRepository.class);
    private final OutboxService outboxService = mock(OutboxService.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-05-19T12:00:00Z"), ZoneOffset.UTC);
    private final FulfillmentService fulfillmentService = new FulfillmentService(
        allocationRepository,
        relationshipRepository,
        shipmentRepository,
        shipmentPackageRepository,
        exceptionRepository,
        appUserRepository,
        orderRepository,
        outboxService,
        currentUserService,
        clock
    );

    @Test
    void createShipmentRequiresSupportedCarrierAndRecordsPackageEvidence() {
        Shipment baseShipment = shipment(UUID.randomUUID(), ShipmentStatus.IN_TRANSIT);
        FulfillmentAllocation allocation = baseShipment.getAllocation();
        allocation.setStatus(FulfillmentStatus.PACKED);
        allocation.getOrder().setStatus(OrderStatus.ALLOCATED);
        UUID allocationId = allocation.getId();
        UserPrincipal actor = new UserPrincipal(
            UUID.randomUUID(),
            allocation.getWarehouse().getTenant().getId(),
            "operator@example.test",
            com.merhouse.entity.UserRole.WAREHOUSE_OPERATOR,
            true
        );
        when(currentUserService.required()).thenReturn(actor);
        when(allocationRepository.findWithDetailsById(allocationId)).thenReturn(Optional.of(allocation));
        when(shipmentRepository.existsByAllocationId(allocationId)).thenReturn(false);
        when(shipmentRepository.saveAndFlush(any(Shipment.class))).thenAnswer(invocation -> {
            Shipment saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
            return saved;
        });

        var response = fulfillmentService.createShipment(new CreateShipmentRequest(
            allocationId,
            "FedEx",
            "FX-12345",
            2,
            new BigDecimal("4.75"),
            40,
            30,
            20,
            "Packed as two cartons with photos captured",
            Map.of("operatorTerminal", "dock-3")
        ));

        assertEquals(FulfillmentStatus.SHIPPED, allocation.getStatus());
        assertEquals(OrderStatus.SHIPPED, allocation.getOrder().getStatus());
        assertEquals("FedEx", response.carrier());
        assertEquals("FX-12345", response.trackingNumber());
        assertEquals(2, response.packageCount());
        assertEquals(2, response.packages().size());
        assertEquals("FX-12345-PKG-1", response.packages().get(0).labelCode());
        assertEquals(new BigDecimal("4.75"), response.packageWeightKg());
        assertEquals("Packed as two cartons with photos captured", response.packingNote());
        assertEquals("PICK_PACK_SHIP", response.metadata().get("serviceScope"));
        assertEquals(actor.id().toString(), response.metadata().get("shippedByUserId"));
        assertEquals("2026-05-19T12:00:00Z", response.metadata().get("shippedAt"));
        verify(outboxService).publish(eq("ShipmentCreated"), eq("Shipment"), any(), any());
    }

    @Test
    void updateWorkloadRecordsPriorityScanCodeAndPickSheetEvidence() {
        Shipment baseShipment = shipment(UUID.randomUUID(), ShipmentStatus.IN_TRANSIT);
        FulfillmentAllocation allocation = baseShipment.getAllocation();
        UUID allocationId = allocation.getId();
        when(allocationRepository.findWithDetailsById(allocationId)).thenReturn(Optional.of(allocation));
        when(allocationRepository.saveAndFlush(allocation)).thenReturn(allocation);

        var response = fulfillmentService.updateWorkload(allocationId, new UpdateAllocationWorkloadRequest(
            null,
            1,
            " SCAN-123 ",
            true
        ));

        assertEquals(1, response.priority());
        assertEquals("SCAN-123", response.scanCode());
        assertEquals(clock.instant(), response.pickSheetPrintedAt());
        verify(outboxService).publish(eq("FulfillmentWorkloadUpdated"), eq("FulfillmentAllocation"), eq(allocationId), any());
    }

    @Test
    void reportAndResolveExceptionCaptureBothWarehouseAndMerchantSides() {
        Shipment baseShipment = shipment(UUID.randomUUID(), ShipmentStatus.IN_TRANSIT);
        FulfillmentAllocation allocation = baseShipment.getAllocation();
        UUID allocationId = allocation.getId();
        when(allocationRepository.findWithDetailsById(allocationId)).thenReturn(Optional.of(allocation));
        when(exceptionRepository.saveAndFlush(any(FulfillmentException.class))).thenAnswer(invocation -> {
            FulfillmentException saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
            }
            return saved;
        });

        var reported = fulfillmentService.reportException(new ReportExceptionRequest(
            allocationId,
            null,
            "SHORT_PICK",
            "Operator short-picked one Adidas carton."
        ));

        assertEquals(allocationId, reported.allocationId());
        assertEquals(allocation.getOrder().getMerchant().getId(), reported.merchantId());
        assertEquals(allocation.getWarehouse().getTenant().getId(), reported.warehouseProviderId());
        assertEquals("OPEN", reported.status());
        verify(outboxService).publish(eq("FulfillmentExceptionReported"), eq("FulfillmentException"), any(), any());

        FulfillmentException exception = new FulfillmentException();
        ReflectionTestUtils.setField(exception, "id", reported.id());
        exception.setAllocation(allocation);
        exception.setMerchant(allocation.getOrder().getMerchant());
        exception.setWarehouseProvider(allocation.getWarehouse().getTenant());
        exception.setReasonCode("SHORT_PICK");
        exception.setDescription("Operator short-picked one Adidas carton.");
        exception.setStatus("OPEN");
        when(exceptionRepository.findById(reported.id())).thenReturn(Optional.of(exception));
        when(exceptionRepository.saveAndFlush(exception)).thenReturn(exception);

        var resolved = fulfillmentService.resolveException(reported.id(), new ResolveExceptionRequest(
            "Merchant accepted substitution and customer notification is ready."
        ));

        assertEquals("RESOLVED", resolved.status());
        assertEquals("Merchant accepted substitution and customer notification is ready.", resolved.resolutionNote());
        assertEquals(clock.instant(), resolved.resolvedAt());
        verify(outboxService).publish(eq("FulfillmentExceptionResolved"), eq("FulfillmentException"), eq(reported.id()), any());
    }

    @Test
    void createShipmentRejectsUnsupportedCarrierBeforeStateChange() {
        Shipment baseShipment = shipment(UUID.randomUUID(), ShipmentStatus.IN_TRANSIT);
        FulfillmentAllocation allocation = baseShipment.getAllocation();
        allocation.setStatus(FulfillmentStatus.PACKED);
        UUID allocationId = allocation.getId();
        when(allocationRepository.findWithDetailsById(allocationId)).thenReturn(Optional.of(allocation));
        when(shipmentRepository.existsByAllocationId(allocationId)).thenReturn(false);

        assertThrows(DomainConflictException.class, () -> fulfillmentService.createShipment(new CreateShipmentRequest(
            allocationId,
            "Unsupported Carrier",
            "BAD-123",
            1,
            new BigDecimal("1.25"),
            20,
            15,
            10,
            "Carrier policy violation",
            Map.of()
        )));

        assertEquals(FulfillmentStatus.PACKED, allocation.getStatus());
        verify(shipmentRepository, never()).saveAndFlush(any());
        verify(outboxService, never()).publish(any(), any(), any(), any());
    }

    @Test
    void advanceShipmentCanFailInTransitShipmentWithoutDeliveringTheOrder() {
        UUID shipmentId = UUID.randomUUID();
        Shipment shipment = shipment(shipmentId, ShipmentStatus.IN_TRANSIT);
        when(shipmentRepository.findWithDetailsById(shipmentId)).thenReturn(Optional.of(shipment));
        when(shipmentRepository.saveAndFlush(shipment)).thenReturn(shipment);

        fulfillmentService.advanceShipment(shipmentId, ShipmentStatus.FAILED);

        assertEquals(ShipmentStatus.FAILED, shipment.getStatus());
        assertEquals(OrderStatus.SHIPPED, shipment.getAllocation().getOrder().getStatus());
        verify(orderRepository, never()).save(any());
        verify(outboxService).publish(eq("ShipmentFailed"), eq("Shipment"), eq(shipmentId), any());
    }

    @Test
    void advanceShipmentCanReturnInTransitShipmentWithoutDeliveringTheOrder() {
        UUID shipmentId = UUID.randomUUID();
        Shipment shipment = shipment(shipmentId, ShipmentStatus.IN_TRANSIT);
        when(shipmentRepository.findWithDetailsById(shipmentId)).thenReturn(Optional.of(shipment));
        when(shipmentRepository.saveAndFlush(shipment)).thenReturn(shipment);

        fulfillmentService.advanceShipment(shipmentId, ShipmentStatus.RETURNED);

        assertEquals(ShipmentStatus.RETURNED, shipment.getStatus());
        assertEquals(OrderStatus.SHIPPED, shipment.getAllocation().getOrder().getStatus());
        verify(orderRepository, never()).save(any());
        verify(outboxService).publish(eq("ShipmentReturned"), eq("Shipment"), eq(shipmentId), any());
    }

    @Test
    void advanceShipmentRejectsTerminalShipmentStatusChanges() {
        UUID shipmentId = UUID.randomUUID();
        Shipment shipment = shipment(shipmentId, ShipmentStatus.DELIVERED);
        when(shipmentRepository.findWithDetailsById(shipmentId)).thenReturn(Optional.of(shipment));

        assertThrows(DomainConflictException.class, () ->
            fulfillmentService.advanceShipment(shipmentId, ShipmentStatus.FAILED)
        );
        verify(shipmentRepository, never()).saveAndFlush(any());
        verify(outboxService, never()).publish(any(), any(), any(), any());
    }

    @Test
    void advanceShipmentDeliveredMovesTheOrderToDelivered() {
        UUID shipmentId = UUID.randomUUID();
        Shipment shipment = shipment(shipmentId, ShipmentStatus.IN_TRANSIT);
        when(shipmentRepository.findWithDetailsById(shipmentId)).thenReturn(Optional.of(shipment));
        when(shipmentRepository.saveAndFlush(shipment)).thenReturn(shipment);

        fulfillmentService.advanceShipment(shipmentId, ShipmentStatus.DELIVERED);

        assertEquals(ShipmentStatus.DELIVERED, shipment.getStatus());
        assertEquals(OrderStatus.DELIVERED, shipment.getAllocation().getOrder().getStatus());
        verify(orderRepository).save(shipment.getAllocation().getOrder());
        verify(outboxService).publish(eq("ShipmentDelivered"), eq("Shipment"), eq(shipmentId), any());
    }

    @Test
    void findAllocationsIncludesMerchantAndActiveRelationshipContext() {
        Shipment shipment = shipment(UUID.randomUUID(), ShipmentStatus.IN_TRANSIT);
        FulfillmentAllocation allocation = shipment.getAllocation();
        allocation.setStatus(FulfillmentStatus.PENDING);
        MerchantWarehouseRelationship relationship = new MerchantWarehouseRelationship();
        ReflectionTestUtils.setField(relationship, "id", UUID.randomUUID());
        relationship.setMerchant(allocation.getOrder().getMerchant());
        relationship.setWarehouseProvider(allocation.getWarehouse().getTenant());
        relationship.setStatus(MerchantWarehouseRelationshipStatus.ACTIVE);

        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(new com.merhouse.security.UserPrincipal(
            UUID.randomUUID(),
            allocation.getWarehouse().getTenant().getId(),
            "operator@example.test",
            com.merhouse.entity.UserRole.WAREHOUSE_OPERATOR,
            true
        ));
        when(allocationRepository.findByWarehouseTenantIdOrderByCreatedAtDesc(allocation.getWarehouse().getTenant().getId()))
            .thenReturn(List.of(allocation));
        when(relationshipRepository.findByMerchantIdAndWarehouseProviderIdAndStatus(
            allocation.getOrder().getMerchant().getId(),
            allocation.getWarehouse().getTenant().getId(),
            MerchantWarehouseRelationshipStatus.ACTIVE
        )).thenReturn(Optional.of(relationship));

        var rows = fulfillmentService.findAllocations(null);

        assertEquals(1, rows.size());
        assertEquals(allocation.getOrder().getMerchant().getId(), rows.get(0).merchantId());
        assertEquals(allocation.getOrder().getMerchant().getName(), rows.get(0).merchantName());
        assertEquals(relationship.getId(), rows.get(0).merchantWarehouseRelationshipId());
        assertEquals("ACTIVE", rows.get(0).serviceRelationshipStatus());
    }

    private Shipment shipment(UUID shipmentId, ShipmentStatus status) {
        Tenant warehouseTenant = new Tenant();
        ReflectionTestUtils.setField(warehouseTenant, "id", UUID.randomUUID());
        warehouseTenant.setName("Warehouse Provider");
        warehouseTenant.setType(TenantType.WAREHOUSE_PROVIDER);

        Warehouse warehouse = new Warehouse();
        ReflectionTestUtils.setField(warehouse, "id", UUID.randomUUID());
        warehouse.setTenant(warehouseTenant);
        warehouse.setName("Main Warehouse");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(100);

        CustomerOrder order = new CustomerOrder();
        ReflectionTestUtils.setField(order, "id", UUID.randomUUID());
        order.setStatus(OrderStatus.SHIPPED);
        Tenant merchant = new Tenant();
        ReflectionTestUtils.setField(merchant, "id", UUID.randomUUID());
        merchant.setName("Adidas Merchant");
        merchant.setType(TenantType.MERCHANT);
        order.setMerchant(merchant);
        order.setCustomerAddress("Customer");

        FulfillmentAllocation allocation = new FulfillmentAllocation();
        ReflectionTestUtils.setField(allocation, "id", UUID.randomUUID());
        allocation.setWarehouse(warehouse);
        order.addAllocation(allocation);

        Shipment shipment = new Shipment();
        ReflectionTestUtils.setField(shipment, "id", shipmentId);
        shipment.setAllocation(allocation);
        shipment.setCarrier("Carrier");
        shipment.setTrackingNumber("TRACK-1");
        shipment.setStatus(status);
        return shipment;
    }
}
