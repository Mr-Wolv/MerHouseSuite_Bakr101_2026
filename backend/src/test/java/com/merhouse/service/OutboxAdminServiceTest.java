package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.OutboxEvent;
import com.merhouse.entity.OutboxEventStatus;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.CarrierDispatchRepository;
import com.merhouse.repository.OutboxEventRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class OutboxAdminServiceTest {
    private final OutboxEventRepository outboxEventRepository = mock(OutboxEventRepository.class);
    private final CarrierDispatchRepository carrierDispatchRepository = mock(CarrierDispatchRepository.class);
    private final OutboxAlertService outboxAlertService = mock(OutboxAlertService.class);
    private final OutboxAdminService service = new OutboxAdminService(
        outboxEventRepository,
        carrierDispatchRepository,
        outboxAlertService,
        3
    );

    @Test
    void summaryExposesRetryableFailuresAsAttentionSignals() {
        when(outboxEventRepository.countByStatus(OutboxEventStatus.PENDING)).thenReturn(2L);
        when(outboxEventRepository.countByStatus(OutboxEventStatus.PROCESSED)).thenReturn(7L);
        when(outboxEventRepository.countByStatus(OutboxEventStatus.FAILED)).thenReturn(3L);
        when(outboxEventRepository.countByStatusAndAttemptsLessThan(OutboxEventStatus.FAILED, 3)).thenReturn(1L);

        var response = service.summary();

        assertEquals(2L, response.pending());
        assertEquals(3L, response.failed());
        assertEquals(1, response.attentionSignals().size());
        assertTrue(response.attentionSignals().getFirst().route().equals("/admin/outbox"));
        assertEquals("CRITICAL", response.attentionSignals().getFirst().severity().name());
    }

    @Test
    void retryOnlyAllowsFailedEventsAndClearsLastError() {
        OutboxEvent event = event("FAILED");
        event.setLastError("carrier timeout");
        when(outboxEventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(outboxEventRepository.save(event)).thenReturn(event);

        var response = service.retry(event.getId());

        assertEquals("PENDING", response.status());
        assertNull(response.lastError());
        verify(outboxEventRepository).save(event);
        verify(outboxAlertService).recordHealthAlert(
            eq("Outbox retry queued"),
            contains("returned to the processing queue"),
            eq("Shipment"),
            eq(event.getAggregateId())
        );
    }

    @Test
    void retryRejectsNonFailedEvents() {
        OutboxEvent event = event("PENDING");
        when(outboxEventRepository.findById(event.getId())).thenReturn(Optional.of(event));

        assertThrows(DomainConflictException.class, () -> service.retry(event.getId()));
    }

    @Test
    void deadLetterRejectsProcessedEvents() {
        OutboxEvent event = event("PROCESSED");
        when(outboxEventRepository.findById(event.getId())).thenReturn(Optional.of(event));

        assertThrows(DomainConflictException.class, () -> service.deadLetter(event.getId(), "Too late"));
    }

    @Test
    void deadLetterStoresReasonAsLastError() {
        OutboxEvent event = event("PENDING");
        when(outboxEventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(outboxEventRepository.save(event)).thenReturn(event);

        var response = service.deadLetter(event.getId(), "  reviewed and parked  ");

        assertEquals("DEAD_LETTER", response.status());
        assertEquals("reviewed and parked", response.lastError());
        verify(outboxAlertService).recordHealthAlert(
            eq("Outbox event parked"),
            contains("reviewed and parked"),
            eq("Shipment"),
            eq(event.getAggregateId())
        );
    }

    private OutboxEvent event(String status) {
        OutboxEvent event = new OutboxEvent();
        ReflectionTestUtils.setField(event, "id", UUID.randomUUID());
        event.setEventType("ShipmentCreated");
        event.setAggregateType("Shipment");
        event.setAggregateId(UUID.randomUUID());
        event.setStatus(status);
        return event;
    }
}
