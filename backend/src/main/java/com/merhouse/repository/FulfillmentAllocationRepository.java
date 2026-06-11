package com.merhouse.repository;

import com.merhouse.entity.FulfillmentAllocation;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FulfillmentAllocationRepository extends JpaRepository<FulfillmentAllocation, UUID> {
    boolean existsByOrderId(UUID orderId);

    @EntityGraph(attributePaths = {"order", "order.merchant", "warehouse", "warehouse.tenant", "assignedUser", "shipment", "shipment.packages", "shipment.packages.events", "items", "items.inventoryItem"})
    Optional<FulfillmentAllocation> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"order", "order.merchant", "warehouse", "warehouse.tenant", "assignedUser", "shipment", "shipment.packages", "shipment.packages.events", "items", "items.inventoryItem"})
    List<FulfillmentAllocation> findByWarehouseTenantIdOrderByCreatedAtDesc(UUID tenantId);

    @EntityGraph(attributePaths = {"order", "order.merchant", "warehouse", "warehouse.tenant", "assignedUser", "shipment", "shipment.packages", "shipment.packages.events", "items", "items.inventoryItem"})
    List<FulfillmentAllocation> findByWarehouseIdOrderByCreatedAtDesc(UUID warehouseId);

    @EntityGraph(attributePaths = {"order", "order.merchant", "warehouse", "warehouse.tenant", "assignedUser", "shipment", "shipment.packages", "shipment.packages.events", "items", "items.inventoryItem"})
    List<FulfillmentAllocation> findByOrderMerchantIdAndWarehouseTenantIdOrderByCreatedAtDesc(UUID merchantId, UUID warehouseProviderId);

    long countByWarehouseTenantId(UUID tenantId);
}
