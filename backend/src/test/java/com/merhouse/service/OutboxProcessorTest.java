package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.OutboxEvent;
import com.merhouse.entity.OutboxEventStatus;
import com.merhouse.repository.OutboxEventRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

class OutboxProcessorTest {
    private final OutboxEventRepository outboxEventRepository = mock(OutboxEventRepository.class);

    @Test
    void processBatchMarksHandledEventsProcessed() {
        OutboxEvent event = event("ShipmentCreated");
        OutboxEventHandler handler = mock(OutboxEventHandler.class);
        when(handler.supports(event)).thenReturn(true);
        when(outboxEventRepository.findProcessable(any(Instant.class), eq(3), any(Pageable.class)))
            .thenReturn(List.of(event));
        when(outboxEventRepository.countByStatus(OutboxEventStatus.PENDING)).thenReturn(0L);
        when(outboxEventRepository.countByStatusAndAttemptsLessThan(OutboxEventStatus.FAILED, 3)).thenReturn(0L);

        OutboxProcessor processor = new OutboxProcessor(outboxEventRepository, List.of(handler), 3, true);

        OutboxProcessingResult result = processor.processBatch(10);

        assertEquals(1, result.processed());
        assertEquals(0, result.failed());
        assertEquals(1, event.getAttempts());
        assertEquals(OutboxEventStatus.PROCESSED, event.getStatusValue());
        assertNull(event.getLastError());
        verify(handler).handle(event);
    }

    @Test
    void processBatchMarksHandlerFailuresFailedAndRetryable() {
        OutboxEvent event = event("ShipmentCreated");
        OutboxEventHandler handler = mock(OutboxEventHandler.class);
        when(handler.supports(event)).thenReturn(true);
        when(outboxEventRepository.findProcessable(any(Instant.class), eq(3), any(Pageable.class)))
            .thenReturn(List.of(event));
        when(outboxEventRepository.countByStatus(OutboxEventStatus.PENDING)).thenReturn(0L);
        when(outboxEventRepository.countByStatusAndAttemptsLessThan(OutboxEventStatus.FAILED, 3)).thenReturn(1L);
        RuntimeException failure = new RuntimeException("carrier timeout");
        org.mockito.Mockito.doThrow(failure).when(handler).handle(event);

        OutboxProcessor processor = new OutboxProcessor(outboxEventRepository, List.of(handler), 3, true);

        OutboxProcessingResult result = processor.processBatch(10);

        assertEquals(0, result.processed());
        assertEquals(1, result.failed());
        assertEquals(1, event.getAttempts());
        assertEquals(OutboxEventStatus.FAILED, event.getStatusValue());
        assertEquals("carrier timeout", event.getLastError());
    }

    @Test
    void processBatchKeepsCurrentUnsupportedEventBehaviorVisible() {
        OutboxEvent event = event("OrderCreated");
        OutboxEventHandler handler = mock(OutboxEventHandler.class);
        when(handler.supports(event)).thenReturn(false);
        when(outboxEventRepository.findProcessable(any(Instant.class), eq(3), any(Pageable.class)))
            .thenReturn(List.of(event));

        OutboxProcessor processor = new OutboxProcessor(outboxEventRepository, List.of(handler), 3, true);

        OutboxProcessingResult result = processor.processBatch(10);

        assertEquals(1, result.processed());
        assertEquals(0, result.failed());
        assertEquals(OutboxEventStatus.PROCESSED, event.getStatusValue());
        verify(handler).supports(event);
        verify(handler, never()).handle(event);
    }

    private OutboxEvent event(String eventType) {
        OutboxEvent event = new OutboxEvent();
        event.setEventType(eventType);
        event.setAggregateType("TestAggregate");
        event.setAggregateId(UUID.randomUUID());
        event.setPayload(Map.of("eventType", eventType));
        event.setNextAttemptAt(Instant.now());
        return event;
    }
}
