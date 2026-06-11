package com.merhouse.dto;

import com.merhouse.entity.ServiceSourceType;
import java.util.UUID;

public record SlaStatusResponse(
    ServiceSourceType sourceType,
    UUID sourceId,
    String status,
    Integer targetHours,
    Long elapsedHours,
    String label,
    AttentionSignalResponse attentionSignal
) {
    public SlaStatusResponse(
        ServiceSourceType sourceType,
        UUID sourceId,
        String status,
        Integer targetHours,
        Long elapsedHours,
        String label
    ) {
        this(sourceType, sourceId, status, targetHours, elapsedHours, label, null);
    }
}
