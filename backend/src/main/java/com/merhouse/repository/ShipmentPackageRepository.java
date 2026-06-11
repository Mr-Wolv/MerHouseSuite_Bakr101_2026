package com.merhouse.repository;

import com.merhouse.entity.ShipmentPackage;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentPackageRepository extends JpaRepository<ShipmentPackage, UUID> {
    @EntityGraph(attributePaths = {"shipment", "shipment.allocation", "events"})
    List<ShipmentPackage> findByShipmentIdOrderByPackageNumber(UUID shipmentId);
}
