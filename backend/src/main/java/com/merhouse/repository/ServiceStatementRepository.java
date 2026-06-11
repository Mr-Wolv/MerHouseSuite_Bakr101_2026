package com.merhouse.repository;

import com.merhouse.entity.ServiceStatement;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceStatementRepository extends JpaRepository<ServiceStatement, UUID> {
    @EntityGraph(attributePaths = {
        "agreement",
        "agreement.relationship",
        "merchant",
        "warehouseProvider",
        "lines"
    })
    Optional<ServiceStatement> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider", "lines"})
    Optional<ServiceStatement> findByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider", "lines"})
    List<ServiceStatement> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider", "lines"})
    List<ServiceStatement> findByWarehouseProviderIdOrderByCreatedAtDesc(UUID warehouseProviderId);

    @EntityGraph(attributePaths = {"agreement", "merchant", "warehouseProvider", "lines"})
    List<ServiceStatement> findByAgreementIdOrderByCreatedAtDesc(UUID agreementId);

    long countByMerchantId(UUID merchantId);

    long countByWarehouseProviderId(UUID warehouseProviderId);
}
