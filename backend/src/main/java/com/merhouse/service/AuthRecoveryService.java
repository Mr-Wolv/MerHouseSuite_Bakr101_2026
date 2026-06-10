package com.merhouse.service;

import com.merhouse.dto.MessageResponse;
import com.merhouse.dto.PasswordResetConfirmRequest;
import com.merhouse.dto.PasswordResetRequest;
import com.merhouse.dto.PasswordResetRequestResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.PasswordResetToken;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.PasswordResetTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthRecoveryService {
    private static final Duration RESET_TOKEN_TTL = Duration.ofMinutes(30);
    private static final String GENERIC_RESET_MESSAGE =
        "If an enabled account exists for that email, a password reset link has been prepared.";

    private final AppUserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationService notificationService;
    private final Clock clock;
    private final boolean exposeResetToken;
    private final String publicFrontendUrl;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthRecoveryService(
        AppUserRepository userRepository,
        PasswordResetTokenRepository tokenRepository,
        PasswordEncoder passwordEncoder,
        NotificationService notificationService,
        Clock clock,
        @Value("${merhouse.auth.recovery.expose-reset-token:false}") boolean exposeResetToken,
        @Value("${merhouse.public.frontend-url:http://localhost:3000}") String publicFrontendUrl
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.notificationService = notificationService;
        this.clock = clock;
        this.exposeResetToken = exposeResetToken;
        this.publicFrontendUrl = trimTrailingSlash(publicFrontendUrl);
    }

    @Transactional
    public PasswordResetRequestResponse requestReset(PasswordResetRequest request) {
        String email = normalizeEmail(request.email());
        return userRepository.findByEmailIgnoreCase(email)
            .filter(AppUser::isEnabled)
            .map(user -> createResetResponse(user, createRawToken()))
            .orElse(new PasswordResetRequestResponse(GENERIC_RESET_MESSAGE, null, null));
    }

    @Transactional
    public MessageResponse confirmReset(PasswordResetConfirmRequest request) {
        Instant now = clock.instant();
        PasswordResetToken token = tokenRepository.findByTokenHash(hashToken(normalizeToken(request.token())))
            .orElseThrow(() -> new DomainConflictException("Reset token is invalid or expired."));
        if (token.getUsedAt() != null || !token.getExpiresAt().isAfter(now) || !token.getUser().isEnabled()) {
            throw new DomainConflictException("Reset token is invalid or expired.");
        }

        token.getUser().setPasswordHash(passwordEncoder.encode(request.newPassword()));
        token.setUsedAt(now);
        tokenRepository.save(token);
        userRepository.save(token.getUser());
        return new MessageResponse("Password has been reset.");
    }

    private PasswordResetRequestResponse createResetResponse(AppUser user, String rawToken) {
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setTokenHash(hashToken(rawToken));
        token.setExpiresAt(clock.instant().plus(RESET_TOKEN_TTL));
        tokenRepository.save(token);
        notificationService.recordForUser(
            user,
            NotificationTopic.ACCOUNT_LIFECYCLE,
            "Password reset prepared",
            "A password reset was prepared for your account. This is a local delivery history record.",
            "A password reset was requested for your MerHouse account. Use this link within 30 minutes: "
                + publicFrontendUrl + "/reset-password?token=" + rawToken,
            "PasswordResetToken",
            token.getId()
        );
        if (!exposeResetToken) {
            return new PasswordResetRequestResponse(GENERIC_RESET_MESSAGE, null, null);
        }
        return new PasswordResetRequestResponse(
            GENERIC_RESET_MESSAGE,
            rawToken,
            "/reset-password?token=" + rawToken
        );
    }

    private String createRawToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required for password reset tokens.", exception);
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private String normalizeToken(String token) {
        return token.trim();
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:3000";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
