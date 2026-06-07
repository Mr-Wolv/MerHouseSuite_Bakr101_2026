package com.merhouse.dto;

import java.time.Instant;
import java.util.List;

public record NotificationSummaryResponse(
    long unreadCount,
    Instant latestDeliveryAt,
    List<AttentionSignalResponse> attentionSignals
) {
    public NotificationSummaryResponse(long unreadCount, Instant latestDeliveryAt) {
        this(unreadCount, latestDeliveryAt, List.of());
    }
}
