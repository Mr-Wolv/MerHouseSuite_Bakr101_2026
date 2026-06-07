package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.merhouse.dto.AdminPlatformSummaryResponse;
import com.merhouse.dto.AssistantActionDecisionRequest;
import com.merhouse.dto.AssistantInteractionRequest;
import com.merhouse.dto.DashboardSummaryResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.AssistantActionStatus;
import com.merhouse.entity.AssistantInteraction;
import com.merhouse.entity.AssistantInteractionType;
import com.merhouse.entity.AssistantScope;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.AssistantInteractionRepository;
import com.merhouse.repository.TenantRepository;
import com.merhouse.security.UserPrincipal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

class AssistantServiceTest {
    private final AssistantInteractionRepository interactionRepository = mock(AssistantInteractionRepository.class);
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final TenantRepository tenantRepository = mock(TenantRepository.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final DashboardService dashboardService = mock(DashboardService.class);
    private final AdminControlService adminControlService = mock(AdminControlService.class);
    private final AdminAuditService adminAuditService = mock(AdminAuditService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-05-30T12:00:00Z"), ZoneOffset.UTC);
    private final AssistantService service = new AssistantService(
        interactionRepository,
        userRepository,
        tenantRepository,
        currentUserService,
        dashboardService,
        adminControlService,
        adminAuditService,
        clock
    );

    @Test
    void merchantGetsOwnTenantScopedSummary() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(dashboardService.merchantSummary(tenantId)).thenReturn(new DashboardSummaryResponse(7, 2, 3, 4, 1, 5));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.MERCHANT_OPERATIONS,
            null,
            "Summarize my queues"
        ));

