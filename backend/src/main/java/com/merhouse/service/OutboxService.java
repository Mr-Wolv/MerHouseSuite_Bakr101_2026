package com.merhouse.service;

import com.merhouse.entity.OutboxEvent;
import com.merhouse.repository.OutboxEventRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class OutboxService {
    private final OutboxEventRepository outboxEventRepository;

    public OutboxService(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    public void publish(String eventType, String aggregateType, UUID aggregateId, Map<String, Object> payload) {
        OutboxEvent event = new OutboxEvent();
        event.setEventType(eventType);
        event.setAggregateType(aggregateType);
        event.setAggregateId(aggregateId);
        event.setPayload(payload);
        outboxEventRepository.save(event);
    }
}
