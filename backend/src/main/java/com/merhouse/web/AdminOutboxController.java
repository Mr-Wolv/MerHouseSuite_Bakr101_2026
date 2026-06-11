package com.merhouse.web;

import com.merhouse.dto.AdminActionRequest;
import com.merhouse.dto.CarrierDispatchResponse;
import com.merhouse.dto.OutboxEventResponse;
import com.merhouse.dto.OutboxProcessResponse;
import com.merhouse.dto.OutboxSummaryResponse;
import com.merhouse.service.OutboxAdminService;
import com.merhouse.service.OutboxProcessingResult;
import com.merhouse.service.OutboxProcessor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/outbox")
@PreAuthorize("@currentUserService.isAdmin()")
public class AdminOutboxController {
    private final OutboxProcessor outboxProcessor;
    private final OutboxAdminService outboxAdminService;

    public AdminOutboxController(OutboxProcessor outboxProcessor, OutboxAdminService outboxAdminService) {
        this.outboxProcessor = outboxProcessor;
        this.outboxAdminService = outboxAdminService;
    }

    @GetMapping("/summary")
    public OutboxSummaryResponse summary() {
        return outboxAdminService.summary();
    }

    @GetMapping("/events")
    public List<OutboxEventResponse> events(@RequestParam(defaultValue = "25") int limit) {
        return outboxAdminService.recentEvents(limit);
    }

    @GetMapping("/carrier-dispatches")
    public List<CarrierDispatchResponse> carrierDispatches(@RequestParam(defaultValue = "25") int limit) {
        return outboxAdminService.recentCarrierDispatches(limit);
    }

    @PostMapping("/process")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public OutboxProcessResponse process(@RequestParam(defaultValue = "100") int limit) {
        OutboxProcessingResult result = outboxProcessor.processBatch(limit);
        return new OutboxProcessResponse(
            result.processed(),
            result.failed(),
            result.pending(),
            result.retryableFailed()
        );
    }

    @PostMapping("/events/{eventId}/retry")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public OutboxEventResponse retry(@PathVariable UUID eventId) {
        return outboxAdminService.retry(eventId);
    }

    @PostMapping("/events/{eventId}/dead-letter")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public OutboxEventResponse deadLetter(
        @PathVariable UUID eventId,
        @Valid @RequestBody AdminActionRequest request
    ) {
        return outboxAdminService.deadLetter(eventId, request.reason());
    }
}
