package com.merhouse.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LoginRateLimiterTest {
    private LoginRateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new LoginRateLimiter(3, 300);
    }

    @Test
    void notBlockedInitially() {
        assertFalse(limiter.isBlocked("user@example.com"));
    }

    @Test
    void blockedAfterMaxFailedAttempts() {
        String email = "user@example.com";
        limiter.recordFailure(email);
        assertFalse(limiter.isBlocked(email));
        limiter.recordFailure(email);
        assertFalse(limiter.isBlocked(email));
        limiter.recordFailure(email);
        assertTrue(limiter.isBlocked(email));
    }

    @Test
    void successfulLoginResetsCounter() {
        String email = "user@example.com";
        limiter.recordFailure(email);
        limiter.recordFailure(email);
        limiter.recordSuccess(email);
        assertFalse(limiter.isBlocked(email));
    }

    @Test
    void retryAfterReturnsNonZeroWhenBlocked() {
        String email = "user@example.com";
        limiter.recordFailure(email);
        limiter.recordFailure(email);
        limiter.recordFailure(email);
        assertTrue(limiter.retryAfterSeconds(email) > 0);
    }

    @Test
    void differentEmailsTrackedIndependently() {
        limiter.recordFailure("a@example.com");
        limiter.recordFailure("a@example.com");
        limiter.recordFailure("a@example.com");
        assertTrue(limiter.isBlocked("a@example.com"));
        assertFalse(limiter.isBlocked("b@example.com"));
    }

    @Test
    void emailNormalizedCaseInsensitive() {
        limiter.recordFailure("User@Example.COM");
        limiter.recordFailure("user@example.com");
        limiter.recordFailure("USER@EXAMPLE.COM");
        assertTrue(limiter.isBlocked("user@example.com"));
    }

    @Test
    void cleanupRemovesExpiredEntries() {
        LoginRateLimiter shortLimiter = new LoginRateLimiter(1, 0);
        shortLimiter.recordFailure("expired@example.com");
        shortLimiter.cleanup();
        assertFalse(shortLimiter.isBlocked("expired@example.com"));
    }
}
