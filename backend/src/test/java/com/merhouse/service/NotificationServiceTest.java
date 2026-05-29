package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.dto.NotificationPreferenceUpdateRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationChannel;
import com.merhouse.entity.NotificationDelivery;
import com.merhouse.entity.NotificationDeliveryStage;
import com.merhouse.entity.NotificationDeliveryStatus;
import com.merhouse.entity.NotificationPreference;
import com.merhouse.entity.NotificationProviderStatus;
import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.Tenant;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.NotificationDeliveryRepository;
import com.merhouse.repository.NotificationPreferenceRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

class NotificationServiceTest {
    private final NotificationPreferenceRepository preferenceRepository = mock(NotificationPreferenceRepository.class);
    private final NotificationDeliveryRepository deliveryRepository = mock(NotificationDeliveryRepository.class);
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-05-29T12:00:00Z"), ZoneOffset.UTC);
    private final NotificationService service = new NotificationService(
        preferenceRepository,
        deliveryRepository,
        userRepository,
        clock
    );

    @Test
    void preferencesForUserCreatesDefaultTopicAndChannelMatrix() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(user));
        when(preferenceRepository.findByUserIdOrderByTopicAscChannelAsc(userId))
            .thenReturn(List.of())
            .thenReturn(List.of(new NotificationPreference()));

        service.preferencesForUser(userId);

        ArgumentCaptor<List<NotificationPreference>> captor = ArgumentCaptor.forClass(List.class);
        verify(preferenceRepository).saveAll(captor.capture());
        assertEquals(8, captor.getValue().size());
        assertEquals(NotificationTopic.ACCOUNT_LIFECYCLE, captor.getValue().get(0).getTopic());
        assertEquals(NotificationChannel.IN_APP, captor.getValue().get(0).getChannel());
    }

    @Test
    void updatePreferenceIsScopedToCurrentUser() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        NotificationPreference preference = new NotificationPreference();
        preference.setUser(user);
        preference.setTopic(NotificationTopic.OUTBOX_HEALTH);
        preference.setChannel(NotificationChannel.EMAIL_PROTOTYPE);
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(user));
        when(preferenceRepository.findByUserIdAndTopicAndChannel(
            userId,
            NotificationTopic.OUTBOX_HEALTH,
            NotificationChannel.EMAIL_PROTOTYPE
        )).thenReturn(Optional.of(preference));

        service.updatePreference(userId, new NotificationPreferenceUpdateRequest(
            NotificationTopic.OUTBOX_HEALTH,
            NotificationChannel.EMAIL_PROTOTYPE,
            false
        ));

        assertFalse(preference.isEnabled());
        verify(preferenceRepository).save(preference);
    }

    @Test
    void recordForUserKeepsPrototypeLocalDeliveryHistoryEvenWhenPreferenceIsDisabled() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        NotificationPreference disabled = new NotificationPreference();
        disabled.setEnabled(false);
        when(preferenceRepository.findByUserIdAndTopicAndChannel(
            userId,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            NotificationChannel.IN_APP
        )).thenReturn(Optional.of(disabled));

        service.recordForUser(
            user,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            "Account ready",
            "Local record",
            "AccessRequest",
            UUID.randomUUID()
        );

        verify(deliveryRepository).save(org.mockito.ArgumentMatchers.argThat(delivery ->
            delivery.getRecipient().equals(user)
                && delivery.getStatus() == NotificationDeliveryStatus.SKIPPED_BY_PREFERENCE
                && delivery.getDeliveryStage() == NotificationDeliveryStage.SKIPPED_BY_PREFERENCE
                && delivery.getProviderStatus() == NotificationProviderStatus.NOT_CONFIGURED
                && delivery.isPrototypeLocal()
        ));
    }

    @Test
    void recordForUserStoresProductionShapedLocalDeliveryStateWhenEnabled() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());

        service.recordForUser(
            user,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            "Password reset prepared",
            "Local record",
            "PasswordResetToken",
            UUID.randomUUID()
        );

        verify(deliveryRepository).save(org.mockito.ArgumentMatchers.argThat(delivery ->
            delivery.getRecipient().equals(user)
                && delivery.getStatus() == NotificationDeliveryStatus.RECORDED
                && delivery.getDeliveryStage() == NotificationDeliveryStage.LOCAL_RECORDED
                && delivery.getProviderStatus() == NotificationProviderStatus.NOT_CONFIGURED
                && delivery.isPrototypeLocal()
        ));
    }

    @Test
    void markReadRejectsAnotherUsersDelivery() {
        UUID currentUserId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        UUID deliveryId = UUID.randomUUID();
        NotificationDelivery delivery = new NotificationDelivery();
        delivery.setRecipient(user(otherUserId, UUID.randomUUID()));
        when(deliveryRepository.findById(deliveryId)).thenReturn(Optional.of(delivery));

        assertThrows(AccessDeniedException.class, () -> service.markRead(currentUserId, deliveryId));
    }

    @Test
    void markReadSetsStatusAndTimestamp() {
        UUID currentUserId = UUID.randomUUID();
        UUID deliveryId = UUID.randomUUID();
        NotificationDelivery delivery = new NotificationDelivery();
        delivery.setRecipient(user(currentUserId, UUID.randomUUID()));
        when(deliveryRepository.findById(deliveryId)).thenReturn(Optional.of(delivery));
        when(deliveryRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.markRead(currentUserId, deliveryId);

        assertEquals(NotificationDeliveryStatus.READ, delivery.getStatus());
        assertEquals(Instant.parse("2026-05-29T12:00:00Z"), delivery.getReadAt());
    }

    @Test
    void summaryCountsUnreadRecordedDeliveriesForCurrentUser() {
        UUID userId = UUID.randomUUID();
        Instant latest = Instant.parse("2026-05-29T11:58:00Z");
        when(deliveryRepository.countByRecipientIdAndStatus(userId, NotificationDeliveryStatus.RECORDED)).thenReturn(3L);
        when(deliveryRepository.findLatestCreatedAtByRecipientId(userId)).thenReturn(latest);

        var summary = service.summaryForUser(userId);

        assertEquals(3L, summary.unreadCount());
        assertEquals(latest, summary.latestDeliveryAt());
    }

    private AppUser user(UUID userId, UUID tenantId) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", tenantId);
        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", userId);
        user.setTenant(tenant);
        user.setEmail("user@merhouse.local");
        return user;
    }
}
