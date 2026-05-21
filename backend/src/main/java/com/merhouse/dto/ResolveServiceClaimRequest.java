package com.merhouse.dto;

import com.merhouse.entity.ServiceClaimStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResolveServiceClaimRequest(
    @NotNull ServiceClaimStatus status,
    @Size(max = 1000) String outcomeNote
) {
}
