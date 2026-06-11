package com.merhouse.repository;

import com.merhouse.entity.OrderImportBatch;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderImportBatchRepository extends JpaRepository<OrderImportBatch, UUID> {
    @EntityGraph(attributePaths = {"merchant", "rows", "rows.createdOrder"})
    Optional<OrderImportBatch> findWithRowsById(UUID id);

    @EntityGraph(attributePaths = {"merchant", "rows", "rows.createdOrder"})
    List<OrderImportBatch> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);
}
