package com.merhouse.service;

import com.merhouse.entity.NotificationTopic;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class OperationsAlertService {
    private final ConnectedAlertService connectedAlertService;

    public OperationsAlertService(ConnectedAlertService connectedAlertService) {
        this.connectedAlertService = connectedAlertService;
    }

    public void recordMerchantAlert(UUID merchantId, String title, String body, String sourceType, UUID sourceId) {
        connectedAlertService.recordMerchantAlert(
            merchantId,
            NotificationTopic.OPERATIONS,
            title,
            body,
            sourceType,
            sourceId
        );
    }

    public void recordWarehouseProviderAlert(
        UUID warehouseProviderId,
        String title,
        String body,
        String sourceType,
        UUID sourceId
    ) {
        connectedAlertService.recordWarehouseProviderAlert(
            warehouseProviderId,
            NotificationTopic.OPERATIONS,
            title,
            body,
            sourceType,
            sourceId
        );
    }

    public void recordPlatformAlert(String title, String body, String sourceType, UUID sourceId) {
        connectedAlertService.recordPlatformAlert(
            NotificationTopic.OPERATIONS,
            title,
            body,
            sourceType,
            sourceId
        );
    }
}
