package com.merhouse.dto;

import com.merhouse.entity.NotificationChannel;
import com.merhouse.entity.NotificationPreference;
import com.merhouse.entity.NotificationTopic;
import java.time.Instant;
import java.util.UUID;

public record NotificationPreferenceResponse(
    UUID id,
    NotificationTopic topic,
    NotificationChannel channel,
    boolean enabled,
    Instant updatedAt
) {
    public static NotificationPreferenceResponse from(NotificationPreference preference) {
        return new NotificationPreferenceResponse(
            preference.getId(),
            preference.getTopic(),
            preference.getChannel(),
            preference.isEnabled(),
            preference.getUpdatedAt()
        );
    }
}
