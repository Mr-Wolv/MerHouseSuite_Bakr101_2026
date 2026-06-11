package com.merhouse.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.dto.LoginRequest;
import com.merhouse.entity.AppUser;
import com.merhouse.repository.AppUserRepository;
import com.merhouse.security.JwtService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final AuthService authService = new AuthService(userRepository, passwordEncoder, jwtService);

    @Test
    void disabledUsersReceiveGenericCredentialFailure() {
        AppUser user = new AppUser();
        user.setEmail("disabled@merhouse.local");
        user.setEnabled(false);
        when(userRepository.findByEmailIgnoreCase("disabled@merhouse.local")).thenReturn(Optional.of(user));

        LoginRequest request = new LoginRequest("disabled@merhouse.local", "disabled-password");

        assertThrows(BadCredentialsException.class, () -> authService.login(request));
        verify(passwordEncoder, never()).matches("disabled-password", user.getPasswordHash());
    }
}
