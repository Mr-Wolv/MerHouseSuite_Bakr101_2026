package com.merhouse.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.merhouse.config.JacksonConfig;
import com.merhouse.dto.AccessRequestCreateRequest;
import com.merhouse.dto.AccessRequestReviewRequest;
import com.merhouse.entity.AccessRequest;
import com.merhouse.entity.AccessRequestStatus;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.JwtService;
import com.merhouse.security.UserPrincipal;
import com.merhouse.service.AccessRequestService;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.AppUserDetailsService;
import com.merhouse.service.CurrentUserService;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({AccessRequestController.class, ApiExceptionHandler.class})
@AutoConfigureMockMvc(addFilters = false)
@Import(JacksonConfig.class)
class AccessRequestControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AccessRequestService accessRequestService;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private AdminAuditService adminAuditService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private AppUserDetailsService appUserDetailsService;

    @MockitoBean
    private AppUserRepository appUserRepository;

    @Test
    void submitNormalizesCopiedPublicFieldsBeforeValidation() throws Exception {
        AccessRequest pending = accessRequest(UUID.randomUUID(), AccessRequestStatus.PENDING);
        when(accessRequestService.submit(eq(new AccessRequestCreateRequest(
            "New Merchant",
            "merchant@merhouse.local",
            UserRole.MERCHANT,
            "Please onboard us"
        )))).thenReturn(pending);

        mockMvc.perform(post("/api/v1/access-requests")
                .contentType("application/json")
                .content("""
                    {
                      "organizationName": " New Merchant ",
                      "requesterEmail": " merchant@merhouse.local ",
                      "requestedRole": "MERCHANT",
                      "notes": " Please onboard us "
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.requesterEmail").value("merchant@merhouse.local"))
            .andExpect(jsonPath("$.status").value("PENDING"));

        verify(accessRequestService).submit(new AccessRequestCreateRequest(
            "New Merchant",
            "merchant@merhouse.local",
            UserRole.MERCHANT,
            "Please onboard us"
        ));
    }

    @Test
    void approveRecordsPrivilegedAuditEvent() throws Exception {
        UUID requestId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        AccessRequest approved = accessRequest(requestId, AccessRequestStatus.APPROVED);
        when(currentUserService.required()).thenReturn(new UserPrincipal(actorId, UUID.randomUUID(), "owner@merhouse.local", UserRole.OWNER, true));
        when(accessRequestService.approve(eq(requestId), eq(actorId), eq(new AccessRequestReviewRequest("Looks valid"))))
            .thenReturn(approved);

        mockMvc.perform(patch("/api/v1/access-requests/{id}/approve", requestId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new AccessRequestReviewRequest("Looks valid"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPROVED"));

        verify(adminAuditService).record(
            actorId,
            "ACCESS_REQUEST_APPROVED",
            "AccessRequest",
            requestId,
            "Looks valid"
        );
    }

    @Test
    void rejectRecordsPrivilegedAuditEvent() throws Exception {
        UUID requestId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        AccessRequest rejected = accessRequest(requestId, AccessRequestStatus.REJECTED);
        when(currentUserService.required()).thenReturn(new UserPrincipal(actorId, UUID.randomUUID(), "admin@merhouse.local", UserRole.ADMIN, true));
        when(accessRequestService.reject(eq(requestId), eq(actorId), eq(new AccessRequestReviewRequest("Not enough context"))))
            .thenReturn(rejected);

        mockMvc.perform(patch("/api/v1/access-requests/{id}/reject", requestId)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new AccessRequestReviewRequest("Not enough context"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("REJECTED"));

        verify(adminAuditService).record(
            actorId,
            "ACCESS_REQUEST_REJECTED",
            "AccessRequest",
            requestId,
            "Not enough context"
        );
    }

    private AccessRequest accessRequest(UUID id, AccessRequestStatus status) {
        AccessRequest request = new AccessRequest();
        ReflectionTestUtils.setField(request, "id", id);
        ReflectionTestUtils.setField(request, "createdAt", Instant.parse("2026-06-07T00:00:00Z"));
        request.setOrganizationName("New Merchant");
        request.setRequesterEmail("merchant@merhouse.local");
        request.setRequestedRole(UserRole.MERCHANT);
        request.setStatus(status);
        return request;
    }
}
