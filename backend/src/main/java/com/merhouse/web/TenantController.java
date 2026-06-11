package com.merhouse.web;

import com.merhouse.dto.AdminActionRequest;
import com.merhouse.dto.CreateTenantRequest;
import com.merhouse.dto.TenantResponse;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.TenantService;
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
@RequestMapping("/api/v1/tenants")
@PreAuthorize("@currentUserService.isAdmin()")
public class TenantController {
    private final TenantService tenantService;
    private final CurrentUserService currentUserService;
    private final AdminAuditService adminAuditService;

    public TenantController(
        TenantService tenantService,
        CurrentUserService currentUserService,
        AdminAuditService adminAuditService
    ) {
        this.tenantService = tenantService;
        this.currentUserService = currentUserService;
        this.adminAuditService = adminAuditService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public TenantResponse create(@Valid @RequestBody CreateTenantRequest request) {
        var tenant = tenantService.create(request);
        adminAuditService.record(currentUserService.required().id(), "TENANT_CREATED", "Tenant", tenant.getId(), "Tenant created");
        return TenantResponse.from(tenant);
    }

    @GetMapping
    public List<TenantResponse> list() {
        return tenantService.findAll().stream()
            .map(TenantResponse::from)
            .toList();
    }

    @PatchMapping("/{id}/suspend")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public TenantResponse suspend(@PathVariable UUID id, @Valid @RequestBody AdminActionRequest request) {
        var tenant = tenantService.suspend(id, request.reason());
        adminAuditService.record(currentUserService.required().id(), "TENANT_SUSPENDED", "Tenant", id, request.reason());
        return TenantResponse.from(tenant);
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public TenantResponse activate(@PathVariable UUID id, @Valid @RequestBody AdminActionRequest request) {
        var tenant = tenantService.activate(id);
        adminAuditService.record(currentUserService.required().id(), "TENANT_ACTIVATED", "Tenant", id, request.reason());
        return TenantResponse.from(tenant);
    }
}
