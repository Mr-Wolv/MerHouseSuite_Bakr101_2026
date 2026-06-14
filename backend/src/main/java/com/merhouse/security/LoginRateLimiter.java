package com.merhouse.security;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class LoginRateLimiter {
    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);
    private final Map<String, AttemptTracker> attempts = new ConcurrentHashMap<>();

    private final int maxAttempts;
    private final long windowSeconds;
    private final int maxEntries;

    public LoginRateLimiter() {
        this(5, 15 * 60, 10_000);
    }

    public LoginRateLimiter(int maxAttempts, long windowSeconds, int maxEntries) {
        this.maxAttempts = maxAttempts;
        this.windowSeconds = windowSeconds;
        this.maxEntries = maxEntries;
    }

    public boolean isBlocked(String email) {
        AttemptTracker tracker = attempts.get(normalize(email));
        if (tracker == null) {
            return false;
        }
        if (tracker.isExpired(windowSeconds)) {
            attempts.remove(normalize(email), tracker);
            return false;
        }
        return tracker.failedCount() >= maxAttempts;
    }

    public long retryAfterSeconds(String email) {
        AttemptTracker tracker = attempts.get(normalize(email));
        if (tracker == null) {
            return 0;
        }
        long elapsed = Instant.now().getEpochSecond() - tracker.lastAttemptEpochSecond();
        long remaining = windowSeconds - elapsed;
        return Math.max(0, remaining);
    }

    public void recordFailure(String email) {
        if (attempts.size() >= maxEntries) {
            cleanup();
            if (attempts.size() >= maxEntries) {
                log.warn("Login rate limiter: max entries ({}) reached, refusing new tracking entries.", maxEntries);
                return;
            }
        }
        String key = normalize(email);
        attempts.compute(key, (k, existing) -> {
            if (existing == null || existing.isExpired(windowSeconds)) {
                return new AttemptTracker(1, Instant.now().getEpochSecond());
            }
            return new AttemptTracker(existing.failedCount() + 1, Instant.now().getEpochSecond());
        });
        log.debug("Login rate limiter: recorded failure for {}", key);
    }

    public void recordSuccess(String email) {
        attempts.remove(normalize(email));
    }

    public void cleanup() {
        int before = attempts.size();
        attempts.entrySet().removeIf(entry -> entry.getValue().isExpired(windowSeconds));
        int removed = before - attempts.size();
        if (removed > 0) {
            log.debug("Login rate limiter: cleaned up {} expired entries, {} remaining.", removed, attempts.size());
        }
    }

    @Scheduled(fixedDelayString = "${merhouse.auth.rate-limiter.cleanup-interval-ms:300000}")
    public void scheduledCleanup() {
        cleanup();
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase();
    }

    record AttemptTracker(int failedCount, long lastAttemptEpochSecond) {
        boolean isExpired(long windowSeconds) {
            return Instant.now().getEpochSecond() - lastAttemptEpochSecond >= windowSeconds;
        }
    }
}
