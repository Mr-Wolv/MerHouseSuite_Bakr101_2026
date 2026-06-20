package com.merhouse.security;

import com.merhouse.entity.AppUser;
import com.merhouse.entity.UserRole;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class UserPrincipal implements UserDetails {
    private final UUID id;
    private final UUID tenantId;
    private final String email;
    private final String passwordHash;
    private final String firebaseUid;
    private final UserRole role;
    private final boolean enabled;

    public UserPrincipal(AppUser user) {
        this(
            user.getId(),
            user.getTenant().getId(),
            user.getEmail(),
            user.getPasswordHash(),
            user.getFirebaseUid(),
            user.getRole(),
            user.isEnabled()
        );
    }

    public UserPrincipal(UUID id, UUID tenantId, String email, UserRole role, boolean enabled) {
        this(id, tenantId, email, "", null, role, enabled);
    }

    private UserPrincipal(UUID id, UUID tenantId, String email, String passwordHash, String firebaseUid, UserRole role, boolean enabled) {
        this.id = id;
        this.tenantId = tenantId;
        this.email = email;
        this.passwordHash = passwordHash;
        this.firebaseUid = firebaseUid;
        this.role = role;
        this.enabled = enabled;
    }

    public UUID id() {
        return id;
    }

    public UUID tenantId() {
        return tenantId;
    }

    public String firebaseUid() {
        return firebaseUid;
    }

    public UserRole role() {
        return role;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }
}
