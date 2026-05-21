package com.merhouse.repository;

import com.merhouse.entity.InventoryItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, UUID> {
    List<InventoryItem> findByMerchantId(UUID merchantId);

    long countByMerchantId(UUID merchantId);

    Optional<InventoryItem> findByMerchantIdAndSku(UUID merchantId, String sku);

    @EntityGraph(attributePaths = {"merchant"})
    Optional<InventoryItem> findWithMerchantById(UUID id);
}
