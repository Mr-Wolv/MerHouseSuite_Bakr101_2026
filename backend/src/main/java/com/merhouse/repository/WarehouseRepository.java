package com.merhouse.repository;

import com.merhouse.entity.Warehouse;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WarehouseRepository extends JpaRepository<Warehouse, UUID> {
    List<Warehouse> findByTenantId(UUID tenantId);

    long countByTenantId(UUID tenantId);
}
