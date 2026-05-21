package com.merhouse.repository;

import com.merhouse.entity.AccessRequest;
import com.merhouse.entity.AccessRequestStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccessRequestRepository extends JpaRepository<AccessRequest, UUID> {
    @Override
    @EntityGraph(attributePaths = {"reviewedBy.tenant", "convertedTenant", "convertedUser.tenant"})
    List<AccessRequest> findAll();

    long countByStatus(AccessRequestStatus status);
}
