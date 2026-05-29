package com.merhouse.repository;

import com.merhouse.entity.NotificationChannel;
import com.merhouse.entity.NotificationPreference;
import com.merhouse.entity.NotificationTopic;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, UUID> {
    List<NotificationPreference> findByUserIdOrderByTopicAscChannelAsc(UUID userId);

    Optional<NotificationPreference> findByUserIdAndTopicAndChannel(
        UUID userId,
        NotificationTopic topic,
        NotificationChannel channel
    );
}
