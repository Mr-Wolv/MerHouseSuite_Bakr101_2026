package com.merhouse.repository;

import com.merhouse.entity.PasswordResetToken;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    @EntityGraph(attributePaths = "user.tenant")
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    @EntityGraph(attributePaths = "user.tenant")
    Optional<PasswordResetToken> findByOtpCodeAndUserEmailIgnoreCase(String otpCode, String email);

    long countByUserIdAndCreatedAtAfter(UUID userId, Instant createdAfter);
}
