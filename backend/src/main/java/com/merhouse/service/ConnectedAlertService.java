package com.merhouse.service;

import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ConnectedAlertService {
    private static final List<UserRole> PLATFORM_ALERT_ROLES = List.of(
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.SUPPORT_ADMIN
    );

    private final AppUserRepository userRepository;
    private final NotificationService notificationService;

    public ConnectedAlertService(AppUserRepository userRepository, NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public void recordMerchantAlert(
        UUID merchantId,
        NotificationTopic topic,
        String title,
        String body,
        String sourceType,
        UUID sourceId
    ) {
        recordForUsers(
            userRepository.findByTenantIdAndRoleAndEnabledTrue(merchantId, UserRole.MERCHANT),
            topic,
            title,
            body,
            sourceType,
            sourceId
        );
    }

    public void recordWarehouseProviderAlert(
        UUID warehouseProviderId,
        NotificationTopic topic,
        String title,
        String body,
        String sourceType,
        UUID sourceId
    ) {
        recordForUsers(
            userRepository.findByTenantIdAndRoleAndEnabledTrue(warehouseProviderId, UserRole.WAREHOUSE_OPERATOR),
            topic,
            title,
            body,
            sourceType,
            sourceId
        );
    }

    public void recordPlatformAlert(
        NotificationTopic topic,
        String title,
        String body,
        String sourceType,
        UUID sourceId
    ) {
        recordForUsers(
            userRepository.findByRoleInAndEnabledTrue(PLATFORM_ALERT_ROLES),
            topic,
            title,
            body,
            sourceType,
            sourceId
        );
    }

    private void recordForUsers(
        List<AppUser> recipients,
        NotificationTopic topic,
        String title,
        String body,
        String sourceType,
        UUID sourceId
    ) {
        if (recipients == null) {
            return;
        }
        recipients.forEach(user -> notificationService.recordForUser(user, topic, title, body, sourceType, sourceId));
    }
}
