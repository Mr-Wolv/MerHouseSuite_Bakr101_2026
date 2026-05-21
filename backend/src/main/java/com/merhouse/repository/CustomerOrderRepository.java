package com.merhouse.repository;

import com.merhouse.entity.CustomerOrder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, UUID> {
    List<CustomerOrder> findByMerchantId(UUID merchantId);

    long countByMerchantId(UUID merchantId);

    @EntityGraph(attributePaths = {
        "merchant",
        "items",
        "items.inventoryItem",
        "allocations",
        "allocations.items",
        "allocations.items.inventoryItem",
        "allocations.warehouse",
        "backorders",
        "backorders.inventoryItem"
    })
    Optional<CustomerOrder> findWithDetailsById(UUID id);
}
