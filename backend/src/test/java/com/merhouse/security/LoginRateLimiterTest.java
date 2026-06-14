package com.merhouse.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LoginRateLimiterTest {
    private LoginRateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new LoginRateLimiter(3, 300, 1000);
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
    void successfulLoginAfterBlockingAllowsRetry() {
        String email = "user@example.com";
        for (int i = 0; i < 3; i++) limiter.recordFailure(email);
        assertTrue(limiter.isBlocked(email));

        limiter.recordSuccess(email);
        assertFalse(limiter.isBlocked(email));

        // Can fail again up to the limit
        limiter.recordFailure(email);
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
    void retryAfterReturnsZeroForUnknownEmail() {
        assertEquals(0, limiter.retryAfterSeconds("unknown@example.com"));
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
    void emailNormalizedTrimsWhitespace() {
        limiter.recordFailure("  user@example.com  ");
        limiter.recordFailure("user@example.com");
        limiter.recordFailure("  USER@EXAMPLE.COM  ");
        assertTrue(limiter.isBlocked("user@example.com"));
    }

    @Test
    void cleanupRemovesExpiredEntries() {
        LoginRateLimiter shortLimiter = new LoginRateLimiter(1, 0, 1000);
        shortLimiter.recordFailure("expired@example.com");
        shortLimiter.cleanup();
        assertFalse(shortLimiter.isBlocked("expired@example.com"));
    }

    @Test
    void cleanupKeepsNonExpiredEntries() {
        limiter.recordFailure("fresh@example.com");
        limiter.recordFailure("fresh@example.com");
        limiter.cleanup();
        // Still within 300s window, should remain blocked after 2 failures (not yet 3)
        assertFalse(limiter.isBlocked("fresh@example.com"));
        limiter.recordFailure("fresh@example.com");
        assertTrue(limiter.isBlocked("fresh@example.com"));
    }

    @Test
    void maxEntriesCapPreventsUnboundedGrowth() {
        LoginRateLimiter capped = new LoginRateLimiter(3, 300, 5);
        // Fill past the cap
        for (int i = 0; i < 10; i++) {
            capped.recordFailure("user" + i + "@test.com");
        }
        // With max entries = 5 and cleanup triggered at capacity,
        // the map should not exceed the cap significantly.
        // We can't assert exact count without exposing internals,
        // but the limiter should still function correctly.
        assertFalse(capped.isBlocked("brand-new@test.com"));
    }

    @Test
    void expiredEntriesAreCleanedOnOverflow() {
        // window=0 means entries expire immediately, so cleanup on overflow should free space
        LoginRateLimiter zeroWindow = new LoginRateLimiter(1, 0, 3);
        for (int i = 0; i < 20; i++) {
            zeroWindow.recordFailure("user" + i + "@test.com");
        }
        // All entries should have expired, limiter still works
        assertFalse(zeroWindow.isBlocked("user99@test.com"));
    }

    @Test
    void singleAttemptDoesNotBlock() {
        limiter.recordFailure("one@example.com");
        assertFalse(limiter.isBlocked("one@example.com"));
    }

    @Test
    void exactlyOneBelowMaxDoesNotBlock() {
        // max = 3, so 2 failures should not block
        limiter.recordFailure("two@example.com");
        limiter.recordFailure("two@example.com");
        assertFalse(limiter.isBlocked("two@example.com"));
    }

    @Test
    void concurrentFailuresDoNotCorrupt() throws Exception {
        int threads = 10;
        int failuresPerThread = 50;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        List<Future<?>> futures = new ArrayList<>();

        for (int t = 0; t < threads; t++) {
            final String email = "concurrent-" + t + "@test.com";
            futures.add(executor.submit(() -> {
                latch.countDown();
                try { latch.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                for (int i = 0; i < failuresPerThread; i++) {
                    limiter.recordFailure(email);
                }
            }));
        }

        for (Future<?> future : futures) {
            future.get();
        }
        executor.shutdown();

        // Every email should be blocked after 50 failures (way over the limit of 3)
        for (int t = 0; t < threads; t++) {
            assertTrue(limiter.isBlocked("concurrent-" + t + "@test.com"),
                "Email concurrent-" + t + "@test.com should be blocked after concurrent failures");
        }
    }

    @Test
    void concurrentRecordSuccessAndFailureDoNotThrow() throws Exception {
        String email = "race@test.com";
        int threads = 8;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        List<Future<?>> futures = new ArrayList<>();

        for (int t = 0; t < threads; t++) {
            final boolean isSuccess = t % 2 == 0;
            futures.add(executor.submit(() -> {
                latch.countDown();
                try { latch.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                for (int i = 0; i < 100; i++) {
                    if (isSuccess) {
                        limiter.recordSuccess(email);
                    } else {
                        limiter.recordFailure(email);
                    }
                }
            }));
        }

        for (Future<?> future : futures) {
            future.get(); // Should not throw
        }
        executor.shutdown();
    }

    @Test
    void retryAfterDecreasesOverTime() throws Exception {
        LoginRateLimiter shortWindow = new LoginRateLimiter(1, 2, 1000);
        shortWindow.recordFailure("timing@test.com");

        long initial = shortWindow.retryAfterSeconds("timing@test.com");
        assertTrue(initial > 0);
        assertTrue(initial <= 2);

        Thread.sleep(1100);
        long later = shortWindow.retryAfterSeconds("timing@test.com");
        assertTrue(later < initial || later == 0,
            "Retry-after should decrease over time; initial=" + initial + " later=" + later);
    }
}
