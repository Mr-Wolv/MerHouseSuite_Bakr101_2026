package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.merhouse.dto.OtpResetRequest;
import com.merhouse.dto.PasswordResetConfirmRequest;
import com.merhouse.dto.PasswordResetRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.NotificationTopic;
import com.merhouse.entity.PasswordResetToken;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.repository.PasswordResetTokenRepository;
import com.google.firebase.auth.FirebaseAuth;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class AuthRecoveryServiceTest {
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final PasswordResetTokenRepository tokenRepository = mock(PasswordResetTokenRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final EmailDeliveryService emailDeliveryService = mock(EmailDeliveryService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-05-18T00:00:00Z"), ZoneOffset.UTC);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<FirebaseAuth> emptyFirebaseProvider = mock(ObjectProvider.class);
    private final AuthRecoveryService service = new AuthRecoveryService(
        userRepository,
        tokenRepository,
        passwordEncoder,
        notificationService,
        emailDeliveryService,
        clock,
        emptyFirebaseProvider,
        false,
        "https://staging.merhouse.example",
        5,
        60
    );

    @Test
    void resetRequestDoesNotRevealMissingEmail() {
        when(userRepository.findByEmailIgnoreCase("missing@merhouse.local")).thenReturn(Optional.empty());

        var response = service.requestReset(new PasswordResetRequest(" Missing@MerHouse.Local "));

        assertEquals("If an enabled account exists for that email, a password reset link has been prepared.", response.message());
        assertNull(response.resetToken());
        assertNull(response.resetPath());
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void resetRequestTreatsInjectionShapedEmailAsAPlainLookup() {
        String normalizedEmail = "security+'or'1'='1@merhouse.local";
        when(userRepository.findByEmailIgnoreCase(normalizedEmail)).thenReturn(Optional.empty());

        var response = service.requestReset(new PasswordResetRequest(" Security+'OR'1'='1@MerHouse.Local "));

        assertEquals("If an enabled account exists for that email, a password reset link has been prepared.", response.message());
        assertNull(response.resetToken());
        assertNull(response.resetPath());
        verify(userRepository).findByEmailIgnoreCase(normalizedEmail);
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void resetRequestCreatesSingleUseTokenForEnabledUser() {
        AppUser user = new AppUser();
        user.setEnabled(true);
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));

        var response = service.requestReset(new PasswordResetRequest("user@merhouse.local"));

        assertNull(response.resetToken());
        assertNull(response.resetPath());
        ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(captor.capture());
        assertEquals(user, captor.getValue().getUser());
        assertEquals(Instant.parse("2026-05-18T00:30:00Z"), captor.getValue().getExpiresAt());
        verify(notificationService).recordForUser(
            eq(user),
            eq(NotificationTopic.ACCOUNT_LIFECYCLE),
            eq("Password reset prepared"),
            eq("A password reset was prepared for your account. This is a local delivery history record."),
            org.mockito.ArgumentMatchers.contains("https://staging.merhouse.example/reset-password?token="),
            eq("PasswordResetToken"),
            isNull()
        );
    }

    @Test
    void resetRequestCanExposeTokenOnlyWhenExplicitlyEnabledForLocalProof() {
        AuthRecoveryService localProofService = new AuthRecoveryService(
            userRepository,
            tokenRepository,
            passwordEncoder,
            notificationService,
            emailDeliveryService,
            clock,
            emptyFirebaseProvider,
            true,
            "http://localhost:3001",
            5,
            60
        );
        AppUser user = new AppUser();
        user.setEnabled(true);
        when(userRepository.findByEmailIgnoreCase("local@merhouse.local")).thenReturn(Optional.of(user));

        var response = localProofService.requestReset(new PasswordResetRequest("local@merhouse.local"));

        assertNotNull(response.resetToken());
        assertEquals("/reset-password?token=" + response.resetToken(), response.resetPath());
    }

    @Test
    void resetRequestRateLimitKeepsGenericResponseAndDoesNotSendDelivery() {
        AuthRecoveryService limitedService = new AuthRecoveryService(
            userRepository,
            tokenRepository,
            passwordEncoder,
            notificationService,
            emailDeliveryService,
            clock,
            emptyFirebaseProvider,
            false,
            "https://staging.merhouse.example",
            2,
            60
        );
        UUID userId = UUID.randomUUID();
        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", userId);
        user.setEnabled(true);
        when(userRepository.findByEmailIgnoreCase("limited@merhouse.local")).thenReturn(Optional.of(user));
        when(tokenRepository.countByUserIdAndCreatedAtAfter(
            eq(userId),
            eq(Instant.parse("2026-05-17T23:00:00Z"))
        )).thenReturn(2L);

        var response = limitedService.requestReset(new PasswordResetRequest("limited@merhouse.local"));

        assertEquals("If an enabled account exists for that email, a password reset link has been prepared.", response.message());
        assertNull(response.resetToken());
        assertNull(response.resetPath());
        verify(tokenRepository, never()).save(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void confirmResetRejectsInvalidToken() {
        when(tokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThrows(
            DomainConflictException.class,
            () -> service.confirmReset(new PasswordResetConfirmRequest("bad-token", "new-password"))
        );
        verify(userRepository, never()).save(any());
    }

    @Test
    void confirmResetUpdatesPasswordAndMarksTokenUsed() {
        AppUser user = new AppUser();
        user.setEnabled(true);
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setExpiresAt(Instant.parse("2026-05-18T00:15:00Z"));
        when(tokenRepository.findByTokenHash(any())).thenReturn(Optional.of(token));
        when(passwordEncoder.encode("new-password")).thenReturn("encoded-password");

        service.confirmReset(new PasswordResetConfirmRequest("raw-token", "new-password"));

        assertEquals("encoded-password", user.getPasswordHash());
        assertEquals(Instant.parse("2026-05-18T00:00:00Z"), token.getUsedAt());
        verify(tokenRepository).save(token);
        verify(userRepository).save(user);
    }

    @Test
    void confirmResetAcceptsCopiedTokenWithSurroundingWhitespace() {
        AppUser user = new AppUser();
        user.setEnabled(true);
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setExpiresAt(Instant.parse("2026-05-18T00:15:00Z"));
        when(tokenRepository.findByTokenHash(any())).thenReturn(Optional.of(token));
        when(passwordEncoder.encode("new-password")).thenReturn("encoded-password");

        service.confirmReset(new PasswordResetConfirmRequest("  raw-token\r\n", "new-password"));

        assertEquals("encoded-password", user.getPasswordHash());
        ArgumentCaptor<String> hashCaptor = ArgumentCaptor.forClass(String.class);
        verify(tokenRepository).findByTokenHash(hashCaptor.capture());
        assertEquals("NNMoAJsSP7uw3JPxiz5t4ez3saV4PDPf9__hkm8J6UM", hashCaptor.getValue());
        verify(tokenRepository).save(token);
        verify(userRepository).save(user);
    }

    @Test
    void otpRequestDoesNotRevealMissingEmail() {
        when(userRepository.findByEmailIgnoreCase("missing@merhouse.local")).thenReturn(Optional.empty());

        var response = service.requestOtp(new PasswordResetRequest("missing@merhouse.local"));

        assertEquals("If an enabled account exists for that email, a one-time password has been sent.", response.message());
        verify(tokenRepository, never()).save(any());
        verify(emailDeliveryService, never()).sendAndForget(any(), any(), any(), any());
    }

    @Test
    void otpRequestGeneratesCodeAndSendsEmailForEnabledUser() {
        AppUser user = new AppUser();
        user.setEmail("user@merhouse.local");
        user.setEnabled(true);
        when(userRepository.findByEmailIgnoreCase("user@merhouse.local")).thenReturn(Optional.of(user));

        var response = service.requestOtp(new PasswordResetRequest("user@merhouse.local"));

        assertEquals("If an enabled account exists for that email, a one-time password has been sent.", response.message());
        ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(captor.capture());
        assertNotNull(captor.getValue().getOtpCode());
        assertEquals(6, captor.getValue().getOtpCode().length());
        assertEquals(Instant.parse("2026-05-18T00:15:00Z"), captor.getValue().getExpiresAt());
        verify(emailDeliveryService).sendAndForget(isNull(), eq("user@merhouse.local"), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.contains("one-time password"));
    }

    @Test
    void resetWithOtpRejectsInvalidCode() {
        when(tokenRepository.findByOtpCodeAndUserEmailIgnoreCase(any(), any())).thenReturn(Optional.empty());

        assertThrows(
            DomainConflictException.class,
            () -> service.resetWithOtp(new OtpResetRequest("user@merhouse.local", "000000", "new-password"))
        );
        verify(userRepository, never()).save(any());
    }

    @Test
    void resetWithOtpUpdatesPasswordAndMarksTokenUsed() {
        AppUser user = new AppUser();
        user.setEmail("user@merhouse.local");
        user.setEnabled(true);
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setOtpCode("123456");
        token.setExpiresAt(Instant.parse("2026-05-18T00:15:00Z"));
        when(tokenRepository.findByOtpCodeAndUserEmailIgnoreCase("123456", "user@merhouse.local")).thenReturn(Optional.of(token));
        when(passwordEncoder.encode("new-password")).thenReturn("encoded-password");

        service.resetWithOtp(new OtpResetRequest("user@merhouse.local", "123456", "new-password"));

        assertEquals("encoded-password", user.getPasswordHash());
        assertEquals(Instant.parse("2026-05-18T00:00:00Z"), token.getUsedAt());
        verify(tokenRepository).save(token);
        verify(userRepository).save(user);
    }
}
