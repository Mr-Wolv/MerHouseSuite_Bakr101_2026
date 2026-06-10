package com.merhouse.service;

import com.merhouse.entity.AssistantScope;
import com.merhouse.entity.UserRole;
import java.util.UUID;

public record AssistantRuntimeRequest(
    UserRole role,
    UUID actorTenantId,
    AssistantScope scope,
    UUID targetTenantId,
    String prompt
) {
}
