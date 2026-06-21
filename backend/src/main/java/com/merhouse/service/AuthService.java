package com.merhouse.service;

import com.merhouse.dto.CreateTenantRequest;
import com.merhouse.dto.CreateUserRequest;
import com.merhouse.dto.LoginRequest;
import com.merhouse.dto.SignUpRequest;
import com.merhouse.dto.SignUpResponse;
import com.merhouse.dto.UserResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.entity.TenantType;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.LoginRateLimiter;
import com.merhouse.security.LoginRateLimitExceededException;
import com.merhouse.util.TokenUtils;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final AppUserRepository userRepository;
    private final LoginRateLimiter loginRateLimiter;
    private final TenantService tenantService;
    private final UserService userService;

    public AuthService(
        AppUserRepository userRepository,
        LoginRateLimiter loginRateLimiter,
        TenantService tenantService,
        UserService userService
    ) {
        this.userRepository = userRepository;
        this.loginRateLimiter = loginRateLimiter;
        this.tenantService = tenantService;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public UserResponse login(LoginRequest request) {
        String email = request.email().trim();
        if (loginRateLimiter.isBlocked(email)) {
            throw new LoginRateLimitExceededException(loginRateLimiter.retryAfterSeconds(email));
        }

        AppUser user = userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> {
                loginRateLimiter.recordFailure(email);
                return new BadCredentialsException("Invalid email or password.");
            });
        if (!user.isEnabled()) {
            loginRateLimiter.recordFailure(email);
            throw new BadCredentialsException("Invalid email or password.");
        }
        loginRateLimiter.recordSuccess(email);
        return UserResponse.from(user);
    }

    @Transactional
    public SignUpResponse signUp(SignUpRequest request) {
        if (request.requestedRole().isPlatformAdmin()) {
            throw new IllegalArgumentException("Self-registration is only available for merchant and warehouse operator roles.");
        }

        var tenantType = request.requestedRole() == UserRole.MERCHANT
            ? TenantType.MERCHANT
            : TenantType.WAREHOUSE_PROVIDER;

        var tenant = tenantService.create(new CreateTenantRequest(request.organizationName(), tenantType));

        // Generate a recovery key before user creation so it's stored in a single save.
        String recoveryKey = TokenUtils.createRecoveryKey();
        String recoveryKeyHash = TokenUtils.hashToken(recoveryKey);

        AppUser user = userService.create(new CreateUserRequest(
            tenant.getId(),
            request.email(),
            request.password(),
            request.requestedRole(),
            recoveryKeyHash
        ));

        return new SignUpResponse(UserResponse.from(user), recoveryKey);
    }
}
