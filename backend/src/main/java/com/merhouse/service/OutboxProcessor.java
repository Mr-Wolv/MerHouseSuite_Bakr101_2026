package com.merhouse.service;

import com.merhouse.entity.OutboxEvent;
import com.merhouse.entity.OutboxEventStatus;
import com.merhouse.repository.OutboxEventRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class OutboxProcessor {
    private static final Logger log = LoggerFactory.getLogger(OutboxProcessor.class);

    private final OutboxEventRepository outboxEventRepository;
    private final OutboxAlertService outboxAlertService;
    private final List<OutboxEventHandler> handlers;
    private final TransactionTemplate transactionTemplate;
    private final int maxAttempts;
    private final boolean pollerEnabled;

    public OutboxProcessor(
        OutboxEventRepository outboxEventRepository,
        OutboxAlertService outboxAlertService,
        List<OutboxEventHandler> handlers,
        TransactionTemplate transactionTemplate,
        @Value("${warehouse.outbox.max-attempts:3}") int maxAttempts,
        @Value("${warehouse.outbox.poller.enabled:true}") boolean pollerEnabled
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.outboxAlertService = outboxAlertService;
        this.handlers = handlers;
        this.transactionTemplate = transactionTemplate;
        this.maxAttempts = maxAttempts;
        this.pollerEnabled = pollerEnabled;
    }

    @Scheduled(
        initialDelayString = "${warehouse.outbox.poller.initial-delay-ms:60000}",
        fixedDelayString = "${warehouse.outbox.poller.fixed-delay-ms:10000}"
    )
    public void poll() {
        if (pollerEnabled) {
            processBatch(25);
        }
    }

    public OutboxProcessingResult processBatch(int limit) {
        List<OutboxEvent> events = outboxEventRepository.findProcessable(
            Instant.now(),
            maxAttempts,
            PageRequest.of(0, Math.max(1, limit))
        );

        int processed = 0;
        int failed = 0;
        for (OutboxEvent event : events) {
            try {
                Boolean success = transactionTemplate.execute(status -> {
                    event.setAttempts(event.getAttempts() + 1);
                    dispatch(event);
                    event.setStatus(OutboxEventStatus.PROCESSED);
                    event.setProcessedAt(Instant.now());
                    event.setLastError(null);
                    event.setNextAttemptAt(Instant.now());
                    outboxEventRepository.save(event);
                    return Boolean.TRUE;
                });
                if (Boolean.TRUE.equals(success)) {
                    processed++;
                } else {
                    failed++;
                }
            } catch (RuntimeException exception) {
                // Transaction already rolled back; record failure outside the transaction.
                transactionTemplate.executeWithoutResult(status -> {
                    event.setStatus(OutboxEventStatus.FAILED);
                    event.setLastError(exception.getMessage());
                    event.setNextAttemptAt(nextAttemptAt(event.getAttempts()));
                    outboxEventRepository.save(event);
                });
                outboxAlertService.recordHealthAlert(
                    "Outbox event failed",
                    event.getEventType() + " failed on attempt " + event.getAttempts()
                        + ": " + exception.getMessage(),
                    event.getAggregateType(),
                    event.getAggregateId()
                );
                log.warn("Outbox event {} failed: {}", event.getId(), exception.getMessage());
                failed++;
            }
        }

        return new OutboxProcessingResult(
            processed,
            failed,
            outboxEventRepository.countByStatus(OutboxEventStatus.PENDING),
            outboxEventRepository.countByStatusAndAttemptsLessThan(OutboxEventStatus.FAILED, maxAttempts)
        );
    }

    private void dispatch(OutboxEvent event) {
        handlers.stream()
            .filter(handler -> handler.supports(event))
            .findFirst()
            .ifPresent(handler -> handler.handle(event));
    }

    private Instant nextAttemptAt(int attempts) {
        long delaySeconds = (long) Math.pow(2, Math.max(0, attempts - 1)) * 30L;
        return Instant.now().plus(delaySeconds, ChronoUnit.SECONDS);
    }

}
