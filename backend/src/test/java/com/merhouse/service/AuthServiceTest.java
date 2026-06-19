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

import com.merhouse.dto.LoginRequest;
import com.merhouse.dto.UserResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.LoginRateLimiter;
import com.merhouse.security.LoginRateLimitExceededException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class AuthServiceTest {
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final LoginRateLimiter loginRateLimiter = mock(LoginRateLimiter.class);
    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, loginRateLimiter);
        when(loginRateLimiter.isBlocked(anyString())).thenReturn(false);
    }

    @Test
    void successfulLoginReturnsUser() {
        AppUser user = enabledUser("admin@merhouse.local", "hashed-password");
        when(userRepository.findByEmailIgnoreCase("admin@merhouse.local")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct-password", "hashed-password")).thenReturn(true);

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
        when(passwordEncoder.matches("pass", "hash")).thenReturn(true);

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
    void unknownEmailDoesNotCheckPassword() {
        when(userRepository.findByEmailIgnoreCase("nobody@merhouse.local")).thenReturn(Optional.empty());

        assertThrows(BadCredentialsException.class,
            () -> authService.login(new LoginRequest("nobody@merhouse.local", "any")));

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void wrongPasswordReturnsGenericMessage() {
        AppUser user = enabledUser("user@merhouse.local", "correct-hash");
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "correct-hash")).thenReturn(false);

        BadCredentialsException thrown = assertThrows(BadCredentialsException.class,
            () -> authService.login(new LoginRequest("user@merhouse.local", "wrong-password")));

        assertEquals("Invalid email or password.", thrown.getMessage());
        verify(loginRateLimiter).recordFailure("user@merhouse.local");
    }

    @Test
    void disabledUsersReceiveGenericCredentialFailure() {
        AppUser user = new AppUser();
        user.setEmail("disabled@merhouse.local");
        user.setEnabled(false);
        when(userRepository.findByEmailIgnoreCase("disabled@merhouse.local")).thenReturn(Optional.of(user));

        LoginRequest request = new LoginRequest("disabled@merhouse.local", "disabled-password");
        assertThrows(BadCredentialsException.class, () -> authService.login(request));
        verify(passwordEncoder, never()).matches("disabled-password", user.getPasswordHash());
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
    void failedPasswordRecordsFailureNotSuccess() {
        AppUser user = enabledUser("user@merhouse.local", "hash");
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hash")).thenReturn(false);

        assertThrows(BadCredentialsException.class,
            () -> authService.login(new LoginRequest("user@merhouse.local", "wrong")));

        verify(loginRateLimiter).recordFailure("user@merhouse.local");
        verify(loginRateLimiter, never()).recordSuccess("user@merhouse.local");
    }

    @Test
    void successfulLoginDoesNotRecordFailure() {
        AppUser user = enabledUser("user@merhouse.local", "hash");
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct", "hash")).thenReturn(true);

        authService.login(new LoginRequest("user@merhouse.local", "correct"));

        verify(loginRateLimiter, never()).recordFailure("user@merhouse.local");
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
