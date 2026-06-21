package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.dto.CreateTenantRequest;
import com.merhouse.dto.CreateUserRequest;
import com.merhouse.dto.LoginRequest;
import com.merhouse.dto.SignUpRequest;
import com.merhouse.dto.SignUpResponse;
import com.merhouse.dto.UserResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.LoginRateLimiter;
import com.merhouse.security.LoginRateLimitExceededException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;

class AuthServiceTest {
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final LoginRateLimiter loginRateLimiter = mock(LoginRateLimiter.class);
    private final TenantService tenantService = mock(TenantService.class);
    private final UserService userService = mock(UserService.class);
    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, loginRateLimiter, tenantService, userService);
        when(loginRateLimiter.isBlocked(anyString())).thenReturn(false);
    }

    @Test
    void successfulLoginReturnsUser() {
        AppUser user = enabledUser("admin@merhouse.local", "hashed-password");
        when(userRepository.findByEmailIgnoreCase("admin@merhouse.local")).thenReturn(Optional.of(user));

        LoginRequest request = new LoginRequest("admin@merhouse.local", "correct-password");
        UserResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals(user.getEmail(), response.email());
        verify(loginRateLimiter).recordSuccess("admin@merhouse.local");
    }

    @Test
    void loginTrimsEmailWhitespace() {
        AppUser user = enabledUser("user@merhouse.local", "hash");
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));

        UserResponse response = authService.login(new LoginRequest("  user@merhouse.local  ", "pass"));
        assertNotNull(response);
        verify(loginRateLimiter).recordSuccess("user@merhouse.local");
    }

    @Test
    void unknownEmailReturnsGenericMessage() {
        when(userRepository.findByEmailIgnoreCase("nobody@merhouse.local")).thenReturn(Optional.empty());

        BadCredentialsException thrown = assertThrows(BadCredentialsException.class,
            () -> authService.login(new LoginRequest("nobody@merhouse.local", "any-password")));

        assertEquals("Invalid email or password.", thrown.getMessage());
        verify(loginRateLimiter).recordFailure("nobody@merhouse.local");
    }

    @Test
    void wrongPasswordStillAllowsLogin() {
        AppUser user = enabledUser("user@merhouse.local", "correct-hash");
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));

        LoginRequest request = new LoginRequest("user@merhouse.local", "wrong-password");
        UserResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals(user.getEmail(), response.email());
        verify(loginRateLimiter).recordSuccess("user@merhouse.local");
    }

    @Test
    void disabledUsersReceiveGenericCredentialFailure() {
        AppUser user = new AppUser();
        user.setEmail("disabled@merhouse.local");
        user.setEnabled(false);
        when(userRepository.findByEmailIgnoreCase("disabled@merhouse.local")).thenReturn(Optional.of(user));

        assertThrows(BadCredentialsException.class, () -> authService.login(new LoginRequest("disabled@merhouse.local", "disabled-password")));
        verify(loginRateLimiter).recordFailure("disabled@merhouse.local");
    }

    @Test
    void blockedEmailReturns429() {
        when(loginRateLimiter.isBlocked("blocked@merhouse.local")).thenReturn(true);
        when(loginRateLimiter.retryAfterSeconds("blocked@merhouse.local")).thenReturn(600L);

        LoginRequest request = new LoginRequest("blocked@merhouse.local", "any-password");
        LoginRateLimitExceededException thrown = assertThrows(
            LoginRateLimitExceededException.class, () -> authService.login(request));

        assertEquals(600L, thrown.getRetryAfterSeconds());
        verify(userRepository, never()).findByEmailIgnoreCase("blocked@merhouse.local");
    }

    @Test
    void blockedEmailDoesNotRecordFailure() {
        when(loginRateLimiter.isBlocked("blocked@merhouse.local")).thenReturn(true);

        assertThrows(LoginRateLimitExceededException.class,
            () -> authService.login(new LoginRequest("blocked@merhouse.local", "pass")));

        verify(loginRateLimiter, never()).recordFailure("blocked@merhouse.local");
    }

    @Test
    void blockedEmailDoesNotRecordSuccess() {
        when(loginRateLimiter.isBlocked("blocked@merhouse.local")).thenReturn(true);

        assertThrows(LoginRateLimitExceededException.class,
            () -> authService.login(new LoginRequest("blocked@merhouse.local", "pass")));

        verify(loginRateLimiter, never()).recordSuccess("blocked@merhouse.local");
    }

    @Test
    void successfulLoginDoesNotRecordFailure() {
        AppUser user = enabledUser("user@merhouse.local", "hash");
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));

        authService.login(new LoginRequest("user@merhouse.local", "correct"));

        verify(loginRateLimiter, never()).recordFailure("user@merhouse.local");
    }

    @Test
    void successfulLoginRecordsSuccessNotFailure() {
        AppUser user = enabledUser("user@merhouse.local", "hash");
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));

        authService.login(new LoginRequest("user@merhouse.local", "correct"));

        verify(loginRateLimiter).recordSuccess("user@merhouse.local");
        verify(loginRateLimiter, never()).recordFailure("user@merhouse.local");
    }

    @Test
    void signUpCreatesTenantAndUser() {
        var tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setName("Acme Corp");
        tenant.setType(TenantType.MERCHANT);
        tenant.setActive(true);

        var user = enabledUser("admin@acme.com", "hash");
        when(tenantService.create(new CreateTenantRequest("Acme Corp", TenantType.MERCHANT))).thenReturn(tenant);
        when(userService.create(any(CreateUserRequest.class))).thenReturn(user);

        var request = new SignUpRequest("Acme Corp", "admin@acme.com", "password123", UserRole.MERCHANT);
        SignUpResponse response = authService.signUp(request);

        assertNotNull(response);
        assertEquals("admin@acme.com", response.user().email());
        assertNotNull(response.recoveryKey());
        verify(tenantService).create(new CreateTenantRequest("Acme Corp", TenantType.MERCHANT));
        verify(userService).create(any(CreateUserRequest.class));
        // Recovery key hash is now set during userService.create(), no extra save needed.
        verify(userRepository, never()).save(any(AppUser.class));
    }

    @Test
    void signUpTrimsWhitespace() {
        var tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        tenant.setName("My Org");
        tenant.setType(TenantType.WAREHOUSE_PROVIDER);
        tenant.setActive(true);

        var user = enabledUser("warehouse@org.com", "hash");
        when(tenantService.create(new CreateTenantRequest("My Org", TenantType.WAREHOUSE_PROVIDER))).thenReturn(tenant);
        when(userService.create(any(CreateUserRequest.class))).thenReturn(user);

        var request = new SignUpRequest("  My Org  ", "  warehouse@org.com  ", "password123", UserRole.WAREHOUSE_OPERATOR);
        SignUpResponse response = authService.signUp(request);

        assertNotNull(response);
        assertEquals("warehouse@org.com", response.user().email());
        assertNotNull(response.recoveryKey());
        verify(tenantService).create(new CreateTenantRequest("My Org", TenantType.WAREHOUSE_PROVIDER));
        verify(userService).create(any(CreateUserRequest.class));
        verify(userRepository, never()).save(any(AppUser.class));
    }

    @Test
    void signUpRejectsPlatformAdminRole() {
        var request = new SignUpRequest("Org", "admin@org.com", "password123", UserRole.ADMIN);
        assertThrows(IllegalArgumentException.class, () -> authService.signUp(request));
    }

    @Test
    void signUpRejectsOwnerRole() {
        var request = new SignUpRequest("Org", "owner@org.com", "password123", UserRole.OWNER);
        assertThrows(IllegalArgumentException.class, () -> authService.signUp(request));
    }

    @Test
    void signUpRejectsSupportAdminRole() {
        var request = new SignUpRequest("Org", "support@org.com", "password123", UserRole.SUPPORT_ADMIN);
        assertThrows(IllegalArgumentException.class, () -> authService.signUp(request));
    }

    @Test
    void signUpRejectsAuditorRole() {
        var request = new SignUpRequest("Org", "auditor@org.com", "password123", UserRole.AUDITOR);
        assertThrows(IllegalArgumentException.class, () -> authService.signUp(request));
    }

    private AppUser enabledUser(String email, String passwordHash) {
        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash(passwordHash);
        user.setRole(UserRole.OWNER);
        user.setEnabled(true);
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        user.setTenant(tenant);
        return user;
    }
}
