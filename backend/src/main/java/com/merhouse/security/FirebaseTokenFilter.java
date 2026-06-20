package com.merhouse.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.merhouse.entity.AppUser;
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
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Verifies Firebase ID tokens sent in the {@code Authorization: Bearer} header
 * and sets the Spring Security authentication context.
 *
 * <p>Firebase Auth owns credential verification; this filter verifies the ID
 * token signature and extracts the Firebase {@code uid}. The uid is mapped
 * to the local {@code AppUser} entity through the {@code firebase_uid} column
 * in the database. When no {@code firebase_uid} match is found, the filter
 * falls back to email-based lookup for backwards compatibility with users
 * created before Firebase uid tracking was added.
 *
 * <p>Custom JWT authentication has been removed — Firebase is the only
 * authentication path.
 */
@Component
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

                // Primary lookup by Firebase UID (the recommended path for
                // users created after firebase_uid tracking was added).
                String uid = decodedToken.getUid();
                boolean found = false;

                if (uid != null) {
                    found = userRepository.findByFirebaseUid(uid)
                        .filter(AppUser::isEnabled)
                        .map(user -> {
                            UserPrincipal principal = new UserPrincipal(user);
                            UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                    principal,
                                    null,
                                    principal.getAuthorities()
                                );
                            SecurityContextHolder.getContext().setAuthentication(authentication);
                            return true;
                        })
                        .orElse(false);
                }

                // Fallback: look up by email for backwards compatibility with
                // users created before firebase_uid tracking was added.
                // When the user is found by email and has no firebase_uid yet,
                // save the uid lazily so future lookups use the fast path.
                if (!found) {
                    String email = decodedToken.getEmail();
                    if (email != null) {
                        userRepository.findByEmailIgnoreCase(email)
                            .filter(AppUser::isEnabled)
                            .ifPresent(user -> {
                                // Lazy backfill: save the Firebase uid for
                                // users who existed before the firebase_uid
                                // column was added.
                                if (user.getFirebaseUid() == null && uid != null) {
                                    user.setFirebaseUid(uid);
                                    userRepository.save(user);
                                }
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
