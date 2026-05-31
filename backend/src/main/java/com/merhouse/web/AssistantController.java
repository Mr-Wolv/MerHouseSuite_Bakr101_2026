package com.merhouse.web;

import com.merhouse.dto.AssistantActionDecisionRequest;
import com.merhouse.dto.AssistantInteractionRequest;
import com.merhouse.dto.AssistantInteractionResponse;
import com.merhouse.service.AssistantService;
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
@RequestMapping("/api/v1/assistant")
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'MERCHANT', 'WAREHOUSE_OPERATOR')")
public class AssistantController {
    private final AssistantService assistantService;

    public AssistantController(AssistantService assistantService) {
        this.assistantService = assistantService;
    }

    @PostMapping("/interactions")
    public AssistantInteractionResponse interact(@Valid @RequestBody AssistantInteractionRequest request) {
        return assistantService.interact(request);
    }

    @GetMapping("/interactions")
    public List<AssistantInteractionResponse> recent(@RequestParam(defaultValue = "25") int limit) {
        return assistantService.recentForCurrentUser(limit);
    }

    @PostMapping("/interactions/{id}/accept")
    public AssistantInteractionResponse accept(
        @PathVariable UUID id,
        @Valid @RequestBody AssistantActionDecisionRequest request
    ) {
        return assistantService.accept(id, request);
    }

    @PostMapping("/interactions/{id}/reject")
    public AssistantInteractionResponse reject(
        @PathVariable UUID id,
        @Valid @RequestBody AssistantActionDecisionRequest request
    ) {
        return assistantService.reject(id, request);
    }
}
