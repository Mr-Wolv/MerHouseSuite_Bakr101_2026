package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import org.springframework.data.domain.Pageable;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

class NotificationServiceTest {
    private final NotificationPreferenceRepository preferenceRepository = mock(NotificationPreferenceRepository.class);
    private final NotificationDeliveryRepository deliveryRepository = mock(NotificationDeliveryRepository.class);
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final EmailDeliveryService emailDeliveryService = mock(EmailDeliveryService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-05-29T12:00:00Z"), ZoneOffset.UTC);
    private final NotificationService service = new NotificationService(
        preferenceRepository,
        deliveryRepository,
        userRepository,
        emailDeliveryService,
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
    void recordForUserDispatchesAsyncEmailWhenEmailDeliveryIsEnabled() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        when(emailDeliveryService.isEnabled()).thenReturn(true);

        service.recordForUser(
            user,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            "Account ready",
            "Local body",
            "Email body",
            "AccessRequest",
            UUID.randomUUID()
        );

        verify(deliveryRepository).save(org.mockito.ArgumentMatchers.argThat(delivery ->
            delivery.getChannel() == NotificationChannel.EMAIL_PROTOTYPE
                && delivery.getStatus() == NotificationDeliveryStatus.PROVIDER_RECORDED
                && delivery.getDeliveryStage() == NotificationDeliveryStage.PREPARED
                && delivery.getProviderStatus() == NotificationProviderStatus.READY_FOR_PROVIDER
                && !delivery.isPrototypeLocal()
        ));
        verify(emailDeliveryService).sendAndForget(any(), any(), any(), eq("Email body"));
    }

    @Test
    void recordForUserDispatchesAsyncEmailEvenWhenProviderMayFail() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        when(emailDeliveryService.isEnabled()).thenReturn(true);

        service.recordForUser(
            user,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            "Password reset prepared",
            "Local body",
            "Email body",
            "PasswordResetToken",
            UUID.randomUUID()
        );

        verify(deliveryRepository).save(org.mockito.ArgumentMatchers.argThat(delivery ->
            delivery.getChannel() == NotificationChannel.EMAIL_PROTOTYPE
                && delivery.getStatus() == NotificationDeliveryStatus.PROVIDER_RECORDED
                && delivery.getDeliveryStage() == NotificationDeliveryStage.PREPARED
                && delivery.getProviderStatus() == NotificationProviderStatus.READY_FOR_PROVIDER
        ));
        verify(emailDeliveryService).sendAndForget(any(), any(), any(), eq("Email body"));
    }

    @Test
    void recordForUserDoesNotDispatchEmailWhenEmailPreferenceIsDisabled() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        NotificationPreference disabled = new NotificationPreference();
        disabled.setEnabled(false);
        when(emailDeliveryService.isEnabled()).thenReturn(true);
        when(preferenceRepository.findByUserIdAndTopicAndChannel(
            userId,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            NotificationChannel.EMAIL_PROTOTYPE
        )).thenReturn(Optional.of(disabled));

        service.recordForUser(
            user,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            "Account ready",
            "Local body",
            "Email body",
            "AccessRequest",
            UUID.randomUUID()
        );

        verify(deliveryRepository).save(org.mockito.ArgumentMatchers.argThat(delivery ->
            delivery.getChannel() == NotificationChannel.EMAIL_PROTOTYPE
                && delivery.getStatus() == NotificationDeliveryStatus.SKIPPED_BY_PREFERENCE
                && delivery.getDeliveryStage() == NotificationDeliveryStage.SKIPPED_BY_PREFERENCE
        ));
        verify(emailDeliveryService, org.mockito.Mockito.never()).sendAndForget(any(), any(), any(), any());
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
    void deliveriesForUserCanFilterUnreadActionRecords() {
        UUID userId = UUID.randomUUID();
        NotificationDelivery unread = new NotificationDelivery();
        when(deliveryRepository.findByRecipientIdAndStatusOrderByCreatedAtDesc(
            eq(userId),
            eq(NotificationDeliveryStatus.RECORDED),
            any()
        )).thenReturn(List.of(unread));

        var deliveries = service.deliveriesForUser(userId, 50, NotificationDeliveryStatus.RECORDED);

        assertEquals(List.of(unread), deliveries);
        verify(deliveryRepository).findByRecipientIdAndStatusOrderByCreatedAtDesc(
            eq(userId),
            eq(NotificationDeliveryStatus.RECORDED),
            any()
        );
    }

