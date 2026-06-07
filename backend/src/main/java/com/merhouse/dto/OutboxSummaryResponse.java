package com.merhouse.dto;

import java.util.List;

public record OutboxSummaryResponse(
    long pending,
    long processed,
    long failed,
    long retryableFailed,
    List<AttentionSignalResponse> attentionSignals
) {
    public OutboxSummaryResponse(long pending, long processed, long failed, long retryableFailed) {
        this(pending, processed, failed, retryableFailed, List.of());
    }
}
