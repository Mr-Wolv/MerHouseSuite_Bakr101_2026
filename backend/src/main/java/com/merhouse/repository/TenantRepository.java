package com.merhouse.repository;

import com.merhouse.entity.Tenant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    long countByActiveFalse();
}
