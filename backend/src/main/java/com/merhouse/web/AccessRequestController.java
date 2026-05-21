package com.merhouse.web;

import com.merhouse.dto.AccessRequestConvertRequest;
import com.merhouse.dto.AccessRequestCreateRequest;
import com.merhouse.dto.AccessRequestResponse;
import com.merhouse.dto.AccessRequestReviewRequest;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.AccessRequestService;
import com.merhouse.service.CurrentUserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/access-requests")
public class AccessRequestController {
    private final AccessRequestService accessRequestService;
    private final CurrentUserService currentUserService;
    private final AdminAuditService adminAuditService;

    public AccessRequestController(
        AccessRequestService accessRequestService,
        CurrentUserService currentUserService,
        AdminAuditService adminAuditService
    ) {
        this.accessRequestService = accessRequestService;
        this.currentUserService = currentUserService;
        this.adminAuditService = adminAuditService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccessRequestResponse submit(@Valid @RequestBody AccessRequestCreateRequest request) {
        return AccessRequestResponse.from(accessRequestService.submit(request));
    }

    @GetMapping
    @PreAuthorize("@currentUserService.isAdmin()")
    public List<AccessRequestResponse> list() {
        return accessRequestService.findAll().stream()
            .map(AccessRequestResponse::from)
            .toList();
    }

    @PatchMapping("/{id}/approve")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public AccessRequestResponse approve(@PathVariable UUID id, @Valid @RequestBody AccessRequestReviewRequest request) {
        return AccessRequestResponse.from(accessRequestService.approve(id, currentUserService.required().id(), request));
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public AccessRequestResponse reject(@PathVariable UUID id, @Valid @RequestBody AccessRequestReviewRequest request) {
        return AccessRequestResponse.from(accessRequestService.reject(id, currentUserService.required().id(), request));
    }

    @PatchMapping("/{id}/convert")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public AccessRequestResponse convert(
        @PathVariable UUID id,
        @Valid @RequestBody AccessRequestConvertRequest request
    ) {
        UUID actorId = currentUserService.required().id();
        var converted = accessRequestService.convert(id, actorId, request);
        adminAuditService.record(actorId, "ACCESS_REQUEST_CONVERTED", "AccessRequest", id, request.reason());
        return AccessRequestResponse.from(converted);
    }
}
