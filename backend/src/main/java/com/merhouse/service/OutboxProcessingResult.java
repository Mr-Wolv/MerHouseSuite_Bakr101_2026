package com.merhouse.service;

public record OutboxProcessingResult(
    int processed,
    int failed,
    long pending,
    long retryableFailed
) {
}
