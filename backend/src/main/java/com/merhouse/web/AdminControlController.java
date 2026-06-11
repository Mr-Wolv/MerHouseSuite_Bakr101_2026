package com.merhouse.web;

import com.merhouse.dto.AdminAuditEventResponse;
import com.merhouse.dto.AdminPlatformSummaryResponse;
import com.merhouse.dto.AdminTenantHealthResponse;
import com.merhouse.service.AdminControlService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/control")
@PreAuthorize("@currentUserService.isAdmin()")
public class AdminControlController {
    private final AdminControlService adminControlService;

    public AdminControlController(AdminControlService adminControlService) {
        this.adminControlService = adminControlService;
    }

    @GetMapping("/summary")
    public AdminPlatformSummaryResponse summary() {
        return adminControlService.summary();
    }

    @GetMapping("/tenant-health")
    public List<AdminTenantHealthResponse> tenantHealth() {
        return adminControlService.tenantHealth();
    }

    @GetMapping("/tenant-health/{tenantId}")
    public AdminTenantHealthResponse tenantHealthDetail(@PathVariable UUID tenantId) {
        return adminControlService.tenantHealth(tenantId);
    }

    @GetMapping("/audit-events")
    public List<AdminAuditEventResponse> auditEvents(@RequestParam(defaultValue = "50") int limit) {
        return adminControlService.auditEvents(limit);
    }
}
