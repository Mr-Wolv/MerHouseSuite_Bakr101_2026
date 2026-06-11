package com.merhouse.dto;

import com.merhouse.entity.AssistantInteraction;
import com.merhouse.entity.AssistantActionStatus;
import com.merhouse.entity.AssistantInteractionType;
import com.merhouse.entity.AssistantScope;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record AssistantInteractionResponse(
    UUID id,
    UUID actorUserId,
    UUID actorTenantId,
    AssistantScope scope,
    UUID targetTenantId,
    AssistantInteractionType responseType,
    AssistantActionStatus actionStatus,
    String requestText,
    String responseText,
    boolean prototypeLocal,
    UUID decidedByUserId,
    String decisionNote,
    Instant decidedAt,
    Map<String, Object> metadata,
    Instant createdAt
) {
    public static AssistantInteractionResponse from(AssistantInteraction interaction) {
        return new AssistantInteractionResponse(
            interaction.getId(),
            interaction.getActor().getId(),
            interaction.getActorTenant().getId(),
            interaction.getScope(),
            interaction.getTargetTenantId(),
            interaction.getResponseType(),
            interaction.getActionStatus(),
            interaction.getRequestText(),
            interaction.getResponseText(),
            interaction.isPrototypeLocal(),
            interaction.getDecidedBy() == null ? null : interaction.getDecidedBy().getId(),
            interaction.getDecisionNote(),
            interaction.getDecidedAt(),
            interaction.getMetadata(),
            interaction.getCreatedAt()
        );
    }
}
