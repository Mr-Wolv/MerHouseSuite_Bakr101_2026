package com.merhouse.repository;

import com.merhouse.entity.InboundStockRequest;
import com.merhouse.entity.InboundStockRequestStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InboundStockRequestRepository extends JpaRepository<InboundStockRequest, UUID> {
    @EntityGraph(attributePaths = {"relationship", "merchant", "warehouseProvider", "warehouse", "inventoryItem"})
    Optional<InboundStockRequest> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"relationship", "merchant", "warehouseProvider", "warehouse", "inventoryItem"})
    List<InboundStockRequest> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    @EntityGraph(attributePaths = {"relationship", "merchant", "warehouseProvider", "warehouse", "inventoryItem"})
    List<InboundStockRequest> findByWarehouseProviderIdOrderByCreatedAtDesc(UUID warehouseProviderId);

    long countByStatusIn(Collection<InboundStockRequestStatus> statuses);

    long countByMerchantId(UUID merchantId);

    long countByWarehouseProviderId(UUID warehouseProviderId);
}