        assertEquals(AssistantInteractionType.SUMMARY, response.responseType());
        assertEquals(AssistantScope.MERCHANT_OPERATIONS, response.scope());
        assertEquals(userId, response.actorUserId());
        assertEquals(tenantId, response.actorTenantId());
        assertEquals(Instant.parse("2026-05-30T12:00:00Z"), response.createdAt());
        verify(dashboardService).merchantSummary(tenantId);
        verify(adminAuditService).record(
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.eq("ASSISTANT_SUMMARY"),
            org.mockito.ArgumentMatchers.eq("AssistantInteraction"),
            org.mockito.ArgumentMatchers.any(UUID.class),
            org.mockito.ArgumentMatchers.eq("Assistant generated scoped summary"),
            org.mockito.ArgumentMatchers.anyMap()
        );
    }

    @Test
    void nonAdminCrossTenantRequestIsAuditedRefusal() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID otherTenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.MERCHANT_OPERATIONS,
            otherTenantId,
            "Summarize that tenant"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals("I can only summarize your own tenant context.", response.responseText());
        verify(adminAuditService).record(
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.eq("ASSISTANT_REFUSAL"),
            org.mockito.ArgumentMatchers.eq("AssistantInteraction"),
            org.mockito.ArgumentMatchers.any(UUID.class),
            org.mockito.ArgumentMatchers.eq("Refused cross-tenant merchant scope"),
            org.mockito.ArgumentMatchers.anyMap()
        );
    }

    @Test
    void platformSummaryIsLimitedToPlatformRoles() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.ADMIN, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.ADMIN));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(adminControlService.summary()).thenReturn(new AdminPlatformSummaryResponse(
            4, 1, 6, 5, 3, 2, 7, 0, 8, 9, 1, 0, 2, 3, 4, 5
        ));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.PLATFORM_OVERVIEW,
            null,
            "Suggest what needs review next"
        ));

        assertEquals(AssistantInteractionType.SUGGESTION, response.responseType());
        assertEquals(AssistantActionStatus.PENDING, response.actionStatus());
        assertEquals(AssistantScope.PLATFORM_OVERVIEW, response.scope());
        assertTrue(response.responseText().contains(
            "Suggested next step: review failed outbox events first because integration delivery failures can block downstream notifications, shipment updates, and audit visibility."
        ));
        verify(adminControlService).summary();
    }

    @Test
    void platformSuggestionNamesHighestRiskQueueWithReason() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.OWNER, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.OWNER));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(adminControlService.summary()).thenReturn(new AdminPlatformSummaryResponse(
            4, 1, 6, 5, 3, 11, 7, 0, 8, 0, 26, 0, 0, 25, 25, 0
        ));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.PLATFORM_OVERVIEW,
            null,
            "What should I review next and why?"
        ));

        assertEquals(AssistantInteractionType.SUGGESTION, response.responseType());
        assertTrue(response.responseText().contains(
            "Suggested next step: review failed shipments first because failed carrier movement can block customer-visible fulfillment and expose service claims."
        ));
    }

    @Test
    void dashboardSuggestionPrioritizesExceptionsBeforeBackorders() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(dashboardService.merchantSummary(tenantId)).thenReturn(new DashboardSummaryResponse(7, 4, 3, 2, 1, 5));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.MERCHANT_OPERATIONS,
            null,
            "Suggest what needs review next"
        ));

        assertEquals(AssistantInteractionType.SUGGESTION, response.responseType());
        assertTrue(response.responseText().contains(
            "Suggested next step: review open exceptions first because unresolved exception work can block operators from moving the queue safely."
        ));
    }

    @Test
    void dashboardSuggestionGivesReadinessGuidanceWhenNoQueueIsOpen() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.WAREHOUSE_OPERATOR, TenantType.WAREHOUSE_PROVIDER);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.WAREHOUSE_OPERATOR));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(dashboardService.warehouseSummary(tenantId)).thenReturn(new DashboardSummaryResponse(0, 0, 0, 0, 0, 0));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.WAREHOUSE_OPERATIONS,
            null,
            "What is next?"
        ));

        assertEquals(AssistantInteractionType.SUGGESTION, response.responseType());
        assertTrue(response.responseText().contains(
            "Suggested next step: no active queue is currently open; verify relationships, inventory readiness, and recent audit activity before creating new work."
        ));
    }

    @Test
    void platformMerchantSummaryRefusesWarehouseTenantTarget() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID warehouseTenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.ADMIN, TenantType.MERCHANT);
        Tenant warehouseTenant = tenant(warehouseTenantId, TenantType.WAREHOUSE_PROVIDER);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.ADMIN));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(tenantRepository.findById(warehouseTenantId)).thenReturn(Optional.of(warehouseTenant));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.MERCHANT_OPERATIONS,
            warehouseTenantId,
            "Summarize this merchant"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals("Merchant summaries require a merchant tenant target.", response.responseText());
    }

    @Test
    void merchantCannotUsePlatformScope() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.PLATFORM_OVERVIEW,
            null,
            "Summarize platform risk"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals("Platform summaries are limited to platform roles.", response.responseText());
        verifyNoInteractions(adminControlService);
    }

    @Test
    void merchantCannotUseWarehouseScope() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.WAREHOUSE_OPERATIONS,
            null,
            "Summarize warehouse queues"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals("Warehouse summaries are limited to warehouse and platform roles.", response.responseText());
        verifyNoInteractions(dashboardService);
    }

    @Test
    void warehouseOperatorCannotUsePlatformScope() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.WAREHOUSE_OPERATOR, TenantType.WAREHOUSE_PROVIDER);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.WAREHOUSE_OPERATOR));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.PLATFORM_OVERVIEW,
            null,
            "Summarize platform risk"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals("Platform summaries are limited to platform roles.", response.responseText());
        verifyNoInteractions(adminControlService);
    }

    @Test
    void warehouseOperatorCannotUseMerchantScope() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.WAREHOUSE_OPERATOR, TenantType.WAREHOUSE_PROVIDER);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.WAREHOUSE_OPERATOR));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.MERCHANT_OPERATIONS,
            null,
            "Summarize merchant queues"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals("Merchant summaries are limited to merchant and platform roles.", response.responseText());
        verifyNoInteractions(dashboardService);
    }

    @Test
    void platformMerchantSummaryRefusesMissingTargetTenant() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID missingTenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.ADMIN, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.ADMIN));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(tenantRepository.findById(missingTenantId)).thenReturn(Optional.empty());
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.MERCHANT_OPERATIONS,
            missingTenantId,
            "Summarize this merchant"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals("Target tenant was not found.", response.responseText());
        verifyNoInteractions(dashboardService);
    }

    @Test
    void platformWarehouseSummaryRefusesMerchantTenantTarget() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID merchantTenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.ADMIN, TenantType.MERCHANT);
        Tenant merchantTenant = tenant(merchantTenantId, TenantType.MERCHANT);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.ADMIN));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(tenantRepository.findById(merchantTenantId)).thenReturn(Optional.of(merchantTenant));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.WAREHOUSE_OPERATIONS,
            merchantTenantId,
            "Summarize this warehouse"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals("Warehouse summaries require a warehouse-provider tenant target.", response.responseText());
        verifyNoInteractions(dashboardService);
    }

    @Test
    void recentHistoryOnlyUsesCurrentActorAndBoundsLimit() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(interactionRepository.findByActorIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 50)))
            .thenReturn(List.of());

        var response = service.recentForCurrentUser(200);

        assertEquals(List.of(), response);
        verify(interactionRepository).findByActorIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 50));
    }

    @Test
    void acceptsOwnPendingSuggestionAndAuditsDecision() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID interactionId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        AssistantInteraction interaction = interaction(interactionId, actor, AssistantInteractionType.SUGGESTION);
        interaction.setActionStatus(AssistantActionStatus.PENDING);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(interactionRepository.findById(interactionId)).thenReturn(Optional.of(interaction));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(interactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.accept(interactionId, new AssistantActionDecisionRequest("Review accepted by merchant operator"));

        assertEquals(AssistantActionStatus.ACCEPTED, response.actionStatus());
        assertEquals(userId, response.decidedByUserId());
        assertEquals("Review accepted by merchant operator", response.decisionNote());
        assertEquals(Instant.parse("2026-05-30T12:00:00Z"), response.decidedAt());
        verify(adminAuditService).record(
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.eq("ASSISTANT_SUGGESTION_ACCEPTED"),
            org.mockito.ArgumentMatchers.eq("AssistantInteraction"),
            org.mockito.ArgumentMatchers.eq(interactionId),
            org.mockito.ArgumentMatchers.eq("Review accepted by merchant operator"),
            org.mockito.ArgumentMatchers.anyMap()
        );
    }

    @Test
    void rejectsAlreadyDecidedSuggestion() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID interactionId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        AssistantInteraction interaction = interaction(interactionId, actor, AssistantInteractionType.SUGGESTION);
        interaction.setActionStatus(AssistantActionStatus.ACCEPTED);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(interactionRepository.findById(interactionId)).thenReturn(Optional.of(interaction));

        var thrown = assertThrows(
            com.merhouse.exception.DomainConflictException.class,
            () -> service.reject(interactionId, new AssistantActionDecisionRequest("Too late"))
        );

        assertEquals("Assistant suggestion has already been decided.", thrown.getMessage());
    }

    @Test
    void auditorCannotAcceptSuggestions() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID interactionId = UUID.randomUUID();
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.AUDITOR));

        var thrown = assertThrows(
            org.springframework.security.access.AccessDeniedException.class,
            () -> service.accept(interactionId, new AssistantActionDecisionRequest("Auditor reviewed"))
        );

        assertEquals("Auditors can review assistant activity but cannot decide suggestions.", thrown.getMessage());
    }

    @Test
    void mutationRequestIsRefusedBeforeOperationalSummary() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.WAREHOUSE_OPERATOR, TenantType.WAREHOUSE_PROVIDER);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.WAREHOUSE_OPERATOR));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(interactionRepository.save(any())).thenAnswer(invocation -> saved(invocation.getArgument(0)));

        var response = service.interact(new AssistantInteractionRequest(
            AssistantScope.WAREHOUSE_OPERATIONS,
            null,
            "Update the failed shipment now"
        ));

        assertEquals(AssistantInteractionType.REFUSAL, response.responseType());
        assertEquals(
            "I can summarize and suggest next review steps, but I cannot perform mutations or approve operational changes.",
            response.responseText()
        );
    }

    @Test
    void cannotDecideAnotherUsersSuggestion() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        UUID interactionId = UUID.randomUUID();
        AppUser owner = user(otherUserId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        AssistantInteraction interaction = interaction(interactionId, owner, AssistantInteractionType.SUGGESTION);
        interaction.setActionStatus(AssistantActionStatus.PENDING);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(interactionRepository.findById(interactionId)).thenReturn(Optional.of(interaction));

        var thrown = assertThrows(
            org.springframework.security.access.AccessDeniedException.class,
            () -> service.accept(interactionId, new AssistantActionDecisionRequest("I should not decide this"))
        );

        assertEquals("You cannot decide another user's assistant suggestion.", thrown.getMessage());
    }

    @Test
    void cannotDecideSummaryInteraction() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID interactionId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        AssistantInteraction interaction = interaction(interactionId, actor, AssistantInteractionType.SUMMARY);
        interaction.setActionStatus(AssistantActionStatus.NOT_APPLICABLE);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(interactionRepository.findById(interactionId)).thenReturn(Optional.of(interaction));

        var thrown = assertThrows(
            com.merhouse.exception.DomainConflictException.class,
            () -> service.accept(interactionId, new AssistantActionDecisionRequest("Accept summary"))
        );

        assertEquals("Only assistant suggestions can be accepted or rejected.", thrown.getMessage());
    }

    @Test
    void rejectsOwnPendingSuggestionAndAuditsDecision() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID interactionId = UUID.randomUUID();
        AppUser actor = user(userId, tenantId, UserRole.MERCHANT, TenantType.MERCHANT);
        AssistantInteraction interaction = interaction(interactionId, actor, AssistantInteractionType.SUGGESTION);
        interaction.setActionStatus(AssistantActionStatus.PENDING);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(interactionRepository.findById(interactionId)).thenReturn(Optional.of(interaction));
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(actor));
        when(interactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.reject(interactionId, new AssistantActionDecisionRequest("Review rejected by merchant operator"));

        assertEquals(AssistantActionStatus.REJECTED, response.actionStatus());
        assertEquals(userId, response.decidedByUserId());
        assertEquals("Review rejected by merchant operator", response.decisionNote());
        verify(adminAuditService).record(
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.eq("ASSISTANT_SUGGESTION_REJECTED"),
            org.mockito.ArgumentMatchers.eq("AssistantInteraction"),
            org.mockito.ArgumentMatchers.eq(interactionId),
            org.mockito.ArgumentMatchers.eq("Review rejected by merchant operator"),
            org.mockito.ArgumentMatchers.anyMap()
        );
    }

    private UserPrincipal principal(UUID userId, UUID tenantId, UserRole role) {
        return new UserPrincipal(userId, tenantId, "user@merhouse.local", role, true);
    }

    private AppUser user(UUID userId, UUID tenantId, UserRole role, TenantType tenantType) {
        Tenant tenant = tenant(tenantId, tenantType);

        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", userId);
        user.setTenant(tenant);
        user.setEmail("user@merhouse.local");
        user.setRole(role);
        user.setEnabled(true);
        return user;
    }

    private Tenant tenant(UUID tenantId, TenantType tenantType) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", tenantId);
        tenant.setName("Tenant");
        tenant.setType(tenantType);
        return tenant;
    }

    private AssistantInteraction saved(AssistantInteraction interaction) {
        ReflectionTestUtils.setField(interaction, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(interaction, "createdAt", Instant.parse("2026-05-30T12:00:00Z"));
        return interaction;
    }

    private AssistantInteraction interaction(
        UUID interactionId,
        AppUser actor,
        AssistantInteractionType responseType
    ) {
        AssistantInteraction interaction = new AssistantInteraction();
        ReflectionTestUtils.setField(interaction, "id", interactionId);
        ReflectionTestUtils.setField(interaction, "createdAt", Instant.parse("2026-05-30T11:55:00Z"));
        interaction.setActor(actor);
        interaction.setActorTenant(actor.getTenant());
        interaction.setScope(AssistantScope.MERCHANT_OPERATIONS);
        interaction.setResponseType(responseType);
        interaction.setRequestText("Suggest what needs review");
        interaction.setResponseText("Suggested next step: review open exceptions first because unresolved exception work can block operators from moving the queue safely.");
        return interaction;
    }
}
