package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import com.merhouse.dto.CreateUserRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.AppUserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

class UserServiceTest {
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final TenantService tenantService = mock(TenantService.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<FirebaseAuth> emptyFirebaseProvider = mock(ObjectProvider.class);
    private final UserService userService = new UserService(userRepository, tenantService, passwordEncoder, emptyFirebaseProvider);

    @Test
    void adminCannotDisableOwnAccount() {
        UUID adminId = UUID.randomUUID();

        assertThrows(DomainConflictException.class, () -> userService.disable(adminId, adminId));
        verify(userRepository, never()).findWithTenantById(adminId);
    }

    @Test
    void lastEnabledAdminCannotBeDisabled() {
        UUID targetId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        AppUser actor = new AppUser();
        actor.setRole(UserRole.OWNER);
        actor.setEnabled(true);
        AppUser target = new AppUser();
        target.setRole(UserRole.OWNER);
        target.setEnabled(true);
        Tenant tenant = new Tenant();
        tenant.setName("Platform");
        tenant.setType(TenantType.WAREHOUSE_PROVIDER);
        actor.setTenant(tenant);
        target.setTenant(tenant);
        when(userRepository.findWithTenantById(actorId)).thenReturn(Optional.of(actor));
        when(userRepository.findWithTenantById(targetId)).thenReturn(Optional.of(target));
        when(userRepository.countByRoleAndEnabled(UserRole.OWNER, true)).thenReturn(1L);

        assertThrows(DomainConflictException.class, () -> userService.disable(targetId, actorId));
        verify(userRepository, never()).save(target);
    }

    @Test
    void lowerAdminCannotManageOwnerAccount() {
        UUID targetId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        AppUser actor = user(UserRole.ADMIN, true);
        AppUser target = user(UserRole.OWNER, true);
        when(userRepository.findWithTenantById(actorId)).thenReturn(Optional.of(actor));
        when(userRepository.findWithTenantById(targetId)).thenReturn(Optional.of(target));

        assertThrows(DomainConflictException.class, () -> userService.disable(targetId, actorId));
        verify(userRepository, never()).save(target);
    }

    @Test
    void supportAdminCanResetMerchantPasswordButCannotDisableUser() {
        UUID targetId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        AppUser actor = user(UserRole.SUPPORT_ADMIN, true);
        AppUser target = user(UserRole.MERCHANT, true);
        when(userRepository.findWithTenantById(actorId)).thenReturn(Optional.of(actor));
        when(userRepository.findWithTenantById(targetId)).thenReturn(Optional.of(target));
        when(passwordEncoder.encode("new-password")).thenReturn("encoded-password");

        userService.resetPassword(targetId, actorId, "new-password");

        verify(userRepository).save(target);
        verify(passwordEncoder).encode("new-password");
        assertThrows(DomainConflictException.class, () -> userService.disable(targetId, actorId));
    }

    @Test
    void userCanChangeOwnPasswordWithCurrentPassword() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(UserRole.MERCHANT, true);
        user.setPasswordHash("old-hash");
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("current-password", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");

        userService.changeOwnPassword(userId, "current-password", "new-password");

        verify(passwordEncoder).matches("current-password", "old-hash");
        verify(passwordEncoder).encode("new-password");
        verify(userRepository).save(user);
    }

    @Test
    void userCannotChangeOwnPasswordWithWrongCurrentPassword() {
        UUID userId = UUID.randomUUID();
        AppUser user = user(UserRole.MERCHANT, true);
        user.setPasswordHash("old-hash");
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "old-hash")).thenReturn(false);

        assertThrows(BadCredentialsException.class, () -> userService.changeOwnPassword(userId, "wrong-password", "new-password"));

