package com.merhouse.service;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.merhouse.entity.NotificationTopic;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsAlertServiceTest {
    private final ConnectedAlertService connectedAlertService = mock(ConnectedAlertService.class);
    private final OperationsAlertService service = new OperationsAlertService(connectedAlertService);

    @Test
    void merchantAlertsUseOperationsTopic() {
        UUID merchantId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();

        service.recordMerchantAlert(merchantId, "Inbound stock received", "Body", "InboundStockRequest", sourceId);

        verify(connectedAlertService).recordMerchantAlert(
            eq(merchantId),
            eq(NotificationTopic.OPERATIONS),
            eq("Inbound stock received"),
            eq("Body"),
            eq("InboundStockRequest"),
            eq(sourceId)
        );
    }

    @Test
    void warehouseProviderAlertsUseOperationsTopic() {
        UUID warehouseProviderId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();

        service.recordWarehouseProviderAlert(
            warehouseProviderId,
            "Inbound stock needs review",
            "Body",
            "InboundStockRequest",
            sourceId
        );

        verify(connectedAlertService).recordWarehouseProviderAlert(
            eq(warehouseProviderId),
            eq(NotificationTopic.OPERATIONS),
            eq("Inbound stock needs review"),
            eq("Body"),
            eq("InboundStockRequest"),
            eq(sourceId)
        );
    }

    @Test
    void platformAlertsUseOperationsTopic() {
        UUID sourceId = UUID.randomUUID();

        service.recordPlatformAlert("Relationship request ready", "Body", "MerchantWarehouseRelationship", sourceId);

        verify(connectedAlertService).recordPlatformAlert(
            eq(NotificationTopic.OPERATIONS),
            eq("Relationship request ready"),
            eq("Body"),
            eq("MerchantWarehouseRelationship"),
            eq(sourceId)
        );
    }
}
