package com.merhouse.service;

import com.merhouse.entity.AssistantInteractionType;
import java.util.Map;

public record AssistantDraft(
    AssistantInteractionType responseType,
    String responseText,
    Map<String, Object> metadata,
    String auditReason
) {
}
