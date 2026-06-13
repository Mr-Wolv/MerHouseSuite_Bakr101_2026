package com.merhouse.web;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.merhouse.config.JacksonConfig;
import com.merhouse.dto.AuthResponse;
import com.merhouse.dto.LoginRequest;
import com.merhouse.dto.PasswordResetRequest;
import com.merhouse.dto.PasswordResetRequestResponse;
import com.merhouse.dto.SelfPasswordChangeRequest;
import com.merhouse.dto.UserResponse;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.JwtService;
import com.merhouse.security.LoginRateLimitExceededException;
import com.merhouse.security.UserPrincipal;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.AppUserDetailsService;
import com.merhouse.service.AuthRecoveryService;
import com.merhouse.service.AuthService;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.UserService;
import java.time.Instant;
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
    void loginNormalizesCopiedEmailBeforeValidation() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        when(authService.login(new LoginRequest("owner@merhouse.local", " exact password ")))
            .thenReturn(new AuthResponse(
                "token",
                "Bearer",
                3600,
                new UserResponse(userId, tenantId, "owner@merhouse.local", UserRole.OWNER, true, Instant.parse("2026-06-10T00:00:00Z"))
            ));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content("""
                    {
                      "email": " owner@merhouse.local ",
                      "password": " exact password "
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("owner@merhouse.local"));

        verify(authService).login(new LoginRequest("owner@merhouse.local", " exact password "));
    }

    @Test
    void passwordResetRequestNormalizesCopiedEmailBeforeValidation() throws Exception {
        when(authRecoveryService.requestReset(new PasswordResetRequest("merchant@merhouse.local")))
            .thenReturn(new PasswordResetRequestResponse(
                "If an enabled account exists for that email, a password reset link has been prepared.",
                null,
                null
            ));

        mockMvc.perform(post("/api/v1/auth/password-reset/request")
                .contentType("application/json")
                .content("""
                    {
                      "email": " merchant@merhouse.local "
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("If an enabled account exists for that email, a password reset link has been prepared."));

        verify(authRecoveryService).requestReset(new PasswordResetRequest("merchant@merhouse.local"));
    }

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

    @Test
    void loginReturns429WhenRateLimited() throws Exception {
        when(authService.login(new LoginRequest("blocked@merhouse.local", "password")))
            .thenThrow(new LoginRateLimitExceededException(600));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content("""
                    {
                      "email": "blocked@merhouse.local",
                      "password": "password"
                    }
                    """))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.error").value("Too Many Requests"))
            .andExpect(result -> {
                String retryAfter = result.getResponse().getHeader("Retry-After");
                assert retryAfter != null && Long.parseLong(retryAfter) > 0;
            });
    }
}
