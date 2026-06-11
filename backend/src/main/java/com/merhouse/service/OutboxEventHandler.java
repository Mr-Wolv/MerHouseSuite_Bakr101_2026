package com.merhouse.service;

import com.merhouse.entity.OutboxEvent;

public interface OutboxEventHandler {
    boolean supports(OutboxEvent event);

    void handle(OutboxEvent event);
}
