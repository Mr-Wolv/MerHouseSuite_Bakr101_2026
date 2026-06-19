package com.merhouse.web;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.merhouse.config.JacksonConfig;
import com.merhouse.dto.NotificationPreferenceUpdateRequest;
import com.merhouse.dto.NotificationSummaryResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationChannel;
import com.merhouse.entity.NotificationDelivery;
import com.merhouse.entity.NotificationDeliveryStage;
import com.merhouse.entity.NotificationDeliveryStatus;
import com.merhouse.entity.NotificationPreference;
import com.merhouse.entity.NotificationProviderStatus;
import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.UserPrincipal;
import com.merhouse.service.AppUserDetailsService;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.NotificationService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({NotificationController.class, ApiExceptionHandler.class})
@AutoConfigureMockMvc(addFilters = false)
@Import(JacksonConfig.class)
class NotificationControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private NotificationService notificationService;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private AppUserDetailsService appUserDetailsService;

    @MockitoBean
    private AppUserRepository appUserRepository;

    @Test
    void summaryUsesAuthenticatedUserScope() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(notificationService.summaryForUser(userId))
            .thenReturn(new NotificationSummaryResponse(2, Instant.parse("2026-05-29T12:00:00Z")));

        mockMvc.perform(get("/api/v1/notifications/summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.unreadCount").value(2))
            .andExpect(jsonPath("$.latestDeliveryAt").value("2026-05-29T12:00:00Z"));

        verify(notificationService).summaryForUser(userId);
    }

    @Test
    void preferencesUseAuthenticatedUserScope() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        NotificationPreference preference = new NotificationPreference();
        preference.setUser(user(userId, tenantId));
        preference.setTopic(NotificationTopic.ACCOUNT_LIFECYCLE);
        preference.setChannel(NotificationChannel.IN_APP);
        preference.setEnabled(true);
        ReflectionTestUtils.setField(preference, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(preference, "updatedAt", Instant.parse("2026-05-29T12:00:00Z"));
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.ADMIN));
        when(notificationService.preferencesForUser(userId)).thenReturn(List.of(preference));

        mockMvc.perform(get("/api/v1/notifications/preferences"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].topic").value("ACCOUNT_LIFECYCLE"))
            .andExpect(jsonPath("$[0].channel").value("IN_APP"))
            .andExpect(jsonPath("$[0].enabled").value(true));

        verify(notificationService).preferencesForUser(userId);
    }

    @Test
    void updatePreferenceUsesAuthenticatedUserScope() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        NotificationPreference preference = new NotificationPreference();
        preference.setUser(user(userId, tenantId));
        preference.setTopic(NotificationTopic.OUTBOX_HEALTH);
        preference.setChannel(NotificationChannel.IN_APP);
        preference.setEnabled(false);
        ReflectionTestUtils.setField(preference, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(preference, "updatedAt", Instant.parse("2026-05-29T12:00:00Z"));
        var request = new NotificationPreferenceUpdateRequest(
            NotificationTopic.OUTBOX_HEALTH,
            NotificationChannel.IN_APP,
            false
        );
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.SUPPORT_ADMIN));
        when(notificationService.updatePreference(userId, request)).thenReturn(preference);

        mockMvc.perform(patch("/api/v1/notifications/preferences")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.topic").value("OUTBOX_HEALTH"))
            .andExpect(jsonPath("$.channel").value("IN_APP"))
            .andExpect(jsonPath("$.enabled").value(false));

        verify(notificationService).updatePreference(userId, request);
    }

    @Test
    void deliveriesUseAuthenticatedUserScope() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        NotificationDelivery delivery = delivery(userId, tenantId);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.WAREHOUSE_OPERATOR));
        when(notificationService.deliveriesForUser(userId, 25, 0, null)).thenReturn(List.of(delivery));

        mockMvc.perform(get("/api/v1/notifications/deliveries").param("limit", "25"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].recipientUserId").value(userId.toString()))
            .andExpect(jsonPath("$[0].tenantId").value(tenantId.toString()))
            .andExpect(jsonPath("$[0].deliveryStage").value("LOCAL_RECORDED"))
            .andExpect(jsonPath("$[0].providerStatus").value("NOT_CONFIGURED"))
            .andExpect(jsonPath("$[0].title").value("Scoped alert"));

        verify(notificationService).deliveriesForUser(userId, 25, 0, null);
    }

    @Test
    void deliveriesCanBeFilteredByStatusForActionInbox() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        NotificationDelivery delivery = delivery(userId, tenantId);
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.MERCHANT));
        when(notificationService.deliveriesForUser(userId, 50, 1, NotificationDeliveryStatus.RECORDED)).thenReturn(List.of(delivery));

        mockMvc.perform(get("/api/v1/notifications/deliveries")
                .param("limit", "50")
                .param("page", "1")
                .param("status", "RECORDED"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].status").value("RECORDED"))
            .andExpect(jsonPath("$[0].title").value("Scoped alert"));

        verify(notificationService).deliveriesForUser(userId, 50, 1, NotificationDeliveryStatus.RECORDED);
    }

    @Test
    void markReadUsesAuthenticatedUserScopeAndPathDeliveryOnly() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID deliveryId = UUID.randomUUID();
        NotificationDelivery delivery = delivery(userId, tenantId);
        ReflectionTestUtils.setField(delivery, "id", deliveryId);
        delivery.setStatus(NotificationDeliveryStatus.READ);
        delivery.setDeliveryStage(NotificationDeliveryStage.LOCAL_RECORDED);
        delivery.setProviderStatus(NotificationProviderStatus.NOT_CONFIGURED);
        delivery.setReadAt(Instant.parse("2026-05-29T12:01:00Z"));
        when(currentUserService.required()).thenReturn(principal(userId, tenantId, UserRole.AUDITOR));
        when(notificationService.markRead(userId, deliveryId)).thenReturn(delivery);

        mockMvc.perform(patch("/api/v1/notifications/deliveries/{id}/read", deliveryId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(deliveryId.toString()))
            .andExpect(jsonPath("$.status").value("READ"));

        verify(notificationService).markRead(userId, deliveryId);
    }

    private UserPrincipal principal(UUID userId, UUID tenantId, UserRole role) {
        return new UserPrincipal(userId, tenantId, "user@merhouse.local", role, true);
    }

    private AppUser user(UUID userId, UUID tenantId) {
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", tenantId);
        tenant.setName("Tenant");
        tenant.setType(TenantType.MERCHANT);

        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", userId);
        user.setTenant(tenant);
        user.setEmail("user@merhouse.local");
        user.setRole(UserRole.MERCHANT);
        user.setEnabled(true);
        return user;
    }

    private NotificationDelivery delivery(UUID userId, UUID tenantId) {
        AppUser recipient = user(userId, tenantId);
        NotificationDelivery delivery = new NotificationDelivery();
        ReflectionTestUtils.setField(delivery, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(delivery, "createdAt", Instant.parse("2026-05-29T12:00:00Z"));
        delivery.setRecipient(recipient);
        delivery.setTenant(recipient.getTenant());
        delivery.setTopic(NotificationTopic.ACCOUNT_LIFECYCLE);
        delivery.setChannel(NotificationChannel.IN_APP);
        delivery.setStatus(NotificationDeliveryStatus.RECORDED);
        delivery.setDeliveryStage(NotificationDeliveryStage.LOCAL_RECORDED);
        delivery.setProviderStatus(NotificationProviderStatus.NOT_CONFIGURED);
        delivery.setTitle("Scoped alert");
        delivery.setBody("Only the recipient should see this local delivery record.");
        delivery.setPrototypeLocal(true);
        return delivery;
    }
}
