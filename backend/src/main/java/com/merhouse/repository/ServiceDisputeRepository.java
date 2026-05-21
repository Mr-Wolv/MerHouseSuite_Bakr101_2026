package com.merhouse.repository;

import com.merhouse.entity.ServiceDispute;
import com.merhouse.entity.ServiceDisputeStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceDisputeRepository extends JpaRepository<ServiceDispute, UUID> {
    @EntityGraph(attributePaths = {"agreement", "statement", "statementLine", "merchant", "warehouseProvider"})
    Optional<ServiceDispute> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"agreement", "statement", "statementLine", "merchant", "warehouseProvider"})
    List<ServiceDispute> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    @EntityGraph(attributePaths = {"agreement", "statement", "statementLine", "merchant", "warehouseProvider"})
    List<ServiceDispute> findByWarehouseProviderIdOrderByCreatedAtDesc(UUID warehouseProviderId);

    long countByStatus(ServiceDisputeStatus status);

    long countByMerchantIdAndStatus(UUID merchantId, ServiceDisputeStatus status);

    long countByWarehouseProviderIdAndStatus(UUID warehouseProviderId, ServiceDisputeStatus status);
}
