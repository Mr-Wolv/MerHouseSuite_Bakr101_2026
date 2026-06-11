package com.merhouse.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "notification_deliveries")
public class NotificationDelivery {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_user_id", nullable = false)
    private AppUser recipient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48)
    private NotificationTopic topic;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NotificationChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NotificationDeliveryStatus status = NotificationDeliveryStatus.RECORDED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48)
    private NotificationDeliveryStage deliveryStage = NotificationDeliveryStage.LOCAL_RECORDED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48)
    private NotificationProviderStatus providerStatus = NotificationProviderStatus.NOT_CONFIGURED;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 1000)
    private String body;

    @Column(length = 80)
    private String sourceType;

    private UUID sourceId;

    @Column(nullable = false)
    private boolean prototypeLocal = true;

    @Column(length = 160)
    private String providerMessageId;

    @Column(length = 1000)
    private String providerError;

    private Instant providerAttemptedAt;

    private Instant providerSentAt;

    private Instant providerFailedAt;

    @Column(nullable = false)
    private int providerRetryCount = 0;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant readAt;

    public UUID getId() {
        return id;
    }

    public AppUser getRecipient() {
        return recipient;
    }

    public void setRecipient(AppUser recipient) {
        this.recipient = recipient;
    }

    public Tenant getTenant() {
        return tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public NotificationTopic getTopic() {
        return topic;
    }

    public void setTopic(NotificationTopic topic) {
        this.topic = topic;
    }

    public NotificationChannel getChannel() {
        return channel;
    }

    public void setChannel(NotificationChannel channel) {
        this.channel = channel;
    }

    public NotificationDeliveryStatus getStatus() {
        return status;
    }

    public void setStatus(NotificationDeliveryStatus status) {
        this.status = status;
    }

    public NotificationDeliveryStage getDeliveryStage() {
        return deliveryStage;
    }

    public void setDeliveryStage(NotificationDeliveryStage deliveryStage) {
        this.deliveryStage = deliveryStage;
    }

    public NotificationProviderStatus getProviderStatus() {
        return providerStatus;
    }

    public void setProviderStatus(NotificationProviderStatus providerStatus) {
        this.providerStatus = providerStatus;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public UUID getSourceId() {
        return sourceId;
    }

    public void setSourceId(UUID sourceId) {
        this.sourceId = sourceId;
    }

    public boolean isPrototypeLocal() {
        return prototypeLocal;
    }

    public void setPrototypeLocal(boolean prototypeLocal) {
        this.prototypeLocal = prototypeLocal;
    }

    public String getProviderMessageId() {
        return providerMessageId;
    }

    public void setProviderMessageId(String providerMessageId) {
        this.providerMessageId = providerMessageId;
    }

    public String getProviderError() {
        return providerError;
    }

    public void setProviderError(String providerError) {
        this.providerError = providerError;
    }

    public Instant getProviderAttemptedAt() {
        return providerAttemptedAt;
    }

    public void setProviderAttemptedAt(Instant providerAttemptedAt) {
        this.providerAttemptedAt = providerAttemptedAt;
    }

    public Instant getProviderSentAt() {
        return providerSentAt;
    }

    public void setProviderSentAt(Instant providerSentAt) {
        this.providerSentAt = providerSentAt;
    }

    public Instant getProviderFailedAt() {
        return providerFailedAt;
    }

    public void setProviderFailedAt(Instant providerFailedAt) {
        this.providerFailedAt = providerFailedAt;
    }

    public int getProviderRetryCount() {
        return providerRetryCount;
    }

    public void setProviderRetryCount(int providerRetryCount) {
        this.providerRetryCount = providerRetryCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public void setReadAt(Instant readAt) {
        this.readAt = readAt;
    }
}
