package com.merhouse.service;

import com.merhouse.dto.AdminPlatformSummaryResponse;
import com.merhouse.dto.AssistantActionDecisionRequest;
import com.merhouse.dto.AssistantInteractionRequest;
import com.merhouse.dto.AssistantInteractionResponse;
import com.merhouse.dto.DashboardSummaryResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.AssistantActionStatus;
import com.merhouse.entity.AssistantInteraction;
import com.merhouse.entity.AssistantInteractionType;
import com.merhouse.entity.AssistantScope;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.AssistantInteractionRepository;
import com.merhouse.repository.TenantRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssistantService {
    private final AssistantInteractionRepository interactionRepository;
    private final AppUserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final CurrentUserService currentUserService;
    private final DashboardService dashboardService;
    private final AdminControlService adminControlService;
    private final AdminAuditService adminAuditService;
    private final Clock clock;
    private final String agentMode;
    private final String agentModelName;

    public AssistantService(
        AssistantInteractionRepository interactionRepository,
        AppUserRepository userRepository,
        TenantRepository tenantRepository,
        CurrentUserService currentUserService,
        DashboardService dashboardService,
        AdminControlService adminControlService,
        AdminAuditService adminAuditService,
        Clock clock,
        @Value("${merhouse.agent.mode:deterministic}") String agentMode,
        @Value("${merhouse.agent.model-name:}") String agentModelName
    ) {
        this.interactionRepository = interactionRepository;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.currentUserService = currentUserService;
        this.dashboardService = dashboardService;
        this.adminControlService = adminControlService;
        this.adminAuditService = adminAuditService;
        this.clock = clock;
        this.agentMode = agentMode == null || agentMode.isBlank() ? "deterministic" : agentMode.trim();
        this.agentModelName = agentModelName == null ? "" : agentModelName.trim();
    }

    @Transactional
    public AssistantInteractionResponse interact(AssistantInteractionRequest request) {
        var principal = currentUserService.required();
        AppUser actor = userRepository.findWithTenantById(principal.id()).orElseThrow();
        AssistantScope scope = request.scope() == null ? defaultScope(principal.role()) : request.scope();
        String prompt = request.prompt().trim();

        AssistantDraft draft = draftFor(principal.role(), principal.tenantId(), scope, request.targetTenantId(), prompt);
        AssistantInteraction interaction = new AssistantInteraction();
        interaction.setActor(actor);
        interaction.setActorTenant(actor.getTenant());
        interaction.setScope(scope);
        interaction.setTargetTenantId(request.targetTenantId());
        interaction.setRequestText(prompt);
        interaction.setResponseType(draft.responseType());
        interaction.setActionStatus(draft.responseType() == AssistantInteractionType.SUGGESTION
            ? AssistantActionStatus.PENDING
            : AssistantActionStatus.NOT_APPLICABLE);
        interaction.setResponseText(draft.responseText());
        interaction.setPrototypeLocal(true);
        interaction.setMetadata(draft.metadata());
        interaction.setCreatedAt(Instant.now(clock));
        AssistantInteraction saved = interactionRepository.save(interaction);

        adminAuditService.record(
            principal.id(),
            "ASSISTANT_" + draft.responseType().name(),
            "AssistantInteraction",
            saved.getId(),
            draft.auditReason(),
            Map.of(
                "scope", scope.name(),
                "targetTenantId", request.targetTenantId() == null ? "" : request.targetTenantId().toString(),
                "prototypeLocal", true,
                "agentMode", agentMode,
                "agenticWork", "read-plus-draft"
            )
        );
        return AssistantInteractionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<AssistantInteractionResponse> recentForCurrentUser(int limit) {
        UUID userId = currentUserService.required().id();
        int bounded = Math.max(1, Math.min(limit, 50));
        return interactionRepository.findByActorIdOrderByCreatedAtDesc(userId, PageRequest.of(0, bounded)).stream()
            .map(AssistantInteractionResponse::from)
            .toList();
    }

    @Transactional
    public AssistantInteractionResponse accept(UUID interactionId, AssistantActionDecisionRequest request) {
        return decide(interactionId, request, AssistantActionStatus.ACCEPTED, "ASSISTANT_SUGGESTION_ACCEPTED");
    }

    @Transactional
    public AssistantInteractionResponse reject(UUID interactionId, AssistantActionDecisionRequest request) {
        return decide(interactionId, request, AssistantActionStatus.REJECTED, "ASSISTANT_SUGGESTION_REJECTED");
    }

    private AssistantInteractionResponse decide(
        UUID interactionId,
        AssistantActionDecisionRequest request,
        AssistantActionStatus status,
        String auditAction
    ) {
        var principal = currentUserService.required();
        if (principal.role() == UserRole.AUDITOR) {
            throw new AccessDeniedException("Auditors can review assistant activity but cannot decide suggestions.");
        }
        AssistantInteraction interaction = interactionRepository.findById(interactionId)
            .orElseThrow(() -> new ResourceNotFoundException("Assistant interaction not found."));
        if (!interaction.getActor().getId().equals(principal.id())) {
            throw new AccessDeniedException("You cannot decide another user's assistant suggestion.");
        }
        if (interaction.getResponseType() != AssistantInteractionType.SUGGESTION) {
            throw new DomainConflictException("Only assistant suggestions can be accepted or rejected.");
        }
        if (interaction.getActionStatus() != AssistantActionStatus.PENDING) {
            throw new DomainConflictException("Assistant suggestion has already been decided.");
        }
        AppUser actor = userRepository.findWithTenantById(principal.id()).orElseThrow();
        interaction.setActionStatus(status);
        interaction.setDecidedBy(actor);
        interaction.setDecisionNote(request.reason().trim());
        interaction.setDecidedAt(Instant.now(clock));
        AssistantInteraction saved = interactionRepository.save(interaction);

        adminAuditService.record(
            principal.id(),
            auditAction,
            "AssistantInteraction",
            saved.getId(),
            request.reason(),
            Map.of(
                "scope", saved.getScope().name(),
                "actionStatus", status.name(),
                "prototypeLocal", true
            )
        );
        return AssistantInteractionResponse.from(saved);
    }

    private AssistantScope defaultScope(UserRole role) {
        if (role.isPlatformAdmin()) {
            return AssistantScope.PLATFORM_OVERVIEW;
        }
        if (role == UserRole.WAREHOUSE_OPERATOR) {
            return AssistantScope.WAREHOUSE_OPERATIONS;
        }
        return AssistantScope.MERCHANT_OPERATIONS;
    }

    private AssistantDraft draftFor(
        UserRole role,
        UUID actorTenantId,
        AssistantScope scope,
        UUID targetTenantId,
        String prompt
    ) {
        if (asksForMutation(prompt)) {
            return refusal(
                "I can summarize and suggest next review steps, but I cannot perform mutations or approve operational changes.",
                scope,
                "Refused mutation request"
            );
        }
        if (scope == AssistantScope.PLATFORM_OVERVIEW) {
            if (!role.isPlatformAdmin()) {
                return refusal("Platform summaries are limited to platform roles.", scope, "Refused platform scope");
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
                prompt,
                scope,
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

        if (scope == AssistantScope.MERCHANT_OPERATIONS) {
            UUID tenantId = role.isPlatformAdmin() ? targetTenantId : actorTenantId;
            if (tenantId == null) {
                return refusal("Merchant summaries for platform roles require a target merchant tenant.", scope, "Missing target merchant tenant");
            }
            if (role.isPlatformAdmin()) {
                Optional<TenantType> targetTenantType = targetTenantType(tenantId);
                if (targetTenantType.isEmpty()) {
                    return refusal("Target tenant was not found.", scope, "Refused missing tenant target");
                }
                if (targetTenantType.get() != TenantType.MERCHANT) {
                    return refusal("Merchant summaries require a merchant tenant target.", scope, "Refused non-merchant tenant target");
                }
            }
            if (!role.isPlatformAdmin() && role != UserRole.MERCHANT) {
                return refusal("Merchant summaries are limited to merchant and platform roles.", scope, "Refused merchant scope");
            }
            if (!role.isPlatformAdmin() && targetTenantId != null && !targetTenantId.equals(actorTenantId)) {
                return refusal("I can only summarize your own tenant context.", scope, "Refused cross-tenant merchant scope");
            }
            return dashboardDraft(prompt, scope, dashboardService.merchantSummary(tenantId));
        }

        UUID tenantId = role.isPlatformAdmin() ? targetTenantId : actorTenantId;
        if (tenantId == null) {
            return refusal("Warehouse summaries for platform roles require a target warehouse-provider tenant.", scope, "Missing target warehouse tenant");
        }
        if (role.isPlatformAdmin()) {
            Optional<TenantType> targetTenantType = targetTenantType(tenantId);
            if (targetTenantType.isEmpty()) {
                return refusal("Target tenant was not found.", scope, "Refused missing tenant target");
            }
            if (targetTenantType.get() != TenantType.WAREHOUSE_PROVIDER) {
                return refusal("Warehouse summaries require a warehouse-provider tenant target.", scope, "Refused non-warehouse tenant target");
            }
        }
        if (!role.isPlatformAdmin() && role != UserRole.WAREHOUSE_OPERATOR) {
            return refusal("Warehouse summaries are limited to warehouse and platform roles.", scope, "Refused warehouse scope");
        }
        if (!role.isPlatformAdmin() && targetTenantId != null && !targetTenantId.equals(actorTenantId)) {
            return refusal("I can only summarize your own tenant context.", scope, "Refused cross-tenant warehouse scope");
        }
        return dashboardDraft(prompt, scope, dashboardService.warehouseSummary(tenantId));
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
                "mutationPolicy", "human-executes"
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
                "mutationPolicy", "refused"
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

    private record AssistantDraft(
        AssistantInteractionType responseType,
        String responseText,
        Map<String, Object> metadata,
        String auditReason
    ) {
    }
}
