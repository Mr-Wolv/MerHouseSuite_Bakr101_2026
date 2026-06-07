package com.merhouse.service;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ConnectedAlertServiceTest {
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final ConnectedAlertService service = new ConnectedAlertService(userRepository, notificationService);

    @Test
    void merchantAlertsFanOutToEnabledMerchantUsersForTenant() {
        Tenant merchant = tenant(TenantType.MERCHANT);
        AppUser recipient = user(merchant, UserRole.MERCHANT);
        UUID sourceId = UUID.randomUUID();
        when(userRepository.findByTenantIdAndRoleAndEnabledTrue(merchant.getId(), UserRole.MERCHANT))
            .thenReturn(List.of(recipient));

        service.recordMerchantAlert(
            merchant.getId(),
            NotificationTopic.OPERATIONS,
            "Inbound stock received",
            "Warehouse Partner received stock.",
            "InboundStockRequest",
            sourceId
        );

        verify(notificationService).recordForUser(
            eq(recipient),
            eq(NotificationTopic.OPERATIONS),
            eq("Inbound stock received"),
            eq("Warehouse Partner received stock."),
            eq("InboundStockRequest"),
            eq(sourceId)
        );
    }

    @Test
    void platformAlertsFanOutToOwnerAdminAndSupportAdminUsers() {
        Tenant platformTenant = tenant(TenantType.MERCHANT);
        AppUser owner = user(platformTenant, UserRole.OWNER);
        AppUser supportAdmin = user(platformTenant, UserRole.SUPPORT_ADMIN);
        UUID sourceId = UUID.randomUUID();
        when(userRepository.findByRoleInAndEnabledTrue(List.of(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT_ADMIN)))
            .thenReturn(List.of(owner, supportAdmin));

        service.recordPlatformAlert(
            NotificationTopic.OUTBOX_HEALTH,
            "Outbox event failed",
            "ShipmentCreated failed.",
            "Shipment",
            sourceId
        );

        verify(notificationService).recordForUser(
            eq(owner),
            eq(NotificationTopic.OUTBOX_HEALTH),
            eq("Outbox event failed"),
            eq("ShipmentCreated failed."),
            eq("Shipment"),
            eq(sourceId)
        );
        verify(notificationService).recordForUser(
            eq(supportAdmin),
            eq(NotificationTopic.OUTBOX_HEALTH),
            eq("Outbox event failed"),
            eq("ShipmentCreated failed."),
            eq("Shipment"),
            eq(sourceId)
        );
    }

    private Tenant tenant(TenantType type) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setType(type);
        tenant.setName(type.name());
        return tenant;
    }

    private AppUser user(Tenant tenant, UserRole role) {
        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        user.setTenant(tenant);
        user.setEmail(role.name().toLowerCase() + "@example.test");
        user.setPasswordHash("hash");
        user.setRole(role);
        user.setEnabled(true);
        return user;
    }
}
