package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.AppUser;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.repository.AppUserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class UserServiceTest {
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final TenantService tenantService = mock(TenantService.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final UserService userService = new UserService(userRepository, tenantService, passwordEncoder);

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
}
