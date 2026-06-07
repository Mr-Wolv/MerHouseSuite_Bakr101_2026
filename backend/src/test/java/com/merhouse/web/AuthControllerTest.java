package com.merhouse.web;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.merhouse.config.JacksonConfig;
import com.merhouse.dto.SelfPasswordChangeRequest;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.JwtService;
import com.merhouse.security.UserPrincipal;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.AppUserDetailsService;
import com.merhouse.service.AuthRecoveryService;
import com.merhouse.service.AuthService;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.UserService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({AuthController.class, ApiExceptionHandler.class})
@AutoConfigureMockMvc(addFilters = false)
@Import(JacksonConfig.class)
class AuthControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private AuthRecoveryService authRecoveryService;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private AdminAuditService adminAuditService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private AppUserDetailsService appUserDetailsService;

    @MockitoBean
    private AppUserRepository appUserRepository;

    @Test
    void selfPasswordChangeRecordsAuditEvent() throws Exception {
        UUID userId = UUID.randomUUID();
        when(currentUserService.required()).thenReturn(new UserPrincipal(userId, UUID.randomUUID(), "merchant@merhouse.local", UserRole.MERCHANT, true));

        mockMvc.perform(patch("/api/v1/auth/me/password")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new SelfPasswordChangeRequest("current-password", "new-password"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Password changed."));

        verify(userService).changeOwnPassword(userId, "current-password", "new-password");
        verify(adminAuditService).record(
            userId,
            "USER_PASSWORD_CHANGED",
            "AppUser",
            userId,
            "Self-service account password change"
        );
    }

    @Test
    void selfPasswordChangeValidatesNewPasswordLength() throws Exception {
        UUID userId = UUID.randomUUID();
        when(currentUserService.required()).thenReturn(new UserPrincipal(userId, UUID.randomUUID(), "merchant@merhouse.local", UserRole.MERCHANT, true));

        mockMvc.perform(patch("/api/v1/auth/me/password")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new SelfPasswordChangeRequest("current-password", "short"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Validation failed"));
    }

    @Test
    void selfPasswordChangeRequiresAuthenticatedCurrentUser() throws Exception {
        when(currentUserService.required()).thenThrow(new AccessDeniedException("Authentication required."));

        mockMvc.perform(patch("/api/v1/auth/me/password")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new SelfPasswordChangeRequest("current-password", "new-password"))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.details[0]").value("Authentication required."));
    }
}
