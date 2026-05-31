package com.merhouse.dto;

import com.merhouse.entity.AssistantScope;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record AssistantInteractionRequest(
    AssistantScope scope,
    UUID targetTenantId,
    @NotBlank @Size(max = 2000) String prompt
) {
}
