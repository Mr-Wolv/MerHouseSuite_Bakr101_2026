package com.merhouse.security;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.merhouse.entity.AppUser;
import com.merhouse.entity.Tenant;
import com.merhouse.entity.UserRole;
import com.merhouse.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

class JwtAuthenticationFilterTest {
    private final JwtService jwtService = mock(JwtService.class);
    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final HttpServletRequest request = mock(HttpServletRequest.class);
    private final HttpServletResponse response = mock(HttpServletResponse.class);
    private final FilterChain filterChain = mock(FilterChain.class);
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtService, userRepository);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void noAuthorizationHeaderPassesThrough() throws Exception {
        when(request.getHeader("Authorization")).thenReturn(null);

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void emptyAuthorizationHeaderPassesThrough() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("");

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void nonBearerSchemePassesThrough() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Basic dXNlcjpwYXNz");

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void validTokenSetsAuthenticationInContext() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UserPrincipal tokenPrincipal = new UserPrincipal(userId, tenantId, "user@test.com", UserRole.OWNER, true);

        when(request.getHeader("Authorization")).thenReturn("Bearer valid-token");
        when(jwtService.parse("valid-token")).thenReturn(tokenPrincipal);

        AppUser dbUser = enabledUser(userId, tenantId, "user@test.com");
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(dbUser));

        filter.doFilterInternal(request, response, filterChain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        UserPrincipal authPrincipal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assert authPrincipal.id().equals(userId);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void invalidTokenClearsContext() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer bad-token");
        when(jwtService.parse("bad-token")).thenThrow(new IllegalArgumentException("Invalid token."));

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void expiredTokenClearsContext() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer expired-token");
        when(jwtService.parse("expired-token")).thenThrow(new IllegalArgumentException("Token has expired."));

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void disabledUserDoesNotSetAuthentication() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UserPrincipal tokenPrincipal = new UserPrincipal(userId, tenantId, "disabled@test.com", UserRole.ADMIN, true);

        when(request.getHeader("Authorization")).thenReturn("Bearer token-for-disabled");
        when(jwtService.parse("token-for-disabled")).thenReturn(tokenPrincipal);

        AppUser disabledUser = new AppUser();
        ReflectionTestUtils.setField(disabledUser, "id", userId);
        disabledUser.setEnabled(false);
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", tenantId);
        disabledUser.setTenant(tenant);
        disabledUser.setEmail("disabled@test.com");
        disabledUser.setRole(UserRole.ADMIN);
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(disabledUser));

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
            "Disabled user must not be authenticated even if JWT is valid");
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void userNotFoundInDatabaseDoesNotSetAuthentication() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UserPrincipal tokenPrincipal = new UserPrincipal(userId, tenantId, "deleted@test.com", UserRole.MERCHANT, true);

        when(request.getHeader("Authorization")).thenReturn("Bearer token-for-deleted");
        when(jwtService.parse("token-for-deleted")).thenReturn(tokenPrincipal);
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.empty());

        filter.doFilterInternal(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void filterChainAlwaysContinues() throws Exception {
        // Even with invalid token, the filter chain must continue (for public endpoints)
        when(request.getHeader("Authorization")).thenReturn("Bearer garbage");
        when(jwtService.parse("garbage")).thenThrow(new IllegalArgumentException("bad"));

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void bearerTokenWithExtraWhitespaceIsParsed() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UserPrincipal tokenPrincipal = new UserPrincipal(userId, tenantId, "user@test.com", UserRole.OWNER, true);

        when(request.getHeader("Authorization")).thenReturn("Bearer   spaced-token");
        when(jwtService.parse("  spaced-token")).thenReturn(tokenPrincipal);

        AppUser dbUser = enabledUser(userId, tenantId, "user@test.com");
        when(userRepository.findWithTenantById(userId)).thenReturn(Optional.of(dbUser));

        filter.doFilterInternal(request, response, filterChain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    private AppUser enabledUser(UUID userId, UUID tenantId, String email) {
        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", userId);
        user.setEmail(email);
        user.setRole(UserRole.OWNER);
        user.setEnabled(true);
        Tenant tenant = new Tenant();
        ReflectionTestUtils.setField(tenant, "id", tenantId);
        user.setTenant(tenant);
        return user;
    }
}
