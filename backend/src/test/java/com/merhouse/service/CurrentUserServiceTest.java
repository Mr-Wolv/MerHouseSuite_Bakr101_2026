package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.merhouse.entity.UserRole;
import com.merhouse.security.UserPrincipal;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class CurrentUserServiceTest {
    private final CurrentUserService currentUserService = new CurrentUserService();

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void requiredThrowsWhenNoAuthentication() {
        assertThrows(AccessDeniedException.class, () -> currentUserService.required());
    }

    @Test
    void requiredThrowsWhenPrincipalIsNotUserPrincipal() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
            "string-principal", null);
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThrows(AccessDeniedException.class, () -> currentUserService.required());
    }

    @Test
    void requiredReturnsAuthenticatedPrincipal() {
        UserPrincipal principal = principal(UserRole.OWNER);
        setAuthentication(principal);

        UserPrincipal result = currentUserService.required();

        assertTrue(result.id().equals(principal.id()));
        assertTrue(result.role() == UserRole.OWNER);
    }

    @Test
    void hasRoleReturnsTrueForMatchingRole() {
        setAuthentication(principal(UserRole.ADMIN));
        assertTrue(currentUserService.hasRole(UserRole.ADMIN));
    }

    @Test
    void hasRoleReturnsFalseForNonMatchingRole() {
        setAuthentication(principal(UserRole.MERCHANT));
        assertFalse(currentUserService.hasRole(UserRole.ADMIN));
    }

    @Test
    void isAdminTrueForOwner() {
        setAuthentication(principal(UserRole.OWNER));
        assertTrue(currentUserService.isAdmin());
    }

    @Test
    void isAdminTrueForAdmin() {
        setAuthentication(principal(UserRole.ADMIN));
        assertTrue(currentUserService.isAdmin());
    }

    @Test
    void isAdminTrueForSupportAdmin() {
        setAuthentication(principal(UserRole.SUPPORT_ADMIN));
        assertTrue(currentUserService.isAdmin());
    }

    @Test
    void isAdminTrueForAuditor() {
        setAuthentication(principal(UserRole.AUDITOR));
        assertTrue(currentUserService.isAdmin());
    }

    @Test
    void isAdminFalseForMerchant() {
        setAuthentication(principal(UserRole.MERCHANT));
        assertFalse(currentUserService.isAdmin());
    }

    @Test
    void isAdminFalseForWarehouseOperator() {
        setAuthentication(principal(UserRole.WAREHOUSE_OPERATOR));
        assertFalse(currentUserService.isAdmin());
    }

    @Test
    void canMutatePlatformTrueForOwner() {
        setAuthentication(principal(UserRole.OWNER));
        assertTrue(currentUserService.canMutatePlatform());
    }

    @Test
    void canMutatePlatformTrueForAdmin() {
        setAuthentication(principal(UserRole.ADMIN));
        assertTrue(currentUserService.canMutatePlatform());
    }

    @Test
    void canMutatePlatformFalseForSupportAdmin() {
        setAuthentication(principal(UserRole.SUPPORT_ADMIN));
        assertFalse(currentUserService.canMutatePlatform());
    }

    @Test
    void canMutatePlatformFalseForMerchant() {
        setAuthentication(principal(UserRole.MERCHANT));
        assertFalse(currentUserService.canMutatePlatform());
    }

    @Test
    void canSupportUsersTrueForOwner() {
        setAuthentication(principal(UserRole.OWNER));
        assertTrue(currentUserService.canSupportUsers());
    }

    @Test
    void canSupportUsersTrueForSupportAdmin() {
        setAuthentication(principal(UserRole.SUPPORT_ADMIN));
        assertTrue(currentUserService.canSupportUsers());
    }

    @Test
    void canSupportUsersFalseForAuditor() {
        setAuthentication(principal(UserRole.AUDITOR));
        assertFalse(currentUserService.canSupportUsers());
    }

    @Test
    void requireAdminOrTenantAllowsAdmin() {
        UUID tenantId = UUID.randomUUID();
        UUID otherTenant = UUID.randomUUID();
        UserPrincipal principal = new UserPrincipal(
            UUID.randomUUID(), tenantId, "admin@test.com", UserRole.OWNER, true);
        setAuthentication(principal);

        // Admin should pass for any tenant
        currentUserService.requireAdminOrTenant(otherTenant);
    }

    @Test
    void requireAdminOrTenantAllowsMatchingTenant() {
        UUID tenantId = UUID.randomUUID();
        UserPrincipal principal = new UserPrincipal(
            UUID.randomUUID(), tenantId, "merchant@test.com", UserRole.MERCHANT, true);
        setAuthentication(principal);

        // Same tenant should pass
        currentUserService.requireAdminOrTenant(tenantId);
    }

    @Test
    void requireAdminOrTenantDeniesOtherTenant() {
        UUID ownTenant = UUID.randomUUID();
        UUID otherTenant = UUID.randomUUID();
        UserPrincipal principal = new UserPrincipal(
            UUID.randomUUID(), ownTenant, "merchant@test.com", UserRole.MERCHANT, true);
        setAuthentication(principal);

        assertThrows(AccessDeniedException.class,
            () -> currentUserService.requireAdminOrTenant(otherTenant));
    }

    @Test
    void requireMutatingAdminOrTenantAllowsMutatingAdmin() {
        UUID tenantId = UUID.randomUUID();
        UUID otherTenant = UUID.randomUUID();
        UserPrincipal principal = new UserPrincipal(
            UUID.randomUUID(), tenantId, "admin@test.com", UserRole.ADMIN, true);
        setAuthentication(principal);

        currentUserService.requireMutatingAdminOrTenant(otherTenant);
    }

    @Test
    void requireMutatingAdminOrTenantDeniesNonMutatingAdmin() {
        UUID ownTenant = UUID.randomUUID();
        UUID otherTenant = UUID.randomUUID();
        UserPrincipal principal = new UserPrincipal(
            UUID.randomUUID(), ownTenant, "support@test.com", UserRole.SUPPORT_ADMIN, true);
        setAuthentication(principal);

        assertThrows(AccessDeniedException.class,
            () -> currentUserService.requireMutatingAdminOrTenant(otherTenant));
    }

    @Test
    void requireMutatingAdminOrTenantAllowsMatchingTenant() {
        UUID tenantId = UUID.randomUUID();
        UserPrincipal principal = new UserPrincipal(
            UUID.randomUUID(), tenantId, "merchant@test.com", UserRole.MERCHANT, true);
        setAuthentication(principal);

        currentUserService.requireMutatingAdminOrTenant(tenantId);
    }

    private UserPrincipal principal(UserRole role) {
        return new UserPrincipal(UUID.randomUUID(), UUID.randomUUID(), "test@test.com", role, true);
    }

    private void setAuthentication(UserPrincipal principal) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
            principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
