package com.merhouse.repository;

import com.merhouse.entity.FcmToken;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FcmTokenRepository extends JpaRepository<FcmToken, UUID> {
    Optional<FcmToken> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);
}
