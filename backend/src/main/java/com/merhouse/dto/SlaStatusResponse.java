package com.merhouse.dto;

import com.merhouse.entity.ServiceSourceType;
import java.util.UUID;

public record SlaStatusResponse(
    ServiceSourceType sourceType,
    UUID sourceId,
    String status,
    Integer targetHours,
    Long elapsedHours,
    String label
) {
}
