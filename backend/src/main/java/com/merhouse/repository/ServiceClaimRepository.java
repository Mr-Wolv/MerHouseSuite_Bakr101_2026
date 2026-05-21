package com.merhouse.repository;

import com.merhouse.entity.ServiceClaim;
import com.merhouse.entity.ServiceClaimStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceClaimRepository extends JpaRepository<ServiceClaim, UUID> {
    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider"})
    Optional<ServiceClaim> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider"})
    List<ServiceClaim> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider"})
    List<ServiceClaim> findByWarehouseProviderIdOrderByCreatedAtDesc(UUID warehouseProviderId);

    long countByStatus(ServiceClaimStatus status);

    long countByMerchantIdAndStatus(UUID merchantId, ServiceClaimStatus status);

    long countByWarehouseProviderIdAndStatus(UUID warehouseProviderId, ServiceClaimStatus status);
}
