package com.merhouse.service;

import com.merhouse.dto.AuthResponse;
import com.merhouse.dto.LoginRequest;
import com.merhouse.dto.UserResponse;
import com.merhouse.entity.AppUser;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.JwtService;
import com.merhouse.security.LoginRateLimiter;
import com.merhouse.security.LoginRateLimitExceededException;
import com.merhouse.security.UserPrincipal;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginRateLimiter loginRateLimiter;

    public AuthService(AppUserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService, LoginRateLimiter loginRateLimiter) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.loginRateLimiter = loginRateLimiter;
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
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
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            loginRateLimiter.recordFailure(email);
            throw new BadCredentialsException("Invalid email or password.");
        }

        loginRateLimiter.recordSuccess(email);
        UserPrincipal principal = new UserPrincipal(user);
        return new AuthResponse(
            jwtService.createToken(principal),
            "Bearer",
            jwtService.expiresInSeconds(),
            UserResponse.from(user)
        );
    }
}
