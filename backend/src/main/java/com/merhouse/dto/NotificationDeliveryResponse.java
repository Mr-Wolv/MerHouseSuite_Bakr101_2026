package com.merhouse.dto;

import com.merhouse.entity.NotificationChannel;
import com.merhouse.entity.NotificationDelivery;
import com.merhouse.entity.NotificationDeliveryStage;
import com.merhouse.entity.NotificationDeliveryStatus;
import com.merhouse.entity.NotificationProviderStatus;
import com.merhouse.entity.NotificationTopic;
import java.time.Instant;
import java.util.UUID;

public record NotificationDeliveryResponse(
    UUID id,
    UUID recipientUserId,
    UUID tenantId,
    NotificationTopic topic,
    NotificationChannel channel,
    NotificationDeliveryStatus status,
    NotificationDeliveryStage deliveryStage,
    NotificationProviderStatus providerStatus,
    String title,
    String body,
    String sourceType,
    UUID sourceId,
    boolean prototypeLocal,
    String providerMessageId,
    String providerError,
    Instant providerAttemptedAt,
    Instant providerSentAt,
    Instant providerFailedAt,
    int providerRetryCount,
    Instant createdAt,
    Instant readAt
) {
    public static NotificationDeliveryResponse from(NotificationDelivery delivery) {
        return new NotificationDeliveryResponse(
            delivery.getId(),
            delivery.getRecipient().getId(),
            delivery.getTenant().getId(),
            delivery.getTopic(),
            delivery.getChannel(),
            delivery.getStatus(),
            delivery.getDeliveryStage(),
            delivery.getProviderStatus(),
            delivery.getTitle(),
            delivery.getBody(),
            delivery.getSourceType(),
            delivery.getSourceId(),
            delivery.isPrototypeLocal(),
            delivery.getProviderMessageId(),
            delivery.getProviderError(),
            delivery.getProviderAttemptedAt(),
            delivery.getProviderSentAt(),
            delivery.getProviderFailedAt(),
            delivery.getProviderRetryCount(),
            delivery.getCreatedAt(),
            delivery.getReadAt()
        );
    }
}
