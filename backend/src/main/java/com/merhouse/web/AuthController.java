package com.merhouse.web;

import com.merhouse.dto.AuthResponse;
import com.merhouse.dto.CurrentUserResponse;
import com.merhouse.dto.LoginRequest;
import com.merhouse.dto.MessageResponse;
import com.merhouse.dto.PasswordResetConfirmRequest;
import com.merhouse.dto.PasswordResetRequest;
import com.merhouse.dto.PasswordResetRequestResponse;
import com.merhouse.dto.UserResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.security.UserPrincipal;
import com.merhouse.service.AuthRecoveryService;
import com.merhouse.service.AuthService;
import com.merhouse.service.CurrentUserService;
import com.merhouse.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
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

    public AuthController(
        AuthService authService,
        AuthRecoveryService authRecoveryService,
        CurrentUserService currentUserService,
        UserService userService
    ) {
        this.authService = authService;
        this.authRecoveryService = authRecoveryService;
        this.currentUserService = currentUserService;
        this.userService = userService;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
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
}
