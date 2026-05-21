package com.merhouse.repository;

import com.merhouse.entity.ServiceReviewRequest;
import com.merhouse.entity.ServiceReviewStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceReviewRequestRepository extends JpaRepository<ServiceReviewRequest, UUID> {
    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider"})
    Optional<ServiceReviewRequest> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider"})
    List<ServiceReviewRequest> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider"})
    List<ServiceReviewRequest> findByWarehouseProviderIdOrderByCreatedAtDesc(UUID warehouseProviderId);

    long countByStatus(ServiceReviewStatus status);

    long countByMerchantIdAndStatus(UUID merchantId, ServiceReviewStatus status);

    long countByWarehouseProviderIdAndStatus(UUID warehouseProviderId, ServiceReviewStatus status);
}
