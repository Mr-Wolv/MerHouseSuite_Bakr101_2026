package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.dto.CreateInboundStockRequest;
import com.merhouse.dto.CreateMerchantWarehouseRelationshipRequest;
import com.merhouse.dto.ReceiveInboundStockRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.InboundStockRequest;
import com.merhouse.entity.InboundStockRequestStatus;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.entity.Warehouse;
import com.merhouse.entity.WarehouseInventory;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.InboundStockRequestRepository;
import com.merhouse.repository.MerchantWarehouseRelationshipRepository;
import com.merhouse.repository.WarehouseInventoryRepository;
import com.merhouse.repository.WarehouseRepository;
import com.merhouse.security.UserPrincipal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class MerchantWarehouseServiceTest {
    private final TenantService tenantService = mock(TenantService.class);
    private final WarehouseService warehouseService = mock(WarehouseService.class);
    private final WarehouseRepository warehouseRepository = mock(WarehouseRepository.class);
    private final InventoryService inventoryService = mock(InventoryService.class);
    private final WarehouseInventoryRepository warehouseInventoryRepository = mock(WarehouseInventoryRepository.class);
    private final MerchantWarehouseRelationshipRepository relationshipRepository =
        mock(MerchantWarehouseRelationshipRepository.class);
    private final InboundStockRequestRepository inboundRepository = mock(InboundStockRequestRepository.class);
    private final OutboxService outboxService = mock(OutboxService.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final OperationsAlertService operationsAlertService = mock(OperationsAlertService.class);
    private final MerchantWarehouseService service = new MerchantWarehouseService(
        tenantService,
        warehouseService,
        warehouseRepository,
        inventoryService,
        warehouseInventoryRepository,
        relationshipRepository,
        inboundRepository,
        outboxService,
        currentUserService,
        operationsAlertService
    );

    @Test
    void findWarehouseProviderOptionsReturnsWarehouseProviderWarehousesForMerchantDiscovery() {
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        Tenant merchant = tenant(TenantType.MERCHANT);
        Warehouse providerWarehouse = warehouse(provider);
        Warehouse merchantWarehouse = warehouse(merchant);

        when(currentUserService.hasRole(UserRole.WAREHOUSE_OPERATOR)).thenReturn(false);
        when(warehouseRepository.findAll()).thenReturn(List.of(providerWarehouse, merchantWarehouse));

        var options = service.findWarehouseProviderOptions();

        assertEquals(1, options.size());
        assertEquals(provider.getId(), options.get(0).warehouseProviderId());
        assertEquals(providerWarehouse.getId(), options.get(0).warehouseId());
    }

    @Test
    void requestRelationshipCreatesRequestedRelationshipBetweenMerchantAndWarehouseProvider() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        merchant.setName("Merchant One");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        provider.setName("Warehouse Partner");
        MerchantWarehouseRelationship saved = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.REQUESTED);

        when(tenantService.getRequired(merchant.getId())).thenReturn(merchant);
        when(tenantService.getRequired(provider.getId())).thenReturn(provider);
        when(relationshipRepository.findByMerchantIdAndWarehouseProviderId(merchant.getId(), provider.getId()))
            .thenReturn(Optional.empty());
        when(relationshipRepository.saveAndFlush(any(MerchantWarehouseRelationship.class))).thenReturn(saved);

        service.requestRelationship(new CreateMerchantWarehouseRelationshipRequest(
            merchant.getId(),
            provider.getId(),
            "  Standard service  "
        ));

        verify(currentUserService).requireAdminOrTenant(merchant.getId());
        verify(relationshipRepository).saveAndFlush(any(MerchantWarehouseRelationship.class));
        verify(outboxService).publish(
            eq("MerchantWarehouseRelationshipRequested"),
            eq("MerchantWarehouseRelationship"),
            eq(saved.getId()),
            any()
        );
        verify(operationsAlertService).recordWarehouseProviderAlert(
            eq(provider.getId()),
            eq("Warehouse service requested"),
            eq("Merchant One requested warehouse service from Warehouse Partner. Review the relationship before inbound work can start."),
            eq("MerchantWarehouseRelationship"),
            eq(saved.getId())
        );
        verify(operationsAlertService).recordPlatformAlert(
            eq("Relationship request ready"),
            eq("Merchant One requested service from Warehouse Partner. Platform governance can review the relationship record."),
            eq("MerchantWarehouseRelationship"),
            eq(saved.getId())
        );
    }

    @Test
    void requestRelationshipRejectsNonWarehouseProviderTenant() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        Tenant secondMerchant = tenant(TenantType.MERCHANT);

        when(tenantService.getRequired(merchant.getId())).thenReturn(merchant);
        when(tenantService.getRequired(secondMerchant.getId())).thenReturn(secondMerchant);

        assertThrows(DomainConflictException.class, () ->
            service.requestRelationship(new CreateMerchantWarehouseRelationshipRequest(
                merchant.getId(),
                secondMerchant.getId(),
                null
            ))
        );
        verify(relationshipRepository, never()).saveAndFlush(any());
    }

    @Test
    void activateRelationshipMovesRequestedRelationshipToActive() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        merchant.setName("Merchant One");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        provider.setName("Warehouse Partner");
        MerchantWarehouseRelationship relationship = relationship(
            merchant,
            provider,
            MerchantWarehouseRelationshipStatus.REQUESTED
        );

        when(relationshipRepository.findWithDetailsById(relationship.getId())).thenReturn(Optional.of(relationship));
        when(relationshipRepository.saveAndFlush(relationship)).thenReturn(relationship);

        service.activateRelationship(relationship.getId());

        assertEquals(MerchantWarehouseRelationshipStatus.ACTIVE, relationship.getStatus());
        verify(currentUserService).requireAdminOrTenant(provider.getId());
        verify(outboxService).publish(
            eq("MerchantWarehouseRelationshipActivated"),
            eq("MerchantWarehouseRelationship"),
            eq(relationship.getId()),
            any()
        );
        verify(operationsAlertService).recordMerchantAlert(
            eq(merchant.getId()),
            eq("Warehouse service active"),
            eq("Warehouse Partner activated service for Merchant One. You can now submit inbound stock and allocate warehouse work."),
            eq("MerchantWarehouseRelationship"),
            eq(relationship.getId())
        );
    }

    @Test
    void findAuthorizedStockCombinesWarehouseStockAndOpenInboundForMerchant() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        merchant.setName("Adidas");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        provider.setName("FedEx");
        Warehouse warehouse = warehouse(provider);
        warehouse.setName("Cairo Hub");
        InventoryItem item = item(merchant);
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);
        WarehouseInventory inventory = new WarehouseInventory(warehouse, item);
        inventory.setQuantity(10);
        inventory.setReservedQuantity(3);
        InboundStockRequest inbound = inbound(relationship, warehouse, item, InboundStockRequestStatus.SUBMITTED);
        inbound.setRequestedQuantity(5);

        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(new UserPrincipal(
            UUID.randomUUID(),
            merchant.getId(),
            "merchant@example.test",
            UserRole.MERCHANT,
            true
        ));
        when(relationshipRepository.findByMerchantIdOrderByCreatedAtDesc(merchant.getId()))
            .thenReturn(List.of(relationship));
        when(warehouseInventoryRepository.findAuthorizedActiveStockForMerchant(merchant.getId()))
            .thenReturn(List.of(inventory));
        when(inboundRepository.findByMerchantIdOrderByCreatedAtDesc(merchant.getId()))
            .thenReturn(List.of(inbound));

        var rows = service.findAuthorizedStock(null);

        assertEquals(1, rows.size());
        assertEquals(relationship.getId(), rows.get(0).relationshipId());
        assertEquals("FedEx", rows.get(0).warehouseProviderName());
        assertEquals("Cairo Hub", rows.get(0).warehouseName());
        assertEquals(10, rows.get(0).quantity());
        assertEquals(3, rows.get(0).reservedQuantity());
        assertEquals(7, rows.get(0).availableQuantity());
        assertEquals(5, rows.get(0).inboundQuantity());
    }

    @Test
    void findAuthorizedStockExcludesDraftAndCancelledInboundQuantities() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        Warehouse warehouse = warehouse(provider);
        InventoryItem item = item(merchant);
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);
        InboundStockRequest draft = inbound(relationship, warehouse, item, InboundStockRequestStatus.DRAFT);
        InboundStockRequest cancelled = inbound(relationship, warehouse, item, InboundStockRequestStatus.CANCELLED);

        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(new UserPrincipal(
            UUID.randomUUID(),
            merchant.getId(),
            "merchant@example.test",
            UserRole.MERCHANT,
            true
        ));
        when(relationshipRepository.findByMerchantIdOrderByCreatedAtDesc(merchant.getId()))
            .thenReturn(List.of(relationship));
        when(warehouseInventoryRepository.findAuthorizedActiveStockForMerchant(merchant.getId()))
            .thenReturn(List.of());
        when(inboundRepository.findByMerchantIdOrderByCreatedAtDesc(merchant.getId()))
            .thenReturn(List.of(draft, cancelled));

        var rows = service.findAuthorizedStock(null);

        assertEquals(0, rows.size());
    }

    @Test
    void submitInboundRequiresActiveRelationshipAndMatchingWarehouseAndItem() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        merchant.setName("Merchant One");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        provider.setName("Warehouse Partner");
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);
        Warehouse warehouse = warehouse(provider);
        warehouse.setName("Main Hub");
        InventoryItem item = item(merchant);
        item.setSku("SKU-ALERT");
        InboundStockRequest saved = inbound(relationship, warehouse, item, InboundStockRequestStatus.SUBMITTED);

        when(relationshipRepository.findWithDetailsById(relationship.getId())).thenReturn(Optional.of(relationship));
        when(warehouseService.getRequired(warehouse.getId())).thenReturn(warehouse);
        when(inventoryService.getRequiredItem(item.getId())).thenReturn(item);
        when(inboundRepository.saveAndFlush(any(InboundStockRequest.class))).thenReturn(saved);

        service.submitInboundStock(new CreateInboundStockRequest(
            relationship.getId(),
            warehouse.getId(),
            item.getId(),
            12,
            "ASN-1",
            "Ship arrives Tuesday"
        ));

        verify(currentUserService).requireAdminOrTenant(merchant.getId());
        verify(inboundRepository).saveAndFlush(any(InboundStockRequest.class));
        verify(outboxService).publish(eq("InboundStockSubmitted"), eq("InboundStockRequest"), eq(saved.getId()), any());
        verify(operationsAlertService).recordWarehouseProviderAlert(
            eq(provider.getId()),
            eq("Inbound stock needs review"),
            eq("Merchant One submitted 12 units of SKU-ALERT to Main Hub. Approve the inbound request to start receiving."),
            eq("InboundStockRequest"),
            eq(saved.getId())
        );
    }

    @Test
    void createInboundDraftKeepsRequestOutOfWarehouseWorkUntilSubmittedAndApproved() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);
        Warehouse warehouse = warehouse(provider);
        InventoryItem item = item(merchant);
        InboundStockRequest saved = inbound(relationship, warehouse, item, InboundStockRequestStatus.DRAFT);

        when(relationshipRepository.findWithDetailsById(relationship.getId())).thenReturn(Optional.of(relationship));
        when(warehouseService.getRequired(warehouse.getId())).thenReturn(warehouse);
        when(inventoryService.getRequiredItem(item.getId())).thenReturn(item);
        when(inboundRepository.saveAndFlush(any(InboundStockRequest.class))).thenReturn(saved);

        service.createInboundDraft(new CreateInboundStockRequest(
            relationship.getId(),
            warehouse.getId(),
            item.getId(),
            12,
            "ASN-DRAFT",
            "Preparing cartons"
        ));

        verify(currentUserService).requireAdminOrTenant(merchant.getId());
        verify(outboxService).publish(eq("InboundStockDraftCreated"), eq("InboundStockRequest"), eq(saved.getId()), any());
        verify(operationsAlertService, never()).recordWarehouseProviderAlert(any(), any(), any(), any(), any());
        verify(operationsAlertService, never()).recordMerchantAlert(any(), any(), any(), any(), any());
        verify(operationsAlertService, never()).recordPlatformAlert(any(), any(), any(), any());
    }

    @Test
    void inboundDraftSubmitApproveCancelAndReceivingRulesAreStrict() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);
        Warehouse warehouse = warehouse(provider);
        InventoryItem item = item(merchant);
        InboundStockRequest inbound = inbound(relationship, warehouse, item, InboundStockRequestStatus.DRAFT);

        when(inboundRepository.findWithDetailsById(inbound.getId())).thenReturn(Optional.of(inbound));
        when(inboundRepository.saveAndFlush(inbound)).thenReturn(inbound);

        service.submitInboundDraft(inbound.getId());
        assertEquals(InboundStockRequestStatus.SUBMITTED, inbound.getStatus());

        assertThrows(DomainConflictException.class, () -> service.startReceiving(inbound.getId()));

        service.approveInboundStock(inbound.getId());
        assertEquals(InboundStockRequestStatus.APPROVED, inbound.getStatus());

        service.startReceiving(inbound.getId());
        assertEquals(InboundStockRequestStatus.RECEIVING, inbound.getStatus());

        assertThrows(DomainConflictException.class, () -> service.cancelInboundStock(inbound.getId()));
    }

    @Test
    void submitInboundRejectsInactiveRelationship() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        MerchantWarehouseRelationship relationship = relationship(
            merchant,
            provider,
            MerchantWarehouseRelationshipStatus.REQUESTED
        );

        when(relationshipRepository.findWithDetailsById(relationship.getId())).thenReturn(Optional.of(relationship));

        assertThrows(DomainConflictException.class, () ->
            service.submitInboundStock(new CreateInboundStockRequest(
                relationship.getId(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                12,
                null,
                null
            ))
        );
        verify(inboundRepository, never()).saveAndFlush(any());
    }

    @Test
    void receiveInboundStockAddsOnlyConfirmedQuantityToWarehouseInventory() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        merchant.setName("Merchant One");
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        provider.setName("Warehouse Partner");
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);
        Warehouse warehouse = warehouse(provider);
        warehouse.setName("Main Hub");
        InventoryItem item = item(merchant);
        item.setSku("SKU-ALERT");
        InboundStockRequest inbound = inbound(relationship, warehouse, item, InboundStockRequestStatus.RECEIVING);
        inbound.setRequestedQuantity(10);

        when(inboundRepository.findWithDetailsById(inbound.getId())).thenReturn(Optional.of(inbound));
        when(inboundRepository.saveAndFlush(inbound)).thenReturn(inbound);

        service.receiveInboundStock(inbound.getId(), new ReceiveInboundStockRequest(8, 1, "One damaged"));

        assertEquals(InboundStockRequestStatus.RECEIVED, inbound.getStatus());
        assertEquals(8, inbound.getReceivedQuantity());
        assertEquals(1, inbound.getDamagedQuantity());
        verify(currentUserService).requireAdminOrTenant(provider.getId());
        verify(inventoryService).receiveStock(warehouse, item, 8);
        verify(outboxService).publish(eq("InboundStockReceived"), eq("InboundStockRequest"), eq(inbound.getId()), any());
        verify(operationsAlertService).recordMerchantAlert(
            eq(merchant.getId()),
            eq("Inbound stock received"),
            eq("Warehouse Partner received 8 units of SKU-ALERT at Main Hub with 1 damaged."),
            eq("InboundStockRequest"),
            eq(inbound.getId())
        );
    }

    @Test
    void receiveInboundStockRejectsQuantitiesAboveRequest() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        Tenant provider = tenant(TenantType.WAREHOUSE_PROVIDER);
        MerchantWarehouseRelationship relationship = relationship(merchant, provider, MerchantWarehouseRelationshipStatus.ACTIVE);
        Warehouse warehouse = warehouse(provider);
        InventoryItem item = item(merchant);
        InboundStockRequest inbound = inbound(relationship, warehouse, item, InboundStockRequestStatus.RECEIVING);
        inbound.setRequestedQuantity(10);

        when(inboundRepository.findWithDetailsById(inbound.getId())).thenReturn(Optional.of(inbound));

        assertThrows(DomainConflictException.class, () ->
            service.receiveInboundStock(inbound.getId(), new ReceiveInboundStockRequest(9, 2, "Too many"))
        );
        verify(inventoryService, never()).receiveStock(any(), any(), anyInt());
        verify(inboundRepository, never()).saveAndFlush(any());
    }

    private Tenant tenant(TenantType type) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setName(type.name());
        tenant.setType(type);
        return tenant;
    }

    private AppUser user(Tenant tenant, UserRole role) {
        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        user.setTenant(tenant);
        user.setEmail(role.name().toLowerCase() + "@example.test");
        user.setPasswordHash("hash");
        user.setRole(role);
        user.setEnabled(true);
        return user;
    }

    private MerchantWarehouseRelationship relationship(
        Tenant merchant,
        Tenant provider,
        MerchantWarehouseRelationshipStatus status
    ) {
        MerchantWarehouseRelationship relationship = new MerchantWarehouseRelationship();
        ReflectionTestUtils.setField(relationship, "id", UUID.randomUUID());
        relationship.setMerchant(merchant);
        relationship.setWarehouseProvider(provider);
        relationship.setStatus(status);
        return relationship;
    }

    private Warehouse warehouse(Tenant provider) {
        Warehouse warehouse = new Warehouse();
        ReflectionTestUtils.setField(warehouse, "id", UUID.randomUUID());
        warehouse.setTenant(provider);
        warehouse.setName("Warehouse");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(100);
        return warehouse;
    }

    private InventoryItem item(Tenant merchant) {
        InventoryItem item = new InventoryItem();
        ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
        item.setMerchant(merchant);
        item.setSku("SKU-1");
        item.setName("Merchant Item");
        return item;
    }

    private InboundStockRequest inbound(
        MerchantWarehouseRelationship relationship,
        Warehouse warehouse,
        InventoryItem item,
        InboundStockRequestStatus status
    ) {
        InboundStockRequest inbound = new InboundStockRequest();
        ReflectionTestUtils.setField(inbound, "id", UUID.randomUUID());
        inbound.setRelationship(relationship);
        inbound.setMerchant(relationship.getMerchant());
        inbound.setWarehouseProvider(relationship.getWarehouseProvider());
        inbound.setWarehouse(warehouse);
        inbound.setInventoryItem(item);
        inbound.setRequestedQuantity(10);
        inbound.setStatus(status);
        return inbound;
    }
}
