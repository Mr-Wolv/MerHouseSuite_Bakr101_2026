package com.merhouse.repository;

import com.merhouse.entity.Shipment;
import com.merhouse.entity.ShipmentStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentRepository extends JpaRepository<Shipment, UUID> {
    Optional<Shipment> findByAllocationId(UUID allocationId);

    long countByStatus(ShipmentStatus status);

    @EntityGraph(attributePaths = {
        "allocation",
        "packages",
        "packages.events",
        "allocation.items",
        "allocation.items.inventoryItem",
        "allocation.order",
        "allocation.order.merchant",
        "allocation.order.items",
        "allocation.order.items.inventoryItem",
        "allocation.order.allocations",
        "allocation.order.allocations.items",
        "allocation.order.allocations.items.inventoryItem",
        "allocation.order.allocations.warehouse",
        "allocation.order.backorders",
        "allocation.order.backorders.inventoryItem",
        "allocation.warehouse",
        "allocation.warehouse.tenant"
    })
    Optional<Shipment> findWithDetailsById(UUID id);
}
