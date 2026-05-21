package com.merhouse.repository;

import com.merhouse.entity.AdminAuditEvent;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAuditEventRepository extends JpaRepository<AdminAuditEvent, java.util.UUID> {
    @EntityGraph(attributePaths = "actor")
    List<AdminAuditEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