    @Test
    void deliveriesForUserUsesRequestedPageForDenseActionRecords() {
        UUID userId = UUID.randomUUID();
        NotificationDelivery unread = new NotificationDelivery();
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        when(deliveryRepository.findByRecipientIdAndStatusOrderByCreatedAtDesc(
            eq(userId),
            eq(NotificationDeliveryStatus.RECORDED),
            pageableCaptor.capture()
        )).thenReturn(List.of(unread));

        var deliveries = service.deliveriesForUser(userId, 50, 2, NotificationDeliveryStatus.RECORDED);

        assertEquals(List.of(unread), deliveries);
        assertEquals(2, pageableCaptor.getValue().getPageNumber());
        assertEquals(50, pageableCaptor.getValue().getPageSize());
    }

    @Test
    void summaryCountsUnreadRecordedDeliveriesForCurrentUser() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        Instant latest = Instant.parse("2026-05-29T11:58:00Z");
        NotificationDelivery delivery = new NotificationDelivery();
        ReflectionTestUtils.setField(delivery, "id", UUID.randomUUID());
        delivery.setRecipient(user);
        delivery.setTenant(user.getTenant());
        delivery.setStatus(NotificationDeliveryStatus.RECORDED);
        delivery.setTopic(NotificationTopic.OPERATIONS);
        delivery.setTitle("Inbound request needs review");
        delivery.setBody("Merchant stock is waiting.");
        delivery.setSourceType("InboundStockRequest");
        delivery.setSourceId(UUID.randomUUID());
        ReflectionTestUtils.setField(delivery, "createdAt", latest);
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(user));
        when(deliveryRepository.countByRecipientIdAndStatus(userId, NotificationDeliveryStatus.RECORDED)).thenReturn(3L);
        when(deliveryRepository.findLatestCreatedAtByRecipientId(userId)).thenReturn(latest);
        when(deliveryRepository.findByRecipientIdAndStatusOrderByCreatedAtDesc(
            eq(userId),
            eq(NotificationDeliveryStatus.RECORDED),
            any()
        )).thenReturn(List.of(delivery));

        var summary = service.summaryForUser(userId);

        assertEquals(3L, summary.unreadCount());
        assertEquals(latest, summary.latestDeliveryAt());
        assertEquals(1, summary.attentionSignals().size());
        assertEquals("/inbound-stock-requests/" + delivery.getSourceId(), summary.attentionSignals().getFirst().route());
        assertTrue(summary.attentionSignals().getFirst().body().contains("Merchant stock"));
    }

    @Test
    void summaryRoutesConnectedSourcesToTheirOwningWorkSurfaces() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        Instant latest = Instant.parse("2026-05-29T11:58:00Z");
        UUID orderId = UUID.randomUUID();
        UUID backorderId = UUID.randomUUID();
        UUID exceptionId = UUID.randomUUID();
        UUID shipmentId = UUID.randomUUID();
        NotificationDelivery order = delivery(user, NotificationTopic.OPERATIONS, "Order needs allocation", "Order is waiting.", "CustomerOrder", orderId, latest);
        NotificationDelivery backorder = delivery(user, NotificationTopic.OPERATIONS, "Backorder opened", "Stock blocker needs review.", "BackorderItem", backorderId, latest);
        NotificationDelivery exception = delivery(user, NotificationTopic.OPERATIONS, "Exception reported", "Merchant needs service review.", "FulfillmentException", exceptionId, latest);
        NotificationDelivery outbox = delivery(user, NotificationTopic.OUTBOX_HEALTH, "Shipment event failed", "Dispatch needs platform review.", "Shipment", shipmentId, latest);
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(user));
        when(deliveryRepository.countByRecipientIdAndStatus(userId, NotificationDeliveryStatus.RECORDED)).thenReturn(4L);
        when(deliveryRepository.findLatestCreatedAtByRecipientId(userId)).thenReturn(latest);
        when(deliveryRepository.findByRecipientIdAndStatusOrderByCreatedAtDesc(
            eq(userId),
            eq(NotificationDeliveryStatus.RECORDED),
            any()
        )).thenReturn(List.of(
            order,
            backorder,
            exception,
            outbox
        ));

        var routes = service.summaryForUser(userId).attentionSignals().stream()
            .map(signal -> signal.sourceType() + "=" + signal.route())
            .toList();

        assertTrue(routes.contains("CustomerOrder=/orders/" + orderId));
        assertTrue(routes.contains("BackorderItem=/merchant/orders"));
        assertTrue(routes.contains("FulfillmentException=/service-accountability"));
        assertTrue(routes.contains("Shipment=/admin/outbox"));
    }

    @Test
    void summaryRoutesOutboxHealthToDiagnosticsEvenWithoutSourceId() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        Instant latest = Instant.parse("2026-05-29T11:58:00Z");
        NotificationDelivery outbox = delivery(
            user,
            NotificationTopic.OUTBOX_HEALTH,
            "Outbox retry failed",
            "Platform review is needed.",
            null,
            null,
            latest
        );
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(user));
        when(deliveryRepository.countByRecipientIdAndStatus(userId, NotificationDeliveryStatus.RECORDED)).thenReturn(1L);
        when(deliveryRepository.findLatestCreatedAtByRecipientId(userId)).thenReturn(latest);
        when(deliveryRepository.findByRecipientIdAndStatusOrderByCreatedAtDesc(
            eq(userId),
            eq(NotificationDeliveryStatus.RECORDED),
            any()
        )).thenReturn(List.of(outbox));

        var summary = service.summaryForUser(userId);

        assertEquals("/admin/outbox", summary.attentionSignals().getFirst().route());
    }

    @Test
    void summaryBuildsAttentionSignalsFromUnreadDeliveriesEvenWhenRecentHistoryIsRead() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(userId, UUID.randomUUID());
        Instant latest = Instant.parse("2026-05-29T11:58:00Z");
        NotificationDelivery unread = delivery(
            user,
            NotificationTopic.OPERATIONS,
            "Older unread inbound",
            "Unread work should stay visible even when newer history is read.",
            "InboundStockRequest",
            UUID.randomUUID(),
            latest.minusSeconds(60)
        );
        NotificationDelivery read = delivery(
            user,
            NotificationTopic.OPERATIONS,
            "Newer read history",
            "This should not crowd unread work out of the summary.",
            "CustomerOrder",
            UUID.randomUUID(),
            latest
        );
        read.setStatus(NotificationDeliveryStatus.READ);
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(user));
        when(deliveryRepository.countByRecipientIdAndStatus(userId, NotificationDeliveryStatus.RECORDED)).thenReturn(1L);
        when(deliveryRepository.findLatestCreatedAtByRecipientId(userId)).thenReturn(latest);
        when(deliveryRepository.findByRecipientIdAndStatusOrderByCreatedAtDesc(
            eq(userId),
            eq(NotificationDeliveryStatus.RECORDED),
            any()
        )).thenReturn(List.of(unread));

        var summary = service.summaryForUser(userId);

        assertEquals(1L, summary.unreadCount());
        assertEquals(1, summary.attentionSignals().size());
        assertEquals("Older unread inbound", summary.attentionSignals().getFirst().title());
        assertEquals("/inbound-stock-requests/" + unread.getSourceId(), summary.attentionSignals().getFirst().route());
    }

    private AppUser user(UUID userId, UUID tenantId) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", tenantId);
        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", userId);
        user.setTenant(tenant);
        user.setEmail("user@merhouse.local");
        user.setRole(com.merhouse.entity.UserRole.MERCHANT);
        return user;
    }

    private NotificationDelivery delivery(
        AppUser user,
        NotificationTopic topic,
        String title,
        String body,
        String sourceType,
        UUID sourceId,
        Instant createdAt
    ) {
        NotificationDelivery delivery = new NotificationDelivery();
        ReflectionTestUtils.setField(delivery, "id", UUID.randomUUID());
        delivery.setRecipient(user);
        delivery.setTenant(user.getTenant());
        delivery.setStatus(NotificationDeliveryStatus.RECORDED);
        delivery.setTopic(topic);
        delivery.setTitle(title);
        delivery.setBody(body);
        delivery.setSourceType(sourceType);
        delivery.setSourceId(sourceId);
        ReflectionTestUtils.setField(delivery, "createdAt", createdAt);
        return delivery;
    }
}
