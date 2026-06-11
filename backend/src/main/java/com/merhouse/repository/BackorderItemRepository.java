package com.merhouse.repository;

import com.merhouse.entity.BackorderItem;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BackorderItemRepository extends JpaRepository<BackorderItem, UUID> {
    @EntityGraph(attributePaths = {"order", "order.merchant", "order.backorders", "inventoryItem"})
    Optional<BackorderItem> findWithDetailsById(UUID id);
}
