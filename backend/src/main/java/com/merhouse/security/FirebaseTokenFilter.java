package com.merhouse.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.merhouse.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Verifies Firebase ID tokens sent in the {@code Authorization: Bearer} header
 * and sets the Spring Security authentication context.
 *
 * <p>This replaces the legacy {@link JwtAuthenticationFilter} which validated
 * custom JWT tokens. Firebase Auth now owns credential verification; this filter
 * only verifies the ID token signature and extracts custom claims.
 *
 * <p>Disabled by default. Enable by setting {@code firebase.auth.enabled=true}.
 * During the migration period both filters can coexist: this filter only acts
 * when the token is a valid Firebase ID token (3-part vs 3-part but different
 * signing), and the legacy filter handles the old custom JWTs. Once all users
 * have migrated to Firebase Auth, remove the legacy filter and this property gate.
 */
@Component
@ConditionalOnProperty(name = "firebase.auth.enabled", havingValue = "true")
public class FirebaseTokenFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FirebaseTokenFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";

    private final AppUserRepository userRepository;

    public FirebaseTokenFilter(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith(BEARER_PREFIX)) {
            String idToken = authorization.substring(BEARER_PREFIX.length());
            try {
                FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);

                // Look up the user in our database to get tenant and role info.
                // The Firebase UID is stored as the user's external ID or we map
                // by email. For now we match by email since existing users don't
                // have Firebase UIDs yet.
                String email = decodedToken.getEmail();
                if (email != null) {
                    userRepository.findByEmailIgnoreCase(email)
                        .filter(user -> user.isEnabled())
                        .ifPresent(user -> {
                            UserPrincipal principal = new UserPrincipal(user);
                            UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                    principal,
                                    null,
                                    principal.getAuthorities()
                                );
                            SecurityContextHolder.getContext().setAuthentication(authentication);
                        });
                }
            } catch (FirebaseAuthException e) {
                log.debug("Firebase token verification failed: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            } catch (Exception e) {
                log.debug("Unexpected error during Firebase token verification: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }
}
