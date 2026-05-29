package com.merhouse.dto;

import java.time.Instant;

public record NotificationSummaryResponse(
    long unreadCount,
    Instant latestDeliveryAt
) {
}
