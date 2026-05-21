package com.merhouse.dto;

public record OutboxSummaryResponse(
    long pending,
    long processed,
    long failed,
    long retryableFailed
) {
}
