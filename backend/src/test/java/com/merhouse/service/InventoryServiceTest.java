package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.dto.AdjustStockRequest;
import com.merhouse.dto.RemoveStockRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.InventoryAuditAction;
import com.merhouse.entity.InventoryAuditLog;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.Warehouse;
import com.merhouse.entity.WarehouseInventory;
import com.merhouse.entity.WarehouseInventoryId;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.InventoryAuditLogRepository;
import com.merhouse.repository.InventoryItemRepository;
import com.merhouse.repository.WarehouseInventoryRepository;
import com.merhouse.security.UserPrincipal;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class InventoryServiceTest {
    private final TenantService tenantService = mock(TenantService.class);
    private final WarehouseService warehouseService = mock(WarehouseService.class);
    private final InventoryItemRepository inventoryItemRepository = mock(InventoryItemRepository.class);
    private final WarehouseInventoryRepository warehouseInventoryRepository = mock(WarehouseInventoryRepository.class);
    private final InventoryAuditLogRepository auditLogRepository = mock(InventoryAuditLogRepository.class);
    private final AppUserRepository appUserRepository = mock(AppUserRepository.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final InventoryService inventoryService = new InventoryService(
        tenantService,
        warehouseService,
        inventoryItemRepository,
        warehouseInventoryRepository,
        auditLogRepository,
        appUserRepository,
        currentUserService
    );

    @Test
    void adjustStockRequiresReasonAndAuditsActorEvidence() {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        Warehouse warehouse = warehouse(warehouseId);
        InventoryItem item = item(itemId);
        WarehouseInventory inventory = new WarehouseInventory(warehouse, item);
        inventory.setQuantity(12);
        inventory.setReservedQuantity(4);
        AppUser actor = new AppUser();
        ReflectionTestUtils.setField(actor, "id", actorId);

        when(warehouseService.getRequired(warehouseId)).thenReturn(warehouse);
        when(currentUserService.required()).thenReturn(new UserPrincipal(
            actorId,
            warehouse.getTenant().getId(),
            "operator@example.test",
            com.merhouse.entity.UserRole.WAREHOUSE_OPERATOR,
            true
        ));
        when(appUserRepository.findById(actorId)).thenReturn(Optional.of(actor));
        when(inventoryItemRepository.findById(itemId)).thenReturn(Optional.of(item));
        when(warehouseInventoryRepository.findWithLockById(new WarehouseInventoryId(warehouseId, itemId)))
            .thenReturn(Optional.of(inventory));
        when(warehouseInventoryRepository.save(inventory)).thenReturn(inventory);

        WarehouseInventory updated = inventoryService.adjustStock(new AdjustStockRequest(
            warehouseId,
            itemId,
            -3,
            "CYCLE_COUNT_SHORTAGE",
            "Cycle count found damaged units unavailable for sale."
        ));

        assertEquals(9, updated.getQuantity());
        assertEquals(4, updated.getReservedQuantity());
        verify(currentUserService).requireAdminOrTenant(warehouse.getTenant().getId());
        ArgumentCaptor<InventoryAuditLog> auditCaptor = ArgumentCaptor.forClass(InventoryAuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        InventoryAuditLog audit = auditCaptor.getValue();
        assertEquals(InventoryAuditAction.STOCK_ADJUSTED, audit.getAction());
        assertEquals("CYCLE_COUNT_SHORTAGE", audit.getReasonCode());
        assertEquals("Cycle count found damaged units unavailable for sale.", audit.getReasonNote());
        assertEquals(actorId, audit.getActorUser().getId());
        assertEquals(12, audit.getBeforeQuantity());
        assertEquals(9, audit.getAfterQuantity());
    }

    @Test
    void adjustStockRejectsReductionBelowReservedQuantity() {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        Warehouse warehouse = warehouse(warehouseId);
        InventoryItem item = item(itemId);
        WarehouseInventory inventory = new WarehouseInventory(warehouse, item);
        inventory.setQuantity(12);
        inventory.setReservedQuantity(4);

        when(warehouseService.getRequired(warehouseId)).thenReturn(warehouse);
        when(currentUserService.required()).thenReturn(new UserPrincipal(
            UUID.randomUUID(),
            warehouse.getTenant().getId(),
            "operator@example.test",
            com.merhouse.entity.UserRole.WAREHOUSE_OPERATOR,
            true
        ));
        when(inventoryItemRepository.findById(itemId)).thenReturn(Optional.of(item));
        when(warehouseInventoryRepository.findWithLockById(new WarehouseInventoryId(warehouseId, itemId)))
            .thenReturn(Optional.of(inventory));

        assertThrows(DomainConflictException.class, () -> inventoryService.adjustStock(new AdjustStockRequest(
            warehouseId,
            itemId,
            -9,
            "CYCLE_COUNT_SHORTAGE",
            "Policy violation: would consume reserved stock."
        )));
        verify(warehouseInventoryRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void removeStockOnlyRemovesAvailableUnitsAndAuditsTheChange() {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        Warehouse warehouse = warehouse(warehouseId);
        InventoryItem item = item(itemId);
        WarehouseInventory inventory = new WarehouseInventory(warehouse, item);
        inventory.setQuantity(12);
        inventory.setReservedQuantity(4);

        when(warehouseService.getRequired(warehouseId)).thenReturn(warehouse);
        when(inventoryItemRepository.findById(itemId)).thenReturn(Optional.of(item));
        when(warehouseInventoryRepository.findWithLockById(new WarehouseInventoryId(warehouseId, itemId)))
            .thenReturn(Optional.of(inventory));
        when(warehouseInventoryRepository.save(inventory)).thenReturn(inventory);

        WarehouseInventory updated = inventoryService.removeStock(new RemoveStockRequest(warehouseId, itemId, 5));

        assertEquals(7, updated.getQuantity());
        assertEquals(4, updated.getReservedQuantity());
        verify(currentUserService).requireAdminOrTenant(warehouse.getTenant().getId());

        ArgumentCaptor<InventoryAuditLog> auditCaptor = ArgumentCaptor.forClass(InventoryAuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        InventoryAuditLog audit = auditCaptor.getValue();
        assertEquals(InventoryAuditAction.STOCK_REMOVED, audit.getAction());
        assertEquals(12, audit.getBeforeQuantity());
        assertEquals(7, audit.getAfterQuantity());
        assertEquals(4, audit.getBeforeReservedQuantity());
        assertEquals(4, audit.getAfterReservedQuantity());
    }

    @Test
    void removeStockRejectsRequestsThatWouldConsumeReservedUnits() {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        Warehouse warehouse = warehouse(warehouseId);
        InventoryItem item = item(itemId);
        WarehouseInventory inventory = new WarehouseInventory(warehouse, item);
        inventory.setQuantity(12);
        inventory.setReservedQuantity(4);

        when(warehouseService.getRequired(warehouseId)).thenReturn(warehouse);
        when(inventoryItemRepository.findById(itemId)).thenReturn(Optional.of(item));
        when(warehouseInventoryRepository.findWithLockById(new WarehouseInventoryId(warehouseId, itemId)))
            .thenReturn(Optional.of(inventory));

        assertThrows(DomainConflictException.class, () ->
            inventoryService.removeStock(new RemoveStockRequest(warehouseId, itemId, 9))
        );
        verify(warehouseInventoryRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void reserveAvailableAcrossWarehousesOnlyUsesAuthorizedActiveRelationshipStock() {
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        Warehouse warehouse = warehouse(warehouseId);
        InventoryItem item = item(itemId);
        WarehouseInventory inventory = new WarehouseInventory(warehouse, item);
        inventory.setQuantity(7);
        inventory.setReservedQuantity(2);

        when(warehouseInventoryRepository.findAuthorizedActiveStockForItemWithLock(itemId))
            .thenReturn(List.of(inventory));
        when(warehouseInventoryRepository.save(inventory)).thenReturn(inventory);

        var reservations = inventoryService.reserveAvailableAcrossWarehouses(item, 4);

        assertEquals(1, reservations.size());
        assertEquals(4, reservations.get(0).quantity());
        assertEquals(6, inventory.getReservedQuantity());
        verify(warehouseInventoryRepository).findAuthorizedActiveStockForItemWithLock(itemId);

        ArgumentCaptor<InventoryAuditLog> auditCaptor = ArgumentCaptor.forClass(InventoryAuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        assertEquals(InventoryAuditAction.STOCK_RESERVED, auditCaptor.getValue().getAction());
    }

    private Warehouse warehouse(UUID id) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setName("Warehouse Provider");
        tenant.setType(TenantType.WAREHOUSE_PROVIDER);

        Warehouse warehouse = new Warehouse();
        ReflectionTestUtils.setField(warehouse, "id", id);
        warehouse.setTenant(tenant);
        warehouse.setName("Main Warehouse");
        warehouse.setAddress("Cairo");
        warehouse.setCapacity(100);
        return warehouse;
    }

    private InventoryItem item(UUID id) {
        Tenant merchant = new Tenant();
        ReflectionTestUtils.setField(merchant, "id", UUID.randomUUID());
        merchant.setName("Merchant");
        merchant.setType(TenantType.MERCHANT);

        InventoryItem item = new InventoryItem();
        ReflectionTestUtils.setField(item, "id", id);
        item.setMerchant(merchant);
        item.setSku("SKU-1");
        item.setName("Merchant Item");
        return item;
    }
}
