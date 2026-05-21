package com.merhouse.dto;

import com.merhouse.entity.ServiceSourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateServiceClaimRequest(
    @NotNull ServiceSourceType sourceType,
    UUID sourceId,
    @NotBlank @Size(max = 80) String claimType,
    @NotBlank @Size(max = 160) String reason,
    @Size(max = 1000) String evidenceNote
) {
}
