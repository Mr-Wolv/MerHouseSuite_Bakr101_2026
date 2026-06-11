package com.merhouse.repository;

import com.merhouse.entity.MerchantWarehouseRelationship;
import com.merhouse.entity.MerchantWarehouseRelationshipStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MerchantWarehouseRelationshipRepository extends JpaRepository<MerchantWarehouseRelationship, UUID> {
    @EntityGraph(attributePaths = {"merchant", "warehouseProvider"})
    Optional<MerchantWarehouseRelationship> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"merchant", "warehouseProvider"})
    Optional<MerchantWarehouseRelationship> findByMerchantIdAndWarehouseProviderId(UUID merchantId, UUID warehouseProviderId);

    @EntityGraph(attributePaths = {"merchant", "warehouseProvider"})
    Optional<MerchantWarehouseRelationship> findByMerchantIdAndWarehouseProviderIdAndStatus(
        UUID merchantId,
        UUID warehouseProviderId,
        MerchantWarehouseRelationshipStatus status
    );

    @EntityGraph(attributePaths = {"merchant", "warehouseProvider"})
    List<MerchantWarehouseRelationship> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    @EntityGraph(attributePaths = {"merchant", "warehouseProvider"})
    List<MerchantWarehouseRelationship> findByWarehouseProviderIdOrderByCreatedAtDesc(UUID warehouseProviderId);

    long countByStatus(MerchantWarehouseRelationshipStatus status);

    long countByMerchantIdOrWarehouseProviderId(UUID merchantId, UUID warehouseProviderId);

    boolean existsByMerchantIdAndWarehouseProviderIdAndStatus(
        UUID merchantId,
        UUID warehouseProviderId,
        MerchantWarehouseRelationshipStatus status
    );
}
