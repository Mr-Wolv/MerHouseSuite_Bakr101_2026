package com.merhouse.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Shared utilities for generating and hashing tokens (reset tokens, recovery keys).
 */
public final class TokenUtils {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private TokenUtils() {
        // Utility class — no instantiation.
    }

    /**
     * Generate a cryptographically secure random token as a URL-safe Base64 string.
     */
    public static String createRawToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * SHA-256 hash a token and return the URL-safe Base64-encoded hash.
     */
    public static String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required for password reset tokens.", exception);
        }
    }

    /**
     * Generate a human-readable recovery key — 4 groups of 4 alphanumeric chars.
     * Example: {@code AB12-CD34-EF56-GH78}
     */
    public static String createRecoveryKey() {
        byte[] bytes = new byte[16];
        SECURE_RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(19);
        for (int i = 0; i < 16; i++) {
            if (i > 0 && i % 4 == 0) {
                sb.append('-');
            }
            int value = (bytes[i] & 0xFF) % 36;
            sb.append((char) (value < 10 ? '0' + value : 'A' + value - 10));
        }
        return sb.toString();
    }
}
