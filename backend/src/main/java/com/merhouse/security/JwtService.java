package com.merhouse.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.merhouse.entity.UserRole;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    public static final int MIN_SECRET_BYTES = 32;
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;
    private final byte[] secret;
    private final long expiresInSeconds;

    public JwtService(
        ObjectMapper objectMapper,
        @Value("${merhouse.auth.jwt-secret:}") String secret,
        @Value("${merhouse.auth.jwt-expires-seconds:3600}") long expiresInSeconds
    ) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("MERHOUSE_AUTH_JWT_SECRET must be configured.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("MERHOUSE_AUTH_JWT_SECRET must be at least 32 bytes.");
        }
        this.objectMapper = objectMapper;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.expiresInSeconds = expiresInSeconds;
    }

    public long expiresInSeconds() {
        return expiresInSeconds;
    }

    public String createToken(UserPrincipal principal) {
        Instant now = Instant.now();
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", principal.id().toString());
        payload.put("email", principal.getUsername());
        payload.put("tenantId", principal.tenantId().toString());
        payload.put("role", principal.role().name());
        payload.put("enabled", principal.isEnabled());
        payload.put("iat", now.getEpochSecond());
        payload.put("exp", now.plusSeconds(expiresInSeconds).getEpochSecond());

        String unsignedToken = base64UrlJson(header) + "." + base64UrlJson(payload);
        return unsignedToken + "." + sign(unsignedToken);
    }

    public UserPrincipal parse(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("Invalid token.");
        }

        String unsignedToken = parts[0] + "." + parts[1];
        if (!constantTimeEquals(sign(unsignedToken), parts[2])) {
            throw new IllegalArgumentException("Invalid token signature.");
        }

        Map<String, Object> payload = readJson(parts[1]);
        long expiresAt = ((Number) payload.get("exp")).longValue();
        if (Instant.now().getEpochSecond() >= expiresAt) {
            throw new IllegalArgumentException("Token has expired.");
        }

        Object enabledClaim = payload.getOrDefault("enabled", Boolean.TRUE);
        boolean enabled = Boolean.TRUE.equals(enabledClaim);
        return new UserPrincipal(
            UUID.fromString((String) payload.get("sub")),
            UUID.fromString((String) payload.get("tenantId")),
            (String) payload.get("email"),
            UserRole.valueOf((String) payload.get("role")),
            enabled
        );
    }

    private String base64UrlJson(Map<String, Object> value) {
        try {
            return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to encode token JSON.", exception);
        }
    }

    private Map<String, Object> readJson(String encodedJson) {
        try {
            byte[] json = Base64.getUrlDecoder().decode(encodedJson);
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid token payload.", exception);
        }
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] signature = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to sign token.", exception);
        }
    }

    private boolean constantTimeEquals(String expected, String actual) {
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] actualBytes = actual.getBytes(StandardCharsets.UTF_8);
        if (expectedBytes.length != actualBytes.length) {
            return false;
        }

        int result = 0;
        for (int index = 0; index < expectedBytes.length; index++) {
            result |= expectedBytes[index] ^ actualBytes[index];
        }
        return result == 0;
    }
}
