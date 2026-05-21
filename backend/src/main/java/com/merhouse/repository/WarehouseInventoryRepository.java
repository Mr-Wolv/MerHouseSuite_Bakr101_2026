package com.merhouse.repository;

import com.merhouse.entity.WarehouseInventory;
import com.merhouse.entity.WarehouseInventoryId;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WarehouseInventoryRepository extends JpaRepository<WarehouseInventory, WarehouseInventoryId> {
    @EntityGraph(attributePaths = {"warehouse", "inventoryItem"})
    List<WarehouseInventory> findByWarehouseId(UUID warehouseId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"warehouse", "inventoryItem"})
    Optional<WarehouseInventory> findWithLockById(WarehouseInventoryId id);

    @EntityGraph(attributePaths = {"warehouse", "inventoryItem"})
    List<WarehouseInventory> findByInventoryItemId(UUID inventoryItemId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"warehouse", "inventoryItem"})
    List<WarehouseInventory> findWithLockByInventoryItemId(UUID inventoryItemId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"warehouse", "inventoryItem"})
    @Query("""
        select wi
        from WarehouseInventory wi
        join MerchantWarehouseRelationship relationship
          on relationship.merchant.id = wi.inventoryItem.merchant.id
         and relationship.warehouseProvider.id = wi.warehouse.tenant.id
        where wi.inventoryItem.id = :inventoryItemId
          and relationship.status = com.merhouse.entity.MerchantWarehouseRelationshipStatus.ACTIVE
        """)
    List<WarehouseInventory> findAuthorizedActiveStockForItemWithLock(@Param("inventoryItemId") UUID inventoryItemId);

    @EntityGraph(attributePaths = {"warehouse", "warehouse.tenant", "inventoryItem", "inventoryItem.merchant"})
    @Query("""
        select wi
        from WarehouseInventory wi
        join MerchantWarehouseRelationship relationship
          on relationship.merchant.id = wi.inventoryItem.merchant.id
         and relationship.warehouseProvider.id = wi.warehouse.tenant.id
        where relationship.merchant.id = :merchantId
          and relationship.status = com.merhouse.entity.MerchantWarehouseRelationshipStatus.ACTIVE
        order by wi.warehouse.name asc, wi.inventoryItem.sku asc
        """)
    List<WarehouseInventory> findAuthorizedActiveStockForMerchant(@Param("merchantId") UUID merchantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"warehouse", "inventoryItem"})
    @Query("""
        select wi
        from WarehouseInventory wi
        where wi.warehouse.id = :warehouseId
          and wi.inventoryItem.id in :inventoryItemIds
        """)
    List<WarehouseInventory> findByWarehouseAndItemsWithLock(
        @Param("warehouseId") UUID warehouseId,
        @Param("inventoryItemIds") List<UUID> inventoryItemIds
    );
}
