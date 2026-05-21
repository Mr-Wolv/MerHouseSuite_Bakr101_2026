package com.merhouse.entity;

public enum OutboxEventStatus {
    PENDING,
    PROCESSED,
    FAILED,
    DEAD_LETTER
}
