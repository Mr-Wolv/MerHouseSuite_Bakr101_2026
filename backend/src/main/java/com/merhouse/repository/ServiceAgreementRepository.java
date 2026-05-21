package com.merhouse.repository;

import com.merhouse.entity.ServiceAgreement;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceAgreementRepository extends JpaRepository<ServiceAgreement, UUID> {
    @EntityGraph(attributePaths = {
        "relationship",
        "relationship.merchant",
        "relationship.warehouseProvider",
        "merchant",
        "warehouseProvider",
        "rateCard",
        "slaPolicy"
    })
    Optional<ServiceAgreement> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"relationship", "merchant", "warehouseProvider", "rateCard", "slaPolicy"})
    List<ServiceAgreement> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    @EntityGraph(attributePaths = {"relationship", "merchant", "warehouseProvider", "rateCard", "slaPolicy"})
    List<ServiceAgreement> findByWarehouseProviderIdOrderByCreatedAtDesc(UUID warehouseProviderId);

    @EntityGraph(attributePaths = {"relationship", "merchant", "warehouseProvider", "rateCard", "slaPolicy"})
    List<ServiceAgreement> findByRelationshipIdOrderByVersionNumberDesc(UUID relationshipId);

    long countByRelationshipId(UUID relationshipId);
}
