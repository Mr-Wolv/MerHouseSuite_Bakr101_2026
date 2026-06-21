package com.merhouse.service;

import com.merhouse.dto.CreateUserRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.exception.ResourceNotFoundException;
import com.merhouse.repository.AppUserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private static final Set<UserRole> PLATFORM_ADMIN_ROLES = Set.of(
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.SUPPORT_ADMIN,
        UserRole.AUDITOR
    );

    private final AppUserRepository userRepository;
    private final TenantService tenantService;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<FirebaseAuth> firebaseAuthProvider;

    public UserService(
        AppUserRepository userRepository,
        TenantService tenantService,
        PasswordEncoder passwordEncoder,
        ObjectProvider<FirebaseAuth> firebaseAuthProvider
    ) {
        this.userRepository = userRepository;
        this.tenantService = tenantService;
        this.passwordEncoder = passwordEncoder;
        this.firebaseAuthProvider = firebaseAuthProvider;
    }

    @Transactional
    public AppUser create(CreateUserRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new DomainConflictException("User already exists with email: " + email);
        }

        Tenant tenant = tenantService.getRequired(request.tenantId());
        validateTenantRole(tenant, request.role());

        // Enforce single-owner invariant: only one OWNER may exist system-wide.
        // Uses countByRoleIn to count ALL owners regardless of enabled status.
        if (request.role() == UserRole.OWNER && userRepository.countByRoleIn(Set.of(UserRole.OWNER)) > 0) {
            throw new DomainConflictException("An owner account already exists. Only one owner is permitted.");
        }

        AppUser user = new AppUser();
        user.setTenant(tenant);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        user.setEnabled(true);
        if (request.recoveryKeyHash() != null) {
            user.setRecoveryKeyHash(request.recoveryKeyHash());
        }
        AppUser saved = userRepository.save(user);

        // Create Firebase Auth user when Firebase is enabled and save the uid.
        // Wrapped in try-catch so a Firebase failure never prevents the DB user
        // from being created (matches DevAdminSeeder pattern).
        String firebaseUid = createFirebaseUserIfAvailable(email, request.password());
        if (firebaseUid != null) {
            saved.setFirebaseUid(firebaseUid);
            userRepository.save(saved);
        }

        return saved;
    }

    /**
     * Creates a Firebase Auth user if Firebase is available.
     * Returns the Firebase uid, or null if creation was skipped or failed.
     */
    private String createFirebaseUserIfAvailable(String email, String password) {
        FirebaseAuth firebaseAuth = firebaseAuthProvider.getIfAvailable();
        if (firebaseAuth == null) return null;
        try {
            try {
                UserRecord existing = firebaseAuth.getUserByEmail(email);
                log.debug("Firebase Auth user already exists for {} with uid: {} — skipping creation.", email, existing.getUid());
                return existing.getUid();
            } catch (FirebaseAuthException e) {
                UserRecord.CreateRequest createRequest = new UserRecord.CreateRequest()
                    .setEmail(email)
                    .setPassword(password)
                    .setEmailVerified(true);
                UserRecord created = firebaseAuth.createUser(createRequest);
                log.info("Created Firebase Auth user for {} with uid: {}", email, created.getUid());
                return created.getUid();
            }
        } catch (Exception ex) {
            log.warn("Firebase Auth user creation/uid-fetch failed for {}: {} — DB user was still created.", email, ex.getMessage());
            return null;
        }
    }

    @Transactional(readOnly = true)
    public List<AppUser> findAll() {
        return userRepository.findAll();
    }

    @Transactional(readOnly = true)
    public AppUser getRequired(UUID id) {
        return userRepository.findWithTenantById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }

    @Transactional
    public AppUser disable(UUID id, UUID actorId) {
        if (id.equals(actorId)) {
            throw new DomainConflictException("You cannot disable your own account.");
        }
        AppUser actor = getRequired(actorId);
        AppUser user = getRequired(id);
        ensureCanManageTarget(actor, user);
        if (user.getRole() == UserRole.OWNER && user.isEnabled()
            && userRepository.countByRoleAndEnabled(UserRole.OWNER, true) <= 1) {
            throw new DomainConflictException("At least one owner account must remain enabled.");
        }
        if (user.getRole().isPlatformAdmin() && user.isEnabled()
            && userRepository.countByRoleInAndEnabled(PLATFORM_ADMIN_ROLES, true) <= 1) {
            throw new DomainConflictException("At least one platform admin account must remain enabled.");
        }
        user.setEnabled(false);
        return userRepository.save(user);
    }

    @Transactional
    public AppUser enable(UUID id, UUID actorId) {
        AppUser actor = getRequired(actorId);
        AppUser user = getRequired(id);
        ensureCanManageTarget(actor, user);
        user.setEnabled(true);
        return userRepository.save(user);
    }

    @Transactional
    public AppUser changeRole(UUID id, UUID actorId, UserRole role) {
        if (id.equals(actorId)) {
            throw new DomainConflictException("You cannot change your own role.");
        }
        AppUser actor = getRequired(actorId);
        AppUser user = getRequired(id);
        ensureCanManageTarget(actor, user);
        if (role.isPlatformAdmin() && !actor.getRole().canManageAdmins()) {
            throw new DomainConflictException("Only an owner can assign platform admin roles.");
        }

        // Enforce single-owner invariant: prevent creating a second owner via role change.
        // Uses countByRoleIn to count ALL owners regardless of enabled status.
        if (role == UserRole.OWNER && userRepository.countByRoleIn(Set.of(UserRole.OWNER)) > 0) {
            throw new DomainConflictException("An owner account already exists. Only one owner is permitted.");
        }

        if (user.getRole() == UserRole.OWNER && user.isEnabled()
            && role != UserRole.OWNER
            && userRepository.countByRoleAndEnabled(UserRole.OWNER, true) <= 1) {
            throw new DomainConflictException("At least one owner account must remain enabled.");
        }
        validateTenantRole(user.getTenant(), role);
        user.setRole(role);
        return userRepository.save(user);
    }

    @Transactional
    public AppUser save(AppUser user) {
        return userRepository.save(user);
    }

    @Transactional
    public AppUser resetPassword(UUID id, UUID actorId, String newPassword) {
        AppUser actor = getRequired(actorId);
        AppUser user = getRequired(id);
        ensureCanSupportTarget(actor, user);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        return userRepository.save(user);
    }

    @Transactional
    public AppUser changeOwnPassword(UUID actorId, String currentPassword, String newPassword) {
        AppUser user = getRequired(actorId);
        if (!user.isEnabled() || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid current password.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        return userRepository.save(user);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private void validateTenantRole(Tenant tenant, UserRole role) {
        if (role.isPlatformAdmin()) {
            return;
        }
        if (role == UserRole.MERCHANT && tenant.getType() != TenantType.MERCHANT) {
            throw new DomainConflictException("MERCHANT users must belong to a merchant tenant.");
        }
        if (role == UserRole.WAREHOUSE_OPERATOR && tenant.getType() != TenantType.WAREHOUSE_PROVIDER) {
            throw new DomainConflictException("WAREHOUSE_OPERATOR users must belong to a warehouse provider tenant.");
        }
    }

    private void ensureCanManageTarget(AppUser actor, AppUser target) {
        if (!actor.getRole().canMutatePlatform()) {
            throw new DomainConflictException("Your admin role cannot change platform accounts.");
        }
        if (target.getRole() == UserRole.OWNER && !actor.getRole().canManageAdmins()) {
            throw new DomainConflictException("Only an owner can manage owner accounts.");
        }
        if (target.getRole().isPlatformAdmin() && !actor.getRole().canManageAdmins()) {
            throw new DomainConflictException("Only an owner can manage platform admin accounts.");
        }
    }

    private void ensureCanSupportTarget(AppUser actor, AppUser target) {
        if (!actor.getRole().canSupportUsers()) {
            throw new DomainConflictException("Your admin role cannot support user accounts.");
        }
        if (target.getRole() == UserRole.OWNER && !actor.getRole().canManageAdmins()) {
            throw new DomainConflictException("Only an owner can recover owner accounts.");
        }
    }
}
