package com.merhouse.web;

import com.merhouse.dto.DashboardSummaryResponse;
import com.merhouse.service.DashboardService;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/merchant")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT')")
    public DashboardSummaryResponse merchant(@RequestParam(required = false) UUID merchantId) {
        return dashboardService.merchantSummary(merchantId);
    }

    @GetMapping("/warehouse")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'WAREHOUSE_OPERATOR')")
    public DashboardSummaryResponse warehouse(@RequestParam(required = false) UUID warehouseProviderId) {
        return dashboardService.warehouseSummary(warehouseProviderId);
    }
}
