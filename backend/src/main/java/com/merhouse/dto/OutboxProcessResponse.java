package com.merhouse.dto;

public record OutboxProcessResponse(
    int processed,
    int failed,
    long pending,
    long retryableFailed
) {
}
