package com.merhouse.service;

import com.merhouse.dto.CarrierDispatchResponse;
import com.merhouse.dto.OutboxEventResponse;
import com.merhouse.dto.OutboxSummaryResponse;
import com.merhouse.entity.OutboxEvent;
import com.merhouse.entity.OutboxEventStatus;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.CarrierDispatchRepository;
import com.merhouse.repository.OutboxEventRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxAdminService {
    private final OutboxEventRepository outboxEventRepository;
    private final CarrierDispatchRepository carrierDispatchRepository;
    private final OutboxAlertService outboxAlertService;
    private final int maxAttempts;

    public OutboxAdminService(
        OutboxEventRepository outboxEventRepository,
        CarrierDispatchRepository carrierDispatchRepository,
        OutboxAlertService outboxAlertService,
        @Value("${warehouse.outbox.max-attempts:3}") int maxAttempts
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.carrierDispatchRepository = carrierDispatchRepository;
        this.outboxAlertService = outboxAlertService;
        this.maxAttempts = maxAttempts;
    }

    @Transactional(readOnly = true)
    public OutboxSummaryResponse summary() {
        return new OutboxSummaryResponse(
            outboxEventRepository.countByStatus(OutboxEventStatus.PENDING),
            outboxEventRepository.countByStatus(OutboxEventStatus.PROCESSED),
            outboxEventRepository.countByStatus(OutboxEventStatus.FAILED),
            outboxEventRepository.countByStatusAndAttemptsLessThan(OutboxEventStatus.FAILED, maxAttempts)
        );
    }

    @Transactional(readOnly = true)
    public List<OutboxEventResponse> recentEvents(int limit) {
        return outboxEventRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, boundedLimit(limit))).stream()
            .map(OutboxEventResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<CarrierDispatchResponse> recentCarrierDispatches(int limit) {
        return carrierDispatchRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, boundedLimit(limit))).stream()
            .map(CarrierDispatchResponse::from)
            .toList();
    }

    @Transactional
    public OutboxEventResponse retry(UUID eventId) {
        OutboxEvent event = getRequired(eventId);
        if (event.getStatusValue() != OutboxEventStatus.FAILED) {
            throw new DomainConflictException("Only FAILED outbox events can be retried.");
        }
        event.setStatus(OutboxEventStatus.PENDING);
        event.setNextAttemptAt(Instant.now());
        event.setLastError(null);
        OutboxEvent saved = outboxEventRepository.save(event);
        outboxAlertService.recordHealthAlert(
            "Outbox retry queued",
            saved.getEventType() + " was returned to the processing queue.",
            saved.getAggregateType(),
            saved.getAggregateId()
        );
        return OutboxEventResponse.from(saved);
    }

    @Transactional
    public OutboxEventResponse deadLetter(UUID eventId, String reason) {
        OutboxEvent event = getRequired(eventId);
        if (event.getStatusValue() == OutboxEventStatus.PROCESSED) {
            throw new DomainConflictException("Processed outbox events cannot be moved to dead-letter.");
        }
        event.setStatus(OutboxEventStatus.DEAD_LETTER);
        event.setLastError(trimToNull(reason));
        OutboxEvent saved = outboxEventRepository.save(event);
        outboxAlertService.recordHealthAlert(
            "Outbox event parked",
            saved.getEventType() + " moved to dead-letter"
                + (saved.getLastError() == null ? "." : ": " + saved.getLastError()),
            saved.getAggregateType(),
            saved.getAggregateId()
        );
        return OutboxEventResponse.from(saved);
    }

    private OutboxEvent getRequired(UUID eventId) {
        return outboxEventRepository.findById(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Outbox event not found: " + eventId));
    }

    private int boundedLimit(int limit) {
        return Math.max(1, Math.min(limit, 100));
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

}
