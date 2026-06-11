package com.merhouse.service;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.ServiceAgreement;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.security.UserPrincipal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ServiceAccountabilityAlertServiceTest {
    private final ConnectedAlertService connectedAlertService = mock(ConnectedAlertService.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final ServiceAccountabilityAlertService service =
        new ServiceAccountabilityAlertService(connectedAlertService, currentUserService);

    @Test
    void counterpartyAlertFromMerchantNotifiesWarehouseSideOnly() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        Tenant warehouse = tenant(TenantType.WAREHOUSE_PROVIDER);
        ServiceAgreement agreement = agreement(merchant, warehouse);
        UUID sourceId = UUID.randomUUID();
        when(currentUserService.isAdmin()).thenReturn(false);
        when(currentUserService.required()).thenReturn(user(merchant.getId(), UserRole.MERCHANT));

        service.recordCounterpartyAlert(
            agreement,
            "Service statement finalized",
            "Statement is ready for review.",
            "ServiceStatement",
            sourceId
        );

        verify(connectedAlertService).recordWarehouseProviderAlert(
            eq(warehouse.getId()),
            eq(NotificationTopic.SERVICE_ACCOUNTABILITY),
            eq("Service statement finalized"),
            eq("Statement is ready for review."),
            eq("ServiceStatement"),
            eq(sourceId)
        );
        verify(connectedAlertService, never()).recordMerchantAlert(
            eq(merchant.getId()),
            eq(NotificationTopic.SERVICE_ACCOUNTABILITY),
            eq("Service statement finalized"),
            eq("Statement is ready for review."),
            eq("ServiceStatement"),
            eq(sourceId)
        );
    }

    @Test
    void counterpartyAlertFromAdminNotifiesBothParties() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        Tenant warehouse = tenant(TenantType.WAREHOUSE_PROVIDER);
        ServiceAgreement agreement = agreement(merchant, warehouse);
        UUID sourceId = UUID.randomUUID();
        when(currentUserService.isAdmin()).thenReturn(true);

        service.recordCounterpartyAlert(
            agreement,
            "Service agreement suspended",
            "Standard was suspended.",
            "ServiceAgreement",
            sourceId
        );

        verify(connectedAlertService).recordMerchantAlert(
            eq(merchant.getId()),
            eq(NotificationTopic.SERVICE_ACCOUNTABILITY),
            eq("Service agreement suspended"),
            eq("Standard was suspended."),
            eq("ServiceAgreement"),
            eq(sourceId)
        );
        verify(connectedAlertService).recordWarehouseProviderAlert(
            eq(warehouse.getId()),
            eq(NotificationTopic.SERVICE_ACCOUNTABILITY),
            eq("Service agreement suspended"),
            eq("Standard was suspended."),
            eq("ServiceAgreement"),
            eq(sourceId)
        );
    }

    private ServiceAgreement agreement(Tenant merchant, Tenant warehouse) {
        ServiceAgreement agreement = new ServiceAgreement();
        ReflectionTestUtils.setField(agreement, "id", UUID.randomUUID());
        agreement.setMerchant(merchant);
        agreement.setWarehouseProvider(warehouse);
        agreement.setTitle("Standard");
        return agreement;
    }

    private Tenant tenant(TenantType type) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setType(type);
        tenant.setName(type.name());
        return tenant;
    }

    private UserPrincipal user(UUID tenantId, UserRole role) {
        return new UserPrincipal(UUID.randomUUID(), tenantId, role.name().toLowerCase() + "@example.test", role, true);
    }
}
