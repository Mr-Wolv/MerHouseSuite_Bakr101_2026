package com.merhouse.dto;

import com.merhouse.entity.NotificationChannel;
import com.merhouse.entity.NotificationTopic;
import jakarta.validation.constraints.NotNull;

public record NotificationPreferenceUpdateRequest(
    @NotNull NotificationTopic topic,
    @NotNull NotificationChannel channel,
    boolean enabled
) {
}
