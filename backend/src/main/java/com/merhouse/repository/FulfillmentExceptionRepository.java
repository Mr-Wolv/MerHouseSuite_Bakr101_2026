package com.merhouse.repository;

import com.merhouse.entity.FulfillmentException;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FulfillmentExceptionRepository extends JpaRepository<FulfillmentException, UUID> {
    @EntityGraph(attributePaths = {"allocation", "allocation.order", "allocation.warehouse", "shipment", "merchant", "warehouseProvider"})
    List<FulfillmentException> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    @EntityGraph(attributePaths = {"allocation", "allocation.order", "allocation.warehouse", "shipment", "merchant", "warehouseProvider"})
    List<FulfillmentException> findByWarehouseProviderIdOrderByCreatedAtDesc(UUID warehouseProviderId);

    long countByStatus(String status);
}
