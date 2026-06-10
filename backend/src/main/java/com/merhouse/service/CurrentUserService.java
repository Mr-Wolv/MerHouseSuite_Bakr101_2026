package com.merhouse.service;

import com.merhouse.entity.UserRole;
import com.merhouse.security.UserPrincipal;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {
    public UserPrincipal required() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Authentication is required.");
        }
        return principal;
    }

    public boolean hasRole(UserRole role) {
        return required().role() == role;
    }

    public boolean isAdmin() {
        return required().role().isPlatformAdmin();
    }

    public boolean canMutatePlatform() {
        return required().role().canMutatePlatform();
    }

    public boolean canSupportUsers() {
        return required().role().canSupportUsers();
    }

    public void requireAdminOrTenant(UUID tenantId) {
        UserPrincipal principal = required();
        if (!principal.role().isPlatformAdmin() && !principal.tenantId().equals(tenantId)) {
            throw new AccessDeniedException("You cannot access resources for another tenant.");
        }
    }

    public void requireMutatingAdminOrTenant(UUID tenantId) {
        UserPrincipal principal = required();
        if (!principal.role().canMutatePlatform() && !principal.tenantId().equals(tenantId)) {
            throw new AccessDeniedException("You cannot mutate resources for another tenant.");
        }
    }
}
