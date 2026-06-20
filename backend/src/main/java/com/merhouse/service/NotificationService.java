package com.merhouse.service;

import com.merhouse.dto.NotificationPreferenceUpdateRequest;
import com.merhouse.dto.NotificationSummaryResponse;
import com.merhouse.dto.AttentionSeverity;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationChannel;
import com.merhouse.entity.NotificationDelivery;
import com.merhouse.entity.NotificationDeliveryStage;
import com.merhouse.entity.NotificationDeliveryStatus;
import com.merhouse.entity.NotificationPreference;
import com.merhouse.entity.NotificationProviderStatus;
import com.merhouse.entity.NotificationTopic;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.FcmTokenRepository;
import com.merhouse.repository.NotificationDeliveryRepository;
import com.merhouse.repository.NotificationPreferenceRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {
    private static final List<NotificationTopic> DEFAULT_TOPICS = List.of(
        NotificationTopic.ACCOUNT_LIFECYCLE,
        NotificationTopic.OPERATIONS,
        NotificationTopic.SERVICE_ACCOUNTABILITY,
        NotificationTopic.OUTBOX_HEALTH
    );
    private static final List<NotificationChannel> DEFAULT_CHANNELS = List.of(
        NotificationChannel.IN_APP
    );

    private final NotificationPreferenceRepository preferenceRepository;
    private final NotificationDeliveryRepository deliveryRepository;
    private final AppUserRepository userRepository;
    private final FcmTokenRepository fcmTokenRepository;
    private final FirebaseCloudMessagingService fcmService;
    private final Clock clock;

    public NotificationService(
        NotificationPreferenceRepository preferenceRepository,
        NotificationDeliveryRepository deliveryRepository,
        AppUserRepository userRepository,
        FcmTokenRepository fcmTokenRepository,
        FirebaseCloudMessagingService fcmService,
        Clock clock
    ) {
        this.preferenceRepository = preferenceRepository;
        this.deliveryRepository = deliveryRepository;
        this.userRepository = userRepository;
        this.fcmTokenRepository = fcmTokenRepository;
        this.fcmService = fcmService;
        this.clock = clock;
    }

    @Transactional
    public List<NotificationPreference> preferencesForUser(UUID userId) {
        AppUser user = userRepository.findWithTenantById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        List<NotificationPreference> existing = preferenceRepository.findByUserIdOrderByTopicAscChannelAsc(userId);
        if (existing.size() == DEFAULT_TOPICS.size() * DEFAULT_CHANNELS.size()) {
            return existing;
        }

        List<NotificationPreference> created = new ArrayList<>();
        for (NotificationTopic topic : DEFAULT_TOPICS) {
            for (NotificationChannel channel : DEFAULT_CHANNELS) {
                boolean present = existing.stream()
                    .anyMatch(preference -> preference.getTopic() == topic && preference.getChannel() == channel);
                if (!present) {
                    NotificationPreference preference = new NotificationPreference();
                    preference.setUser(user);
                    preference.setTopic(topic);
                    preference.setChannel(channel);
                    preference.setEnabled(true);
                    created.add(preference);
                }
            }
        }
        preferenceRepository.saveAll(created);
        return preferenceRepository.findByUserIdOrderByTopicAscChannelAsc(userId);
    }

    @Transactional
    public NotificationPreference updatePreference(UUID userId, NotificationPreferenceUpdateRequest request) {
        AppUser user = userRepository.findWithTenantById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        NotificationPreference preference = preferenceRepository
            .findByUserIdAndTopicAndChannel(userId, request.topic(), request.channel())
            .orElseGet(() -> {
                NotificationPreference created = new NotificationPreference();
                created.setUser(user);
                created.setTopic(request.topic());
                created.setChannel(request.channel());
                return created;
            });
        preference.setEnabled(request.enabled());
        return preferenceRepository.save(preference);
    }

    @Transactional(readOnly = true)
    public List<NotificationDelivery> deliveriesForUser(UUID userId, int limit) {
        return deliveriesForUser(userId, limit, null);
    }

    @Transactional(readOnly = true)
    public List<NotificationDelivery> deliveriesForUser(UUID userId, int limit, NotificationDeliveryStatus status) {
        return deliveriesForUser(userId, limit, 0, status);
    }

    @Transactional(readOnly = true)
    public List<NotificationDelivery> deliveriesForUser(UUID userId, int limit, int page, NotificationDeliveryStatus status) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        int safePage = Math.max(0, page);
        if (status != null) {
            return deliveryRepository.findByRecipientIdAndStatusOrderByCreatedAtDesc(
                userId,
                status,
                PageRequest.of(safePage, safeLimit)
            );
        }
        return deliveryRepository.findByRecipientIdOrderByCreatedAtDesc(userId, PageRequest.of(safePage, safeLimit));
    }

    @Transactional(readOnly = true)
    public NotificationSummaryResponse summaryForUser(UUID userId) {
        AppUser user = userRepository.findWithTenantById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        long unreadCount = deliveryRepository.countByRecipientIdAndStatus(userId, NotificationDeliveryStatus.RECORDED);
        return new NotificationSummaryResponse(
            unreadCount,
            deliveryRepository.findLatestCreatedAtByRecipientId(userId),
            unreadCount > 0
                ? deliveryRepository.findByRecipientIdAndStatusOrderByCreatedAtDesc(
                        userId,
                        NotificationDeliveryStatus.RECORDED,
                        PageRequest.of(0, 5)
                    ).stream()
                    .map(delivery -> AttentionSignalFactory.signal(
                        "notification-" + delivery.getId(),
                        delivery.getTopic() == NotificationTopic.OUTBOX_HEALTH ? AttentionSeverity.CRITICAL : AttentionSeverity.ACTION_NEEDED,
                        delivery.getTitle(),
                        delivery.getBody(),
                        user.getRole(),
                        "Open alert",
                        notificationRoute(delivery),
                        delivery.getSourceType(),
                        delivery.getSourceId(),
                        delivery.getCreatedAt()
                    ))
                    .toList()
                : List.of()
        );
    }

    @Transactional
    public NotificationDelivery markRead(UUID userId, UUID deliveryId) {
        NotificationDelivery delivery = deliveryRepository.findById(deliveryId)
            .orElseThrow(() -> new ResourceNotFoundException("Notification delivery not found: " + deliveryId));
        if (!delivery.getRecipient().getId().equals(userId)) {
            throw new AccessDeniedException("You cannot update notification delivery for another user.");
        }
        delivery.setStatus(NotificationDeliveryStatus.READ);
        delivery.setReadAt(clock.instant());
        return deliveryRepository.save(delivery);
    }

    @Transactional
    public NotificationDelivery recordForUser(
        AppUser recipient,
        NotificationTopic topic,
        String title,
        String body,
        String sourceType,
        UUID sourceId
    ) {
        NotificationDelivery delivery = new NotificationDelivery();
        delivery.setRecipient(recipient);
        delivery.setTenant(recipient.getTenant());
        delivery.setTopic(topic);
        delivery.setChannel(NotificationChannel.IN_APP);
        boolean enabled = preferenceRepository
            .findByUserIdAndTopicAndChannel(recipient.getId(), topic, NotificationChannel.IN_APP)
            .map(NotificationPreference::isEnabled)
            .orElse(true);
        delivery.setStatus(enabled ? NotificationDeliveryStatus.RECORDED : NotificationDeliveryStatus.SKIPPED_BY_PREFERENCE);
        delivery.setDeliveryStage(enabled ? NotificationDeliveryStage.LOCAL_RECORDED : NotificationDeliveryStage.SKIPPED_BY_PREFERENCE);
        delivery.setProviderStatus(NotificationProviderStatus.NOT_CONFIGURED);
        delivery.setTitle(title);
        delivery.setBody(body);
        delivery.setSourceType(sourceType);
        delivery.setSourceId(sourceId);
        delivery.setPrototypeLocal(true);
        final NotificationDelivery saved = deliveryRepository.save(delivery);

        // Attempt to send via FCM push when the user has a registered token.
        if (enabled) {
            fcmTokenRepository.findByUserId(recipient.getId())
                .ifPresent(fcmToken -> {
                    boolean sent = fcmService.sendNotification(
                        fcmToken.getFcmToken(),
                        title,
                        body
                    );
                    if (sent) {
                        saved.setProviderStatus(NotificationProviderStatus.SENT);
                        saved.setDeliveryStage(NotificationDeliveryStage.PROVIDER_SENT);
                        deliveryRepository.save(saved);
                    }
                });
        }

        return saved;
    }

    private String notificationRoute(NotificationDelivery delivery) {
        if (delivery.getTopic() == NotificationTopic.OUTBOX_HEALTH) {
            return "/admin/outbox";
        }
        if (delivery.getSourceType() == null || delivery.getSourceId() == null) {
            return "/notifications";
        }
        return switch (delivery.getSourceType()) {
            case "InboundStockRequest" -> "/inbound-stock-requests/" + delivery.getSourceId();
            case "FulfillmentAllocation" -> "/fulfillment-allocations/" + delivery.getSourceId();
            case "InventoryItem" -> "/inventory/items/" + delivery.getSourceId();
            case "MerchantWarehouseRelationship" -> "/merchant-warehouse/relationships/" + delivery.getSourceId();
            case "CustomerOrder" -> "/orders/" + delivery.getSourceId();
            case "Shipment" -> "/shipments/" + delivery.getSourceId();
            case "BackorderItem" -> "/merchant/orders";
            case "FulfillmentException" -> "/service-accountability";
            case "OutboxEvent" -> "/admin/outbox";
            case "ServiceAgreement", "ServiceStatement", "ServiceDispute", "ServiceClaim", "ServiceReviewRequest" -> "/service-accountability";
            default -> "/notifications";
        };
    }
}
