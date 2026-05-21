package com.merhouse.repository;

import com.merhouse.entity.OutboxEvent;
import com.merhouse.entity.OutboxEventStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select event
        from OutboxEvent event
        where (event.status = com.merhouse.entity.OutboxEventStatus.PENDING
            or (event.status = com.merhouse.entity.OutboxEventStatus.FAILED and event.attempts < :maxAttempts))
          and event.nextAttemptAt <= :now
        order by event.createdAt asc
        """)
    List<OutboxEvent> findProcessable(
        @Param("now") Instant now,
        @Param("maxAttempts") int maxAttempts,
        Pageable pageable
    );

    long countByStatus(OutboxEventStatus status);

    long countByStatusAndAttemptsLessThan(OutboxEventStatus status, int attempts);

    List<OutboxEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<OutboxEvent> findByAggregateIdInOrderByCreatedAtDesc(Collection<UUID> aggregateIds);
}
