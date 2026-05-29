package com.merhouse.repository;

import com.merhouse.entity.NotificationDelivery;
import com.merhouse.entity.NotificationDeliveryStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, UUID> {
    @EntityGraph(attributePaths = {"recipient", "tenant"})
    List<NotificationDelivery> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);

    long countByRecipientIdAndStatus(UUID recipientId, NotificationDeliveryStatus status);

    @Query("select max(delivery.createdAt) from NotificationDelivery delivery where delivery.recipient.id = :recipientId")
    Instant findLatestCreatedAtByRecipientId(UUID recipientId);
}
