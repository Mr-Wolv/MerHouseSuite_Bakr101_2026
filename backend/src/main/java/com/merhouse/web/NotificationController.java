package com.merhouse.web;

import com.merhouse.dto.NotificationDeliveryResponse;
import com.merhouse.dto.NotificationPreferenceResponse;
import com.merhouse.dto.NotificationPreferenceUpdateRequest;
import com.merhouse.dto.NotificationSummaryResponse;
import com.merhouse.entity.NotificationDeliveryStatus;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.NotificationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final CurrentUserService currentUserService;

    public NotificationController(NotificationService notificationService, CurrentUserService currentUserService) {
        this.notificationService = notificationService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/preferences")
    public List<NotificationPreferenceResponse> preferences() {
        UUID userId = currentUserService.required().id();
        return notificationService.preferencesForUser(userId).stream()
            .map(NotificationPreferenceResponse::from)
            .toList();
    }

    @GetMapping("/summary")
    public NotificationSummaryResponse summary() {
        return notificationService.summaryForUser(currentUserService.required().id());
    }

    @PatchMapping("/preferences")
    public NotificationPreferenceResponse updatePreference(@Valid @RequestBody NotificationPreferenceUpdateRequest request) {
        return NotificationPreferenceResponse.from(
            notificationService.updatePreference(currentUserService.required().id(), request)
        );
    }

    @GetMapping("/deliveries")
    public List<NotificationDeliveryResponse> deliveries(
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(required = false) NotificationDeliveryStatus status
    ) {
        return notificationService.deliveriesForUser(currentUserService.required().id(), limit, page, status).stream()
            .map(NotificationDeliveryResponse::from)
            .toList();
    }

    @PatchMapping("/deliveries/{id}/read")
    public NotificationDeliveryResponse markRead(@PathVariable UUID id) {
        return NotificationDeliveryResponse.from(notificationService.markRead(currentUserService.required().id(), id));
    }
}
