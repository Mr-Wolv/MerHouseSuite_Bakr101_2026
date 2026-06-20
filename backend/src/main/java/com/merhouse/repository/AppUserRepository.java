package com.merhouse.repository;

import com.merhouse.entity.AppUser;
import com.merhouse.entity.UserRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    @Override
    @EntityGraph(attributePaths = "tenant")
    List<AppUser> findAll();

    @EntityGraph(attributePaths = "tenant")
    Optional<AppUser> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = "tenant")
    Optional<AppUser> findByFirebaseUid(String firebaseUid);

    @EntityGraph(attributePaths = "tenant")
    Optional<AppUser> findWithTenantById(UUID id);

    boolean existsByEmailIgnoreCase(String email);

    long countByRoleAndEnabled(UserRole role, boolean enabled);

    long countByRoleInAndEnabled(Iterable<UserRole> roles, boolean enabled);

    long countByRoleIn(Iterable<UserRole> roles);

    long countByEnabledTrue();

    long countByTenantId(UUID tenantId);

    @EntityGraph(attributePaths = "tenant")
    List<AppUser> findByTenantIdAndRoleAndEnabledTrue(UUID tenantId, UserRole role);

    @EntityGraph(attributePaths = "tenant")
    List<AppUser> findByRoleInAndEnabledTrue(Iterable<UserRole> roles);
}
