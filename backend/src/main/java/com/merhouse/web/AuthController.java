package com.merhouse.web;

import com.merhouse.dto.CurrentUserResponse;
import com.merhouse.dto.LoginRequest;
import com.merhouse.dto.MessageResponse;
import com.merhouse.dto.PasswordResetConfirmRequest;
import com.merhouse.dto.PasswordResetRequest;
import com.merhouse.dto.PasswordResetRequestResponse;
import com.merhouse.dto.RecoveryKeyRequest;
import com.merhouse.dto.RecoveryKeyResetResponse;
import com.merhouse.dto.SelfPasswordChangeRequest;
import com.merhouse.dto.SignUpRequest;
import com.merhouse.dto.SignUpResponse;
import com.merhouse.dto.UserResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.security.UserPrincipal;
import com.merhouse.service.AuthRecoveryService;
import com.merhouse.service.AuthService;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.AdminAuditService;
import com.merhouse.service.UserService;
import com.merhouse.util.TokenUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;
    private final AuthRecoveryService authRecoveryService;
    private final CurrentUserService currentUserService;
    private final UserService userService;
    private final AdminAuditService adminAuditService;

    public AuthController(
        AuthService authService,
        AuthRecoveryService authRecoveryService,
        CurrentUserService currentUserService,
        UserService userService,
        AdminAuditService adminAuditService
    ) {
        this.authService = authService;
        this.authRecoveryService = authRecoveryService;
        this.currentUserService = currentUserService;
        this.userService = userService;
        this.adminAuditService = adminAuditService;
    }

    @PostMapping("/login")
    public UserResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/signup")
    public SignUpResponse signUp(@Valid @RequestBody SignUpRequest request) {
        return authService.signUp(request);
    }

    @PostMapping("/recovery-key/reset")
    public RecoveryKeyResetResponse resetWithRecoveryKey(@Valid @RequestBody RecoveryKeyRequest request) {
        return authRecoveryService.resetWithRecoveryKey(request);
    }

    @PostMapping("/recovery-key/regenerate")
    public MessageResponse regenerateRecoveryKey() {
        UserPrincipal principal = currentUserService.required();
        AppUser user = userService.getRequired(principal.id());
        String newKey = TokenUtils.createRecoveryKey();
        user.setRecoveryKeyHash(TokenUtils.hashToken(newKey));
        userService.save(user);
        return new MessageResponse(newKey);
    }

    @PostMapping("/password-reset/request")
    public PasswordResetRequestResponse requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        return authRecoveryService.requestReset(request);
    }

    @PostMapping("/password-reset/confirm")
    public MessageResponse confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        return authRecoveryService.confirmReset(request);
    }

    @GetMapping("/me")
    public CurrentUserResponse me() {
        UserPrincipal principal = currentUserService.required();
        AppUser user = userService.getRequired(principal.id());
        return new CurrentUserResponse(UserResponse.from(user));
    }

    @PatchMapping("/me/password")
    public MessageResponse changeOwnPassword(@Valid @RequestBody SelfPasswordChangeRequest request) {
        UserPrincipal principal = currentUserService.required();
        userService.changeOwnPassword(principal.id(), request.currentPassword(), request.newPassword());
        adminAuditService.record(
            principal.id(),
            "USER_PASSWORD_CHANGED",
            "AppUser",
            principal.id(),
            "Self-service account password change"
        );
        return new MessageResponse("Password changed.");
    }
}
