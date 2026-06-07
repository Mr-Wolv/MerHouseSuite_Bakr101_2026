package com.merhouse.service;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.merhouse.entity.NotificationTopic;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OutboxAlertServiceTest {
    private final ConnectedAlertService connectedAlertService = mock(ConnectedAlertService.class);
    private final OutboxAlertService service = new OutboxAlertService(connectedAlertService);

    @Test
    void healthAlertsUseOutboxTopicAndPlatformFanOut() {
        UUID sourceId = UUID.randomUUID();

        service.recordHealthAlert(
            "Outbox event failed",
            "ShipmentCreated failed on attempt 1: carrier timeout",
            "Shipment",
            sourceId
        );

        verify(connectedAlertService).recordPlatformAlert(
            eq(NotificationTopic.OUTBOX_HEALTH),
            eq("Outbox event failed"),
            eq("ShipmentCreated failed on attempt 1: carrier timeout"),
            eq("Shipment"),
            eq(sourceId)
        );
    }
}
