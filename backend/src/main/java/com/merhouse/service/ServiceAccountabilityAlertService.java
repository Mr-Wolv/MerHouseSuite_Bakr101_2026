package com.merhouse.service;

import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.ServiceAgreement;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ServiceAccountabilityAlertService {
    private final ConnectedAlertService connectedAlertService;
    private final CurrentUserService currentUserService;

    public ServiceAccountabilityAlertService(
        ConnectedAlertService connectedAlertService,
        CurrentUserService currentUserService
    ) {
        this.connectedAlertService = connectedAlertService;
        this.currentUserService = currentUserService;
    }

    public void recordCounterpartyAlert(
        ServiceAgreement agreement,
        String title,
        String body,
        String sourceType,
        UUID sourceId
    ) {
        UUID actorTenantId = actorTenantId();
        if (actorTenantId == null || !actorTenantId.equals(agreement.getMerchant().getId())) {
            recordMerchantAlert(agreement.getMerchant().getId(), title, body, sourceType, sourceId);
        }
        if (actorTenantId == null || !actorTenantId.equals(agreement.getWarehouseProvider().getId())) {
            recordWarehouseAlert(agreement.getWarehouseProvider().getId(), title, body, sourceType, sourceId);
        }
    }

    public void recordMerchantAlert(UUID merchantId, String title, String body, String sourceType, UUID sourceId) {
        connectedAlertService.recordMerchantAlert(
            merchantId,
            NotificationTopic.SERVICE_ACCOUNTABILITY,
            title,
            body,
            sourceType,
            sourceId
        );
    }

    public void recordWarehouseAlert(UUID warehouseProviderId, String title, String body, String sourceType, UUID sourceId) {
        connectedAlertService.recordWarehouseProviderAlert(
            warehouseProviderId,
            NotificationTopic.SERVICE_ACCOUNTABILITY,
            title,
            body,
            sourceType,
            sourceId
        );
    }

    private UUID actorTenantId() {
        if (currentUserService.isAdmin()) {
            return null;
        }
        return currentUserService.required().tenantId();
    }
}
