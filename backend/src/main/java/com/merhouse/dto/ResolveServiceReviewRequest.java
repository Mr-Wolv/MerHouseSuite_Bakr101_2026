package com.merhouse.dto;

import com.merhouse.entity.ServiceReviewStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResolveServiceReviewRequest(
    @NotNull ServiceReviewStatus status,
    @Size(max = 1000) String outcomeNote
) {
}
