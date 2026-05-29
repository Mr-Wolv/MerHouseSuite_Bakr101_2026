package com.merhouse.service;

import com.merhouse.dto.NotificationPreferenceUpdateRequest;
import com.merhouse.dto.NotificationSummaryResponse;
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
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL_PROTOTYPE
    );

    private final NotificationPreferenceRepository preferenceRepository;
    private final NotificationDeliveryRepository deliveryRepository;
    private final AppUserRepository userRepository;
    private final Clock clock;

    public NotificationService(
        NotificationPreferenceRepository preferenceRepository,
        NotificationDeliveryRepository deliveryRepository,
        AppUserRepository userRepository,
        Clock clock
    ) {
        this.preferenceRepository = preferenceRepository;
        this.deliveryRepository = deliveryRepository;
        this.userRepository = userRepository;
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
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return deliveryRepository.findByRecipientIdOrderByCreatedAtDesc(userId, PageRequest.of(0, safeLimit));
    }

    @Transactional(readOnly = true)
    public NotificationSummaryResponse summaryForUser(UUID userId) {
        return new NotificationSummaryResponse(
            deliveryRepository.countByRecipientIdAndStatus(userId, NotificationDeliveryStatus.RECORDED),
            deliveryRepository.findLatestCreatedAtByRecipientId(userId)
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
        return deliveryRepository.save(delivery);
    }
}