        verify(passwordEncoder, never()).encode("new-password");
        verify(userRepository, never()).save(user);
    }

    @Test
    void ownerCannotDemoteLastEnabledOwner() {
        UUID targetId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        AppUser actor = user(UserRole.OWNER, true);
        AppUser target = user(UserRole.OWNER, true);
        when(userRepository.findWithTenantById(actorId)).thenReturn(Optional.of(actor));
        when(userRepository.findWithTenantById(targetId)).thenReturn(Optional.of(target));
        when(userRepository.countByRoleAndEnabled(UserRole.OWNER, true)).thenReturn(1L);

        assertThrows(DomainConflictException.class, () -> userService.changeRole(targetId, actorId, UserRole.ADMIN));
        verify(userRepository, never()).save(target);
    }

    private AppUser user(UserRole role, boolean enabled) {
        AppUser user = new AppUser();
        user.setRole(role);
        user.setEnabled(enabled);
        Tenant tenant = new Tenant();
        tenant.setName("Tenant");
        tenant.setType(role == UserRole.WAREHOUSE_OPERATOR ? TenantType.WAREHOUSE_PROVIDER : TenantType.MERCHANT);
        user.setTenant(tenant);
        return user;
    }

    @Test
    void createMakesFirebaseAuthUserWhenProviderAvailable() throws Exception {
        UUID tenantId = UUID.randomUUID();
        Tenant tenant = new Tenant();
        tenant.setType(TenantType.MERCHANT);
        when(tenantService.getRequired(tenantId)).thenReturn(tenant);
        when(userRepository.existsByEmailIgnoreCase("user@merhouse.local")).thenReturn(false);
        when(passwordEncoder.encode("plain-password")).thenReturn("encoded-hash");
        AppUser savedUser = new AppUser();
        savedUser.setEmail("user@merhouse.local");
        when(userRepository.save(any(AppUser.class))).thenReturn(savedUser);

        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<FirebaseAuth> firebaseProvider = mock(ObjectProvider.class);
        when(firebaseProvider.getIfAvailable()).thenReturn(firebaseAuth);
        // getUserByEmail throws — user doesn't exist yet
        when(firebaseAuth.getUserByEmail("user@merhouse.local")).thenThrow(mock(FirebaseAuthException.class));
        UserRecord mockRecord = mock(UserRecord.class);
        when(firebaseAuth.createUser(any(UserRecord.CreateRequest.class))).thenReturn(mockRecord);

        UserService serviceWithFirebase = new UserService(userRepository, tenantService, passwordEncoder, firebaseProvider);
        AppUser result = serviceWithFirebase.create(new CreateUserRequest(tenantId, "user@merhouse.local", "plain-password", UserRole.MERCHANT));

        assertNotNull(result);
        verify(firebaseAuth).createUser(any(UserRecord.CreateRequest.class));
        verify(userRepository).save(any(AppUser.class));
    }

    @Test
    void createSucceedsWhenFirebaseAuthCreationFails() throws Exception {
        UUID tenantId = UUID.randomUUID();
        Tenant tenant = new Tenant();
        tenant.setType(TenantType.MERCHANT);
        when(tenantService.getRequired(tenantId)).thenReturn(tenant);
        when(userRepository.existsByEmailIgnoreCase("fail@merhouse.local")).thenReturn(false);
        when(passwordEncoder.encode("plain-password")).thenReturn("encoded-hash");
        AppUser savedUser = new AppUser();
        savedUser.setEmail("fail@merhouse.local");
        when(userRepository.save(any(AppUser.class))).thenReturn(savedUser);

        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<FirebaseAuth> firebaseProvider = mock(ObjectProvider.class);
        when(firebaseProvider.getIfAvailable()).thenReturn(firebaseAuth);
        // Both getUserByEmail and createUser throw
        when(firebaseAuth.getUserByEmail("fail@merhouse.local")).thenThrow(mock(FirebaseAuthException.class));
        when(firebaseAuth.createUser(any(UserRecord.CreateRequest.class))).thenThrow(mock(FirebaseAuthException.class));

        UserService serviceWithFirebase = new UserService(userRepository, tenantService, passwordEncoder, firebaseProvider);
        // Should NOT throw — Firebase failure must not block DB user creation
        AppUser result = serviceWithFirebase.create(new CreateUserRequest(tenantId, "fail@merhouse.local", "plain-password", UserRole.MERCHANT));

        assertNotNull(result);
        verify(userRepository).save(any(AppUser.class));
    }
}
