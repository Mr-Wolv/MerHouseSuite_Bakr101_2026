package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.OutboxEvent;
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
    private final OutboxAdminService service = new OutboxAdminService(outboxEventRepository, carrierDispatchRepository, 3);

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
