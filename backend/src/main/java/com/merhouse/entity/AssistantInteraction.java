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
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "assistant_interactions")
public class AssistantInteraction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private AppUser actor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_tenant_id", nullable = false)
    private Tenant actorTenant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48)
    private AssistantScope scope;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AssistantInteractionType responseType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AssistantActionStatus actionStatus = AssistantActionStatus.NOT_APPLICABLE;

    @Column(name = "target_tenant_id")
    private UUID targetTenantId;

    @Column(nullable = false, length = 2000)
    private String requestText;

    @Column(nullable = false, length = 4000)
    private String responseText;

    @Column(nullable = false)
    private boolean prototypeLocal = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_user_id")
    private AppUser decidedBy;

    @Column(length = 1000)
    private String decisionNote;

    private Instant decidedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> metadata = Map.of();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public AppUser getActor() {
        return actor;
    }

    public void setActor(AppUser actor) {
        this.actor = actor;
    }

    public Tenant getActorTenant() {
        return actorTenant;
    }

    public void setActorTenant(Tenant actorTenant) {
        this.actorTenant = actorTenant;
    }

    public AssistantScope getScope() {
        return scope;
    }

    public void setScope(AssistantScope scope) {
        this.scope = scope;
    }

    public AssistantInteractionType getResponseType() {
        return responseType;
    }

    public void setResponseType(AssistantInteractionType responseType) {
        this.responseType = responseType;
    }

    public AssistantActionStatus getActionStatus() {
        return actionStatus;
    }

    public void setActionStatus(AssistantActionStatus actionStatus) {
        this.actionStatus = actionStatus;
    }

    public UUID getTargetTenantId() {
        return targetTenantId;
    }

    public void setTargetTenantId(UUID targetTenantId) {
        this.targetTenantId = targetTenantId;
    }

    public String getRequestText() {
        return requestText;
    }

    public void setRequestText(String requestText) {
        this.requestText = requestText;
    }

    public String getResponseText() {
        return responseText;
    }

    public void setResponseText(String responseText) {
        this.responseText = responseText;
    }

    public boolean isPrototypeLocal() {
        return prototypeLocal;
    }

    public void setPrototypeLocal(boolean prototypeLocal) {
        this.prototypeLocal = prototypeLocal;
    }

    public AppUser getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(AppUser decidedBy) {
        this.decidedBy = decidedBy;
    }

    public String getDecisionNote() {
        return decisionNote;
    }

    public void setDecisionNote(String decisionNote) {
        this.decisionNote = decisionNote;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(Instant decidedAt) {
        this.decidedAt = decidedAt;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
