package com.merhouse.service;

import com.merhouse.dto.AdminPlatformSummaryResponse;
import com.merhouse.dto.DashboardSummaryResponse;
import com.merhouse.entity.AssistantInteractionType;
import com.merhouse.entity.AssistantScope;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.TenantRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DeterministicAssistantRuntime implements AssistantRuntime {
    private final TenantRepository tenantRepository;
    private final DashboardService dashboardService;
    private final AdminControlService adminControlService;
    private final String agentMode;
    private final String agentModelName;

    public DeterministicAssistantRuntime(
        TenantRepository tenantRepository,
        DashboardService dashboardService,
        AdminControlService adminControlService,
        @Value("${merhouse.agent.mode:deterministic}") String agentMode,
        @Value("${merhouse.agent.model-name:}") String agentModelName
    ) {
        this.tenantRepository = tenantRepository;
        this.dashboardService = dashboardService;
        this.adminControlService = adminControlService;
        this.agentMode = agentMode == null || agentMode.isBlank() ? "deterministic" : agentMode.trim();
        this.agentModelName = agentModelName == null ? "" : agentModelName.trim();
    }

    @Override
    public AssistantDraft draft(AssistantRuntimeRequest request) {
        if (asksForMutation(request.prompt())) {
            return refusal(
                "I can summarize and suggest next review steps, but I cannot perform mutations or approve operational changes.",
                request.scope(),
                "Refused mutation request"
            );
        }
        if (request.scope() == AssistantScope.PLATFORM_OVERVIEW) {
            if (!request.role().isPlatformAdmin()) {
                return refusal("Platform summaries are limited to platform roles.", request.scope(), "Refused platform scope");
            }
            AdminPlatformSummaryResponse summary = adminControlService.summary();
            Map<String, Object> metrics = Map.of(
                "pendingAccessRequests", summary.pendingAccessRequests(),
                "failedShipments", summary.failedShipments(),
                "openFulfillmentExceptions", summary.openFulfillmentExceptions(),
                "openServiceDisputes", summary.openServiceDisputes(),
                "openServiceClaims", summary.openServiceClaims(),
                "failedOutboxEvents", summary.failedOutboxEvents(),
                "pendingServiceReviews", summary.pendingServiceReviews()
            );
            return successfulDraft(
                request.prompt(),
                request.scope(),
                "Platform has %d pending access requests, %d failed shipments, %d open service disputes, %d open service claims, and %d failed outbox events."
                    .formatted(
                        summary.pendingAccessRequests(),
                        summary.failedShipments(),
                        summary.openServiceDisputes(),
                        summary.openServiceClaims(),
                        summary.failedOutboxEvents()
                    ),
                metrics,
                platformSuggestion(summary)
            );
        }

        if (request.scope() == AssistantScope.MERCHANT_OPERATIONS) {
            UUID tenantId = request.role().isPlatformAdmin() ? request.targetTenantId() : request.actorTenantId();
            if (tenantId == null) {
                return refusal("Merchant summaries for platform roles require a target merchant tenant.", request.scope(), "Missing target merchant tenant");
            }
            if (request.role().isPlatformAdmin()) {
                Optional<TenantType> targetTenantType = targetTenantType(tenantId);
                if (targetTenantType.isEmpty()) {
                    return refusal("Target tenant was not found.", request.scope(), "Refused missing tenant target");
                }
                if (targetTenantType.get() != TenantType.MERCHANT) {
                    return refusal("Merchant summaries require a merchant tenant target.", request.scope(), "Refused non-merchant tenant target");
                }
            }
            if (!request.role().isPlatformAdmin() && request.role() != UserRole.MERCHANT) {
                return refusal("Merchant summaries are limited to merchant and platform roles.", request.scope(), "Refused merchant scope");
            }
            if (!request.role().isPlatformAdmin() && request.targetTenantId() != null && !request.targetTenantId().equals(request.actorTenantId())) {
                return refusal("I can only summarize your own tenant context.", request.scope(), "Refused cross-tenant merchant scope");
            }
            return dashboardDraft(request.prompt(), request.scope(), dashboardService.merchantSummary(tenantId));
        }

        UUID tenantId = request.role().isPlatformAdmin() ? request.targetTenantId() : request.actorTenantId();
        if (tenantId == null) {
            return refusal("Warehouse summaries for platform roles require a target warehouse-provider tenant.", request.scope(), "Missing target warehouse tenant");
        }
        if (request.role().isPlatformAdmin()) {
            Optional<TenantType> targetTenantType = targetTenantType(tenantId);
            if (targetTenantType.isEmpty()) {
                return refusal("Target tenant was not found.", request.scope(), "Refused missing tenant target");
            }
            if (targetTenantType.get() != TenantType.WAREHOUSE_PROVIDER) {
                return refusal("Warehouse summaries require a warehouse-provider tenant target.", request.scope(), "Refused non-warehouse tenant target");
            }
        }
        if (!request.role().isPlatformAdmin() && request.role() != UserRole.WAREHOUSE_OPERATOR) {
            return refusal("Warehouse summaries are limited to warehouse and platform roles.", request.scope(), "Refused warehouse scope");
        }
        if (!request.role().isPlatformAdmin() && request.targetTenantId() != null && !request.targetTenantId().equals(request.actorTenantId())) {
            return refusal("I can only summarize your own tenant context.", request.scope(), "Refused cross-tenant warehouse scope");
        }
        return dashboardDraft(request.prompt(), request.scope(), dashboardService.warehouseSummary(tenantId));
    }

    private Optional<TenantType> targetTenantType(UUID tenantId) {
        return tenantRepository.findById(tenantId)
            .map(tenant -> tenant.getType());
    }

    private AssistantDraft dashboardDraft(String prompt, AssistantScope scope, DashboardSummaryResponse summary) {
        Map<String, Object> metrics = Map.of(
            "orders", summary.orders(),
            "openBackorders", summary.openBackorders(),
            "deliveredShipments", summary.deliveredShipments(),
            "inboundOpen", summary.inboundOpen(),
            "stockRisk", summary.stockRisk(),
            "openExceptions", summary.openExceptions()
        );
        String text = "%s summary: %d orders or workload items, %d open backorders, %d delivered shipments, %d open inbound requests, %d stock-risk rows, and %d open exceptions."
            .formatted(
                scope == AssistantScope.MERCHANT_OPERATIONS ? "Merchant operations" : "Warehouse operations",
                summary.orders(),
                summary.openBackorders(),
                summary.deliveredShipments(),
                summary.inboundOpen(),
                summary.stockRisk(),
                summary.openExceptions()
            );
        return successfulDraft(prompt, scope, text, metrics, dashboardSuggestion(summary));
    }

    private AssistantDraft successfulDraft(
        String prompt,
        AssistantScope scope,
        String baseText,
        Map<String, Object> metrics,
        String suggestion
    ) {
        boolean wantsSuggestion = prompt.toLowerCase().contains("suggest") || prompt.toLowerCase().contains("next");
        String response = wantsSuggestion
            ? baseText + " " + suggestion
            : baseText;
        return new AssistantDraft(
            wantsSuggestion ? AssistantInteractionType.SUGGESTION : AssistantInteractionType.SUMMARY,
            response,
            Map.of(
                "metrics", metrics,
                "scope", scope.name(),
                "prototypeLocal", true,
                "agentMode", agentMode,
                "agentModelName", agentModelName,
                "agenticWork", "read-plus-draft",
                "mutationPolicy", "human-executes",
                "runtime", "deterministic"
            ),
            wantsSuggestion ? "Assistant generated scoped suggestion" : "Assistant generated scoped summary"
        );
    }

    private String platformSuggestion(AdminPlatformSummaryResponse summary) {
        if (summary.failedOutboxEvents() > 0) {
            return "Suggested next step: review failed outbox events first because integration delivery failures can block downstream notifications, shipment updates, and audit visibility.";
        }
        if (summary.failedShipments() > 0) {
            return "Suggested next step: review failed shipments first because failed carrier movement can block customer-visible fulfillment and expose service claims.";
        }
        if (summary.openFulfillmentExceptions() > 0) {
            return "Suggested next step: review fulfillment exceptions first because unresolved warehouse execution issues can stop orders from progressing safely.";
        }
        if (summary.openServiceClaims() > 0) {
            return "Suggested next step: review open service claims first because claim work usually needs evidence and resolution before routine governance queues.";
        }
        if (summary.openServiceDisputes() > 0) {
            return "Suggested next step: review open service disputes first because unresolved dispute evidence can delay accountability decisions.";
        }
        if (summary.pendingAccessRequests() > 0) {
            return "Suggested next step: review pending access requests first because onboarding decisions determine who can enter the operational workspace.";
        }
        if (summary.pendingServiceReviews() > 0) {
            return "Suggested next step: review pending service reviews first because fresh feedback can reveal relationship or fulfillment quality risk.";
        }
        return "Suggested next step: no high-risk platform queue is currently open; review recent audit activity and keep routine governance checks moving.";
    }

    private String dashboardSuggestion(DashboardSummaryResponse summary) {
        if (summary.openExceptions() > 0) {
            return "Suggested next step: review open exceptions first because unresolved exception work can block operators from moving the queue safely.";
        }
        if (summary.openBackorders() > 0) {
            return "Suggested next step: review open backorders first because they represent demand that cannot be fulfilled from available stock.";
        }
        if (summary.stockRisk() > 0) {
            return "Suggested next step: review stock-risk rows first because inventory exposure can turn into backorders or failed fulfillment.";
        }
        if (summary.inboundOpen() > 0) {
            return "Suggested next step: review open inbound requests first because receiving progress can unblock inventory and fulfillment capacity.";
        }
        if (summary.orders() > 0) {
            return "Suggested next step: review the active workload first because it is the remaining operational queue that can still move today.";
        }
        return "Suggested next step: no active queue is currently open; verify relationships, inventory readiness, and recent audit activity before creating new work.";
    }

    private AssistantDraft refusal(String message, AssistantScope scope, String auditReason) {
        return new AssistantDraft(
            AssistantInteractionType.REFUSAL,
            message,
            Map.of(
                "scope", scope.name(),
                "prototypeLocal", true,
                "agentMode", agentMode,
                "agentModelName", agentModelName,
                "agenticWork", "read-plus-draft",
                "mutationPolicy", "refused",
                "runtime", "deterministic"
            ),
            auditReason
        );
    }

    private boolean asksForMutation(String prompt) {
        String normalized = prompt.toLowerCase();
        return List.of(
            "approve ",
            "cancel ",
            "create ",
            "delete ",
            "disable ",
            "enable ",
            "reset ",
            "ship ",
            "settle ",
            "suspend ",
            "update "
        ).stream().anyMatch(normalized::contains);
    }
}
