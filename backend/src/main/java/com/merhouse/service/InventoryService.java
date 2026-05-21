package com.merhouse.service;

import com.merhouse.dto.AdjustStockRequest;
import com.merhouse.dto.AddStockRequest;
import com.merhouse.dto.CreateInventoryItemRequest;
import com.merhouse.dto.RemoveStockRequest;
import com.merhouse.dto.UpdateInventoryItemRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.InventoryAuditAction;
import com.merhouse.entity.InventoryAuditLog;
import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.UserRole;
import com.merhouse.entity.Warehouse;
import com.merhouse.entity.WarehouseInventory;
import com.merhouse.entity.WarehouseInventoryId;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.InventoryAuditLogRepository;
import com.merhouse.repository.InventoryItemRepository;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.WarehouseInventoryRepository;
import com.merhouse.security.UserPrincipal;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {
    private final TenantService tenantService;
    private final WarehouseService warehouseService;
    private final InventoryItemRepository inventoryItemRepository;
    private final WarehouseInventoryRepository warehouseInventoryRepository;
    private final InventoryAuditLogRepository auditLogRepository;
    private final AppUserRepository appUserRepository;
    private final CurrentUserService currentUserService;

    public InventoryService(
        TenantService tenantService,
        WarehouseService warehouseService,
        InventoryItemRepository inventoryItemRepository,
        WarehouseInventoryRepository warehouseInventoryRepository,
        InventoryAuditLogRepository auditLogRepository,
        AppUserRepository appUserRepository,
        CurrentUserService currentUserService
    ) {
        this.tenantService = tenantService;
        this.warehouseService = warehouseService;
        this.inventoryItemRepository = inventoryItemRepository;
        this.warehouseInventoryRepository = warehouseInventoryRepository;
        this.auditLogRepository = auditLogRepository;
        this.appUserRepository = appUserRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public InventoryItem createItem(CreateInventoryItemRequest request) {
        currentUserService.requireAdminOrTenant(request.merchantId());
        Tenant merchant = tenantService.getRequired(request.merchantId());
        InventoryItem item = new InventoryItem();
        item.setMerchant(merchant);
        item.setSku(request.sku().trim());
        item.setName(request.name().trim());
        item.setAttributes(request.attributes());
        return inventoryItemRepository.save(item);
    }

    @Transactional
    public InventoryItem updateItem(UUID inventoryItemId, UpdateInventoryItemRequest request) {
        InventoryItem item = getRequiredItem(inventoryItemId);
        currentUserService.requireAdminOrTenant(item.getMerchant().getId());
        item.setSku(request.sku().trim());
        item.setName(request.name().trim());
        item.setAttributes(request.attributes());
        item.setArchived(request.archived());
        return inventoryItemRepository.save(item);
    }

    @Transactional(readOnly = true)
    public List<InventoryItem> findItems(UUID merchantId) {
        if (!currentUserService.isAdmin()) {
            UUID currentTenantId = currentUserService.required().tenantId();
            if (merchantId != null && !merchantId.equals(currentTenantId)) {
                currentUserService.requireAdminOrTenant(merchantId);
            }
            return inventoryItemRepository.findByMerchantId(currentTenantId);
        }

        if (merchantId == null) {
            return inventoryItemRepository.findAll();
        }
        return inventoryItemRepository.findByMerchantId(merchantId);
    }

    @Transactional
    public WarehouseInventory addStock(AddStockRequest request) {
        Warehouse warehouse = warehouseService.getRequired(request.warehouseId());
        currentUserService.requireAdminOrTenant(warehouse.getTenant().getId());
        InventoryItem item = getRequiredItem(request.inventoryItemId());
        return addStockWithAudit(warehouse, item, request.quantity(), InventoryAuditAction.STOCK_ADDED);
    }

    @Transactional
    public WarehouseInventory removeStock(RemoveStockRequest request) {
        Warehouse warehouse = warehouseService.getRequired(request.warehouseId());
        currentUserService.requireAdminOrTenant(warehouse.getTenant().getId());
        InventoryItem item = getRequiredItem(request.inventoryItemId());
        WarehouseInventoryId id = new WarehouseInventoryId(warehouse.getId(), item.getId());
        WarehouseInventory inventory = warehouseInventoryRepository.findWithLockById(id)
            .orElseThrow(() -> new DomainConflictException("Warehouse does not stock inventory item: " + item.getId()));

        int beforeQuantity = inventory.getQuantity();
        int beforeReserved = inventory.getReservedQuantity();
        int availableQuantity = beforeQuantity - beforeReserved;
        if (availableQuantity < request.quantity()) {
            throw new DomainConflictException(
                "Cannot remove " + request.quantity() + " units because only " + availableQuantity + " are available."
            );
        }

        inventory.setQuantity(beforeQuantity - request.quantity());
        WarehouseInventory saved = warehouseInventoryRepository.save(inventory);
        auditLogRepository.save(audit(saved, InventoryAuditAction.STOCK_REMOVED, beforeQuantity, beforeReserved));
        return saved;
    }

    @Transactional
    public WarehouseInventory adjustStock(AdjustStockRequest request) {
        if (request.quantityDelta() == 0) {
            throw new DomainConflictException("Stock adjustment quantityDelta cannot be zero.");
        }
        Warehouse warehouse = warehouseService.getRequired(request.warehouseId());
        currentUserService.requireAdminOrTenant(warehouse.getTenant().getId());
        UserPrincipal actor = currentUserService.required();
        InventoryItem item = getRequiredItem(request.inventoryItemId());
        WarehouseInventoryId id = new WarehouseInventoryId(warehouse.getId(), item.getId());
        WarehouseInventory inventory = warehouseInventoryRepository.findWithLockById(id)
            .orElseThrow(() -> new DomainConflictException("Warehouse does not stock inventory item: " + item.getId()));

        int beforeQuantity = inventory.getQuantity();
        int beforeReserved = inventory.getReservedQuantity();
        int afterQuantity = beforeQuantity + request.quantityDelta();
        if (afterQuantity < beforeReserved) {
            throw new DomainConflictException(
                "Adjustment would reduce stock below reserved quantity. Requested after quantity "
                    + afterQuantity + ", reserved " + beforeReserved + "."
            );
        }
        if (afterQuantity < 0) {
            throw new DomainConflictException("Adjustment would make stock negative.");
        }

        inventory.setQuantity(afterQuantity);
        WarehouseInventory saved = warehouseInventoryRepository.save(inventory);
        auditLogRepository.save(audit(
            saved,
            InventoryAuditAction.STOCK_ADJUSTED,
            beforeQuantity,
            beforeReserved,
            request.reasonCode().trim(),
            request.reasonNote().trim(),
            appUserRepository.findById(actor.id()).orElse(null)
        ));
        return saved;
    }

    @Transactional(readOnly = true)
    public List<WarehouseInventory> findWarehouseInventory(UUID warehouseId) {
        Warehouse warehouse = warehouseService.getRequired(warehouseId);
        currentUserService.requireAdminOrTenant(warehouse.getTenant().getId());
        return warehouseInventoryRepository.findByWarehouseId(warehouseId);
    }

    @Transactional(readOnly = true)
    public List<InventoryAuditLog> findItemAuditLogs(UUID inventoryItemId) {
        InventoryItem item = getRequiredItem(inventoryItemId);
        if (currentUserService.hasRole(UserRole.MERCHANT)) {
            currentUserService.requireAdminOrTenant(item.getMerchant().getId());
        }
        return auditLogRepository.findTop50ByInventoryItemIdOrderByOccurredAtDesc(inventoryItemId);
    }

    @Transactional(readOnly = true)
    public InventoryItem getRequiredItem(UUID id) {
        return inventoryItemRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Inventory item not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<WarehouseInventory> findInventoryForItem(UUID inventoryItemId) {
        getRequiredItem(inventoryItemId);
        return warehouseInventoryRepository.findByInventoryItemId(inventoryItemId);
    }

    public void reserveStock(UUID warehouseId, Map<UUID, Integer> itemQuantities) {
        adjustReservedStock(warehouseId, itemQuantities, true);
    }

    public void releaseReservedStock(UUID warehouseId, Map<UUID, Integer> itemQuantities) {
        adjustReservedStock(warehouseId, itemQuantities, false);
    }

    public List<AllocationReservation> reserveAvailableAcrossWarehouses(InventoryItem item, int requestedQuantity) {
        int remainingQuantity = requestedQuantity;
        List<AllocationReservation> reservations = new ArrayList<>();
        List<WarehouseInventory> inventoryRows = warehouseInventoryRepository.findAuthorizedActiveStockForItemWithLock(item.getId());

        for (WarehouseInventory inventory : inventoryRows) {
            if (remainingQuantity == 0) {
                break;
            }

            int availableQuantity = inventory.getQuantity() - inventory.getReservedQuantity();
            if (availableQuantity <= 0) {
                continue;
            }

            int quantityToReserve = Math.min(remainingQuantity, availableQuantity);
            int beforeQuantity = inventory.getQuantity();
            int beforeReserved = inventory.getReservedQuantity();
            inventory.setReservedQuantity(beforeReserved + quantityToReserve);
            WarehouseInventory saved = warehouseInventoryRepository.save(inventory);
            auditLogRepository.save(audit(saved, InventoryAuditAction.STOCK_RESERVED, beforeQuantity, beforeReserved));
            reservations.add(new AllocationReservation(inventory.getWarehouse(), item, quantityToReserve));
            remainingQuantity -= quantityToReserve;
        }

        return reservations;
    }

    public WarehouseInventory receiveStock(Warehouse warehouse, InventoryItem item, int quantity) {
        return addStockWithAudit(warehouse, item, quantity, InventoryAuditAction.STOCK_RECEIVED);
    }

    private WarehouseInventory addStockWithAudit(
        Warehouse warehouse,
        InventoryItem item,
        int quantity,
        InventoryAuditAction action
    ) {
        WarehouseInventoryId id = new WarehouseInventoryId(warehouse.getId(), item.getId());
        WarehouseInventory inventory = warehouseInventoryRepository.findWithLockById(id)
            .orElseGet(() -> new WarehouseInventory(warehouse, item));

        int beforeQuantity = inventory.getQuantity();
        int beforeReserved = inventory.getReservedQuantity();
        inventory.setQuantity(beforeQuantity + quantity);

        WarehouseInventory saved = warehouseInventoryRepository.save(inventory);
        auditLogRepository.save(audit(saved, action, beforeQuantity, beforeReserved));
        return saved;
    }

    private void adjustReservedStock(UUID warehouseId, Map<UUID, Integer> itemQuantities, boolean reserve) {
        List<UUID> itemIds = itemQuantities.keySet().stream().toList();
        Map<UUID, WarehouseInventory> inventoryByItemId = warehouseInventoryRepository
            .findByWarehouseAndItemsWithLock(warehouseId, itemIds)
            .stream()
            .collect(Collectors.toMap(inventory -> inventory.getInventoryItem().getId(), Function.identity()));

        for (Map.Entry<UUID, Integer> entry : itemQuantities.entrySet()) {
            WarehouseInventory inventory = inventoryByItemId.get(entry.getKey());
            if (inventory == null) {
                throw new DomainConflictException("Warehouse does not stock inventory item: " + entry.getKey());
            }

            int requestedQuantity = entry.getValue();
            int beforeQuantity = inventory.getQuantity();
            int beforeReserved = inventory.getReservedQuantity();

            InventoryAuditAction action;
            if (reserve) {
                int availableQuantity = inventory.getQuantity() - inventory.getReservedQuantity();
                if (availableQuantity < requestedQuantity) {
                    throw new DomainConflictException(
                        "Insufficient stock for item " + entry.getKey() + ". Requested "
                            + requestedQuantity + ", available " + availableQuantity + "."
                    );
                }
                inventory.setReservedQuantity(beforeReserved + requestedQuantity);
                action = InventoryAuditAction.STOCK_RESERVED;
            } else {
                if (beforeReserved < requestedQuantity) {
                    throw new DomainConflictException(
                        "Cannot release " + requestedQuantity + " reserved units for item " + entry.getKey()
                            + " because only " + beforeReserved + " are reserved."
                    );
                }
                inventory.setReservedQuantity(beforeReserved - requestedQuantity);
                action = InventoryAuditAction.STOCK_RELEASED;
            }

            WarehouseInventory saved = warehouseInventoryRepository.save(inventory);
            auditLogRepository.save(audit(saved, action, beforeQuantity, beforeReserved));
        }
    }

    private InventoryAuditLog audit(
        WarehouseInventory inventory,
        InventoryAuditAction action,
        int beforeQuantity,
        int beforeReserved
    ) {
        return audit(inventory, action, beforeQuantity, beforeReserved, null, null, null);
    }

    private InventoryAuditLog audit(
        WarehouseInventory inventory,
        InventoryAuditAction action,
        int beforeQuantity,
        int beforeReserved,
        String reasonCode,
        String reasonNote,
        AppUser actorUser
    ) {
        InventoryAuditLog log = new InventoryAuditLog();
        log.setWarehouse(inventory.getWarehouse());
        log.setInventoryItem(inventory.getInventoryItem());
        log.setAction(action);
        log.setBeforeQuantity(beforeQuantity);
        log.setAfterQuantity(inventory.getQuantity());
        log.setBeforeReservedQuantity(beforeReserved);
        log.setAfterReservedQuantity(inventory.getReservedQuantity());
        log.setReasonCode(reasonCode);
        log.setReasonNote(reasonNote);
        log.setActorUser(actorUser);
        return log;
    }
}
