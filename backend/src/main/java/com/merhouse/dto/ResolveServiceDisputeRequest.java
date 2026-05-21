package com.merhouse.dto;

import com.merhouse.entity.ServiceDisputeStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResolveServiceDisputeRequest(
    @NotNull ServiceDisputeStatus status,
    @Size(max = 1000) String outcomeNote
) {
}
