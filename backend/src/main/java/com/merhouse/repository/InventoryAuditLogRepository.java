package com.merhouse.repository;

import com.merhouse.entity.InventoryAuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryAuditLogRepository extends JpaRepository<InventoryAuditLog, UUID> {
    @EntityGraph(attributePaths = {"warehouse", "inventoryItem"})
    List<InventoryAuditLog> findTop50ByInventoryItemIdOrderByOccurredAtDesc(UUID inventoryItemId);
}
