package com.merhouse.service;

import com.merhouse.dto.AssistantActionDecisionRequest;
import com.merhouse.dto.AssistantInteractionRequest;
import com.merhouse.dto.AssistantInteractionResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.AssistantActionStatus;
import com.merhouse.entity.AssistantInteraction;
import com.merhouse.entity.AssistantInteractionType;
import com.merhouse.entity.AssistantScope;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.AssistantInteractionRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssistantService {
    private final AssistantInteractionRepository interactionRepository;
    private final AppUserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final AdminAuditService adminAuditService;
    private final AssistantRuntime assistantRuntime;
    private final Clock clock;

    public AssistantService(
        AssistantInteractionRepository interactionRepository,
        AppUserRepository userRepository,
        CurrentUserService currentUserService,
        AdminAuditService adminAuditService,
        AssistantRuntime assistantRuntime,
        Clock clock
    ) {
        this.interactionRepository = interactionRepository;
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
        this.adminAuditService = adminAuditService;
        this.assistantRuntime = assistantRuntime;
        this.clock = clock;
    }

    @Transactional
    public AssistantInteractionResponse interact(AssistantInteractionRequest request) {
        var principal = currentUserService.required();
        AppUser actor = userRepository.findWithTenantById(principal.id()).orElseThrow();
        AssistantScope scope = request.scope() == null ? defaultScope(principal.role()) : request.scope();
        String prompt = request.prompt().trim();

        AssistantDraft draft = assistantRuntime.draft(new AssistantRuntimeRequest(
            principal.role(),
            principal.tenantId(),
            scope,
            request.targetTenantId(),
            prompt
        ));
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
                "agentMode", String.valueOf(draft.metadata().getOrDefault("agentMode", "deterministic")),
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

}
