package com.merhouse.service;

import com.merhouse.entity.NotificationTopic;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class OutboxAlertService {
    private final ConnectedAlertService connectedAlertService;

    public OutboxAlertService(ConnectedAlertService connectedAlertService) {
        this.connectedAlertService = connectedAlertService;
    }

    public void recordHealthAlert(String title, String body, String sourceType, UUID sourceId) {
        connectedAlertService.recordPlatformAlert(
            NotificationTopic.OUTBOX_HEALTH,
            title,
            body,
            sourceType,
            sourceId
        );
    }
}
