package com.merhouse.web;

import com.merhouse.dto.AdminActionRequest;
import com.merhouse.dto.AdminResetPasswordRequest;
import com.merhouse.dto.ChangeUserRoleRequest;
import com.merhouse.dto.CreateUserRequest;
import com.merhouse.dto.UserResponse;
import com.merhouse.exception.DomainConflictException;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("@currentUserService.isAdmin()")
public class AdminUserController {
    private final CurrentUserService currentUserService;
    private final UserService userService;
    private final AdminAuditService adminAuditService;

    public AdminUserController(
        CurrentUserService currentUserService,
        UserService userService,
        AdminAuditService adminAuditService
    ) {
        this.currentUserService = currentUserService;
        this.userService = userService;
        this.adminAuditService = adminAuditService;
    }

    @GetMapping
    public List<UserResponse> list() {
        return userService.findAll().stream()
            .map(UserResponse::from)
            .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        var actor = currentUserService.required();
        if (request.role().isPlatformAdmin() && !actor.role().canManageAdmins()) {
            throw new DomainConflictException("Only an owner can create platform admin accounts.");
        }
        var created = userService.create(request);
        adminAuditService.record(actor.id(), "USER_CREATED", "AppUser", created.getId(), "Admin-created account");
        return UserResponse.from(created);
    }

    @PatchMapping("/{id}/disable")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public UserResponse disable(@PathVariable UUID id, @Valid @RequestBody AdminActionRequest request) {
        UUID actorId = currentUserService.required().id();
        var disabled = userService.disable(id, actorId);
        adminAuditService.record(actorId, "USER_DISABLED", "AppUser", id, request.reason());
        return UserResponse.from(disabled);
    }

    @PatchMapping("/{id}/enable")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public UserResponse enable(@PathVariable UUID id, @Valid @RequestBody AdminActionRequest request) {
        UUID actorId = currentUserService.required().id();
        var enabled = userService.enable(id, actorId);
        adminAuditService.record(actorId, "USER_ENABLED", "AppUser", id, request.reason());
        return UserResponse.from(enabled);
    }

    @PatchMapping("/{id}/role")
    @PreAuthorize("@currentUserService.canMutatePlatform()")
    public UserResponse changeRole(@PathVariable UUID id, @Valid @RequestBody ChangeUserRoleRequest request) {
        UUID actorId = currentUserService.required().id();
        var changed = userService.changeRole(id, actorId, request.role());
        adminAuditService.record(actorId, "USER_ROLE_CHANGED", "AppUser", id, request.reason());
        return UserResponse.from(changed);
    }

    @PatchMapping("/{id}/password")
    public UserResponse resetPassword(@PathVariable UUID id, @Valid @RequestBody AdminResetPasswordRequest request) {
        UUID actorId = currentUserService.required().id();
        var changed = userService.resetPassword(id, actorId, request.newPassword());
        adminAuditService.record(actorId, "USER_PASSWORD_RESET", "AppUser", id, request.reason());
        return UserResponse.from(changed);
    }
}
