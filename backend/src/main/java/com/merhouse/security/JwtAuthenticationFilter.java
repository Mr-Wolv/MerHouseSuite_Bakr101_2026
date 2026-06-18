package com.merhouse.security;

import com.merhouse.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final AppUserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, AppUserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            try {
                UserPrincipal tokenPrincipal = jwtService.parse(authorization.substring("Bearer ".length()));
                userRepository.findWithTenantById(tokenPrincipal.id())
                    .filter(user -> user.isEnabled())
                    .map(UserPrincipal::new)
                    .ifPresent(principal -> {
                        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            principal,
                            null,
                            principal.getAuthorities()
                        );
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    });
            } catch (IllegalArgumentException ignored) {
                // Do not clear the security context here. When Firebase Auth is
                // enabled, FirebaseTokenFilter may have already set authentication
                // from a valid Firebase ID token. Clearing here would destroy that.
                // Simply skip — the next filter in the chain will handle
                // unauthenticated requests.
            }
        }

        filterChain.doFilter(request, response);
    }
}
